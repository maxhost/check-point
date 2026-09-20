import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

// Redirect throws a tagged error so we can assert the destination without a real router.
class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirect:${to}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirected(to);
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

let sessionValue: {
  user: { id: string; name: string; emailVerified?: boolean };
} | null = null;
let membershipRow: Record<string, unknown> | undefined;
/** Every `db.delete(table).where(cond)` the guard issued, in order. */
let deletes: Array<{ table: unknown; where: SQL }> = [];

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({
    api: { getSession: async () => sessionValue },
  }),
}));

vi.mock("./db", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "innerJoin", "where", "orderBy"]) {
    chain[m] = () => chain;
  }
  chain.limit = () => Promise.resolve(membershipRow ? [membershipRow] : []);
  chain.delete = (table: unknown) => ({
    where: async (where: SQL) => {
      deletes.push({ table, where });
    },
  });
  return { getDb: () => chain };
});

import {
  BUSINESS_CLOSED,
  requireBackofficeSession,
  requireOwner,
  STAFF_DISABLED,
} from "./auth-guards";
import { sessions } from "./schema";

const owner = {
  id: "b1",
  name: "Bar",
  currencyCode: "USD",
  timezone: "America/Guayaquil",
  role: "owner",
  status: "active",
  // Spec 0072 §D4: el eje `status` del NEGOCIO. Se llama `businessStatus` y no `status`
  // porque `status` ya es el de la MEMBRESÍA en esta misma fila — dos ejes distintos con el
  // mismo nombre es como uno termina decidiendo por el otro.
  businessStatus: "active",
  suspensionReason: null,
};

async function destinationOf(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof Redirected) return error.to;
    throw error;
  }
  return "<no-redirect>";
}

