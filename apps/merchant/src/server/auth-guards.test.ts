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
  EMAIL_NOT_VERIFIED,
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
    for (const code of [STAFF_DISABLED, EMAIL_NOT_VERIFIED]) {
      expect(contrato).toContain(`\`${code}\``);
    }
  });

  // Mutación #3: el gate de email verificado NO puede alcanzar al staff. Un integrante no
  // tiene email por diseño (`@staff.invalid`), así que si el gate lo alcanzara el
  // mostrador quedaría muerto para siempre y ninguna acción lo podría desbloquear.
  it("staff con email SIN verificar entra igual al mostrador", async () => {
    sessionValue = { user: { id: "u1", name: "Ana", emailVerified: false } };
    membershipRow = { ...owner, role: "staff", status: "active" };
    const ctx = await requireBackofficeSession();
    expect(ctx.membership).toEqual({ role: "staff", status: "active" });
    expect(deletes).toEqual([]);
  });

  it("owner con email SIN verificar → /?e=email_not_verified, sin revocar nada", async () => {
    sessionValue = { user: { id: "u1", name: "Ana", emailVerified: false } };
    membershipRow = { ...owner };
    expect(await destinationOf(requireBackofficeSession)).toBe(
      "/?e=email_not_verified",
    );
    // El gate BLOQUEA, no expulsa: la sesión sigue viva para poder verificar.
    expect(deletes).toEqual([]);
  });

  // Fail-closed: una fila vieja o un doble incompleto no puede ABRIR el gate.
  it("owner sin el campo `emailVerified` también rebota", async () => {
    sessionValue = { user: { id: "u1", name: "Ana" } };
    membershipRow = { ...owner };
    expect(await destinationOf(requireBackofficeSession)).toBe(
      "/?e=email_not_verified",
    );
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