describe("backoffice guards by role (ADR 0044)", () => {
  afterEach(() => {
    sessionValue = null;
    membershipRow = undefined;
    deletes = [];
  });

  // Spec 0067 §7 / mutación #6: la pantalla de acceso vieja fue BORRADA. Un `redirect` a
  // una ruta que ya no existe convierte un rebote en un 404, así que el destino es parte
  // del contrato del guard y no decoración. Apuntadas al destino viejo, estas tres
  // aserciones seguirían pasando contra un producto roto — por eso viven acá.
  it("no session → /", async () => {
    sessionValue = null;
    expect(await destinationOf(requireBackofficeSession)).toBe("/");
  });

  it("session but no membership → /", async () => {
    sessionValue = { user: { id: "u1", name: "Ana", emailVerified: true } };
    membershipRow = undefined;
    expect(await destinationOf(requireBackofficeSession)).toBe("/");
  });

  // ADR 0055 / spec 0057: the bounce says why, and leaves no live session behind.
  it("disabled membership → / with the reason, and revokes the session first", async () => {
    sessionValue = { user: { id: "u1", name: "Ana", emailVerified: true } };
    membershipRow = { ...owner, role: "staff", status: "disabled" };

    expect(await destinationOf(requireBackofficeSession)).toBe(
      "/?e=staff_disabled",
    );

    // The redirect throws NEXT_REDIRECT: if the revocation moved after it, or was
    // dropped, nothing would have been recorded by the time we get here.
    expect(deletes).toHaveLength(1);
    expect(deletes[0].table).toBe(sessions);
    const { sql, params } = new PgDialect().sqlToQuery(deletes[0].where);
    expect(sql).toContain('"user_id"');
    expect(params).toEqual(["u1"]);
  });

  // El código que el guard emite y su TRADUCCIÓN vivían en dos archivos (el segundo, en
  // la pantalla de acceso vieja); esa página se borró y la allow-list se mudó al
  // CONTRATO, que es lo que lee quien construye la UI de afuera. El par sigue pinneado:
  // un código que el guard emite y el contrato no documenta deja a la UI sin qué decir.
  it("los códigos que el guard emite están en la tabla del contrato", () => {
    const contrato = readFileSync(
      new URL(
        "../../../../docs/specs/0067-contratos-de-api.md",
        import.meta.url,
      ),
      "utf8",
    );
    // Piso: sin esto, un archivo vacío o movido pasaría este test en verde.
    expect(contrato.length).toBeGreaterThan(5_000);
    expect(contrato).toContain("## Códigos de rebote");
    for (const code of [STAFF_DISABLED]) {
      expect(contrato).toContain(`\`${code}\``);
    }
    // Spec 0082: `email_not_verified` YA NO ES un código de rebote — el guard no lo emite,
    // sólo sobrevive como 403 de API. Si alguien re-pusiera el `redirect`, esta línea no lo
    // vería; lo que lo ve es el caso «owner sin verificar ENTRA» de abajo. Lo que ASEVERA
    // acá es lo contrario: que el contrato no siga prometiéndole a la UI un código por `?e=`
    // que nadie va a mandar nunca.
    const rebotes = contrato.slice(contrato.indexOf("## Códigos de rebote"));
    expect(rebotes).not.toContain("| `email_not_verified` |");
  });

  // Spec 0082: el staff NUNCA tuvo gate de email acá y sigue sin tenerlo. No tiene email por
  // diseño (`@staff.invalid`), así que un gate que lo alcanzara dejaría el mostrador muerto
  // para siempre. El gate que sí existe —y que también lo exime— es el del mostrador
  // (`counter-email-gate.test.ts`).
  it("staff con email SIN verificar entra igual al mostrador", async () => {
    sessionValue = { user: { id: "u1", name: "Ana", emailVerified: false } };
    membershipRow = { ...owner, role: "staff", status: "active" };
    const ctx = await requireBackofficeSession();
    expect(ctx.membership).toEqual({ role: "staff", status: "active" });
    expect(ctx.emailVerified).toBe(false);
    expect(deletes).toEqual([]);
  });

  /**
   * EL ORÁCULO INVERTIDO DE LA SPEC 0082, y es la mutación #4: hasta esta spec este mismo
   * caso exigía un rebote a la landing con el motivo en el query. La decisión del owner es
   * textual (ADR 0070 §11):
   * *«Entra a su cuenta directamente al terminar el wizard y ve el onboarding»*, y el primer
   * paso de ese onboarding **es** verificar el email. Entrar sí, acciones no.
   *
   * No alcanza con «no redirige»: el contexto tiene que TRAER el dato, porque es lo único con
   * lo que la página puede pintar ese primer paso.
   */
  it("owner con email SIN verificar ENTRA, y se lleva `emailVerified: false`", async () => {
    sessionValue = { user: { id: "u1", name: "Ana", emailVerified: false } };
    membershipRow = { ...owner };
    const ctx = await requireBackofficeSession();
    expect(ctx.emailVerified).toBe(false);
    expect(ctx.membership.role).toBe("owner");
    expect(ctx.business.id).toBe("b1");
    // Ni rebota ni expulsa: la sesión sigue viva para poder verificar desde adentro.
    expect(deletes).toEqual([]);
  });

  // Fail-closed EN EL DATO, no en la puerta: sin la clave el owner entra igual, pero el
  // contexto dice `false` — una fila vieja o un doble incompleto no puede pintar la pantalla
  // como si el buzón estuviera probado.
  it("owner sin el campo `emailVerified` también entra, y el contexto dice `false`", async () => {
    sessionValue = { user: { id: "u1", name: "Ana" } };
    membershipRow = { ...owner };
    const ctx = await requireBackofficeSession();
    expect(ctx.emailVerified).toBe(false);
    expect(ctx.membership.role).toBe("owner");
    expect(deletes).toEqual([]);
  });

  it("active staff passes the session guard but requireOwner sends it to the counter", async () => {
    sessionValue = { user: { id: "u1", name: "Ana", emailVerified: true } };
    membershipRow = { ...owner, role: "staff", status: "active" };
    const ctx = await requireBackofficeSession();
    expect(ctx.membership).toEqual({ role: "staff", status: "active" });
    expect(deletes).toEqual([]);
    expect(await destinationOf(requireOwner)).toBe("/backoffice/counter");
    expect(deletes).toEqual([]);
  });

  /**
   * Spec 0072 §D4 — EL EJE `status` DEL NEGOCIO EN EL BACKOFFICE. Sólo `closed` rebota.
   *
   * `suspended` PASA a propósito y es decisión del owner: lo único que un owner suspendido
   * tiene que poder hacer es leer el motivo y el botón de contacto, así que rebotarlo sería
   * dejarlo sin ninguna superficie donde enterarse. Todo lo que puede HACER ya está cortado
   * — las 10 APIs del owner contestan 403 y el mostrador también.
   */
  it("negocio `closed` → /?e=business_closed, aunque la membresía esté activa", async () => {
    sessionValue = { user: { id: "u1", name: "Ana", emailVerified: true } };
    membershipRow = { ...owner, businessStatus: "closed" };
    expect(await destinationOf(requireBackofficeSession)).toBe(
      `/?e=${BUSINESS_CLOSED}`,
    );
  });

  it("negocio `suspended`: el owner ENTRA, y se lleva el motivo para mostrarlo", async () => {
    sessionValue = { user: { id: "u1", name: "Ana", emailVerified: true } };
    membershipRow = {
      ...owner,
      businessStatus: "suspended",
      suspensionReason: "Reclamos de consumidores.",
    };
    const ctx = await requireBackofficeSession();
    expect(ctx.business.status).toBe("suspended");
    expect(ctx.business.suspensionReason).toBe("Reclamos de consumidores.");
    expect(deletes).toEqual([]);
  });

  it("un INTEGRANTE de un negocio suspendido NO recibe el motivo", async () => {
    // §D4: `suspension_reason` se serializa SÓLO al owner. Es una nota interna sobre la
    // cuenta del negocio, no algo que quien trabaja ahí tenga que leer.
    sessionValue = { user: { id: "u1", name: "Ana", emailVerified: true } };
    membershipRow = {
      ...owner,
      role: "staff",
      businessStatus: "suspended",
      suspensionReason: "Reclamos de consumidores.",
    };
    const ctx = await requireBackofficeSession();
    expect(ctx.business.status).toBe("suspended");
    expect(ctx.business.suspensionReason).toBeNull();
  });

  it("active owner reaches an owner-only page", async () => {
    sessionValue = { user: { id: "u1", name: "Ana", emailVerified: true } };
    membershipRow = { ...owner };
    const ctx = await requireOwner();
    expect(ctx.membership.role).toBe("owner");
    expect(ctx.business.id).toBe("b1");
    expect(ctx.userName).toBe("Ana");
    expect(deletes).toEqual([]);
  });
});
