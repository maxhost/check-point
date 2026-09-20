import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// better-auth necesita estas dos para construirse; valores de test sobre la rama aislada.
process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "./db";
import { businesses, memberships, users } from "./schema";
import { createStaff } from "./staff-create";
import {
  type GrantSeed,
  dropGrantSeed,
  openSessionCookie,
  seedUnverifiedOwner,
} from "./onboarding-grant-support";
import { GET } from "../app/api/onboarding/checklist/route";

/**
 * Spec 0083 §D3 — `GET /api/onboarding/checklist` CONTRA LA BASE, con sesiones REALES.
 *
 * **EL CASO CENTRAL DE LA SPEC ES EL PRIMERO: un owner con el email SIN verificar recibe 200**
 * con su item en `done: false`. Es la prueba de que la ruta **no se gatea a si misma**, y es
 * el oraculo de la mutacion M1 (cambiar `requireApiOwnerSinGateDeEmail` por su hermana
 * `requireApiOwner`, o sea ponerle el paso 3). Si esa mutacion no muerde, el resto de la spec
 * no importa.
 *
 * **Por que contra Neon y no con `ownerContext` doblado:** con el doble, un staff ACTIVO y un
 * owner DESACTIVADO son el mismo `null` —el mismo argumento que `billing-routes-auth`—, asi
 * que el 403 `not_owner` del integrante pasaria en verde aunque el filtro `role='owner'` se
 * hubiera perdido. Aca la sesion se abre con `openMerchantSession` de verdad, la cookie viaja
 * en el header y `ownerContext` corre contra las `memberships` posta.
 *
 * **Lo que este archivo NO prueba, declarado:** el `sort` por `position` y la independencia de
 * `required`/`blocking`. Con UN item en el catalogo no se pueden falsificar desde la base; sus
 * oraculos son las entradas sinteticas de `onboarding/checklist.test.ts`.
 */
describe.skipIf(!enabled)("el checklist del onboarding (spec 0083 §D3)", () => {
  let seed: GrantSeed;
  let cookieOwner = "";
  let cookieStaff = "";
  let staffUserId = "";

  const get = (cookie: string | null) =>
    GET(
      new Request("http://localhost:3001/api/onboarding/checklist", {
        headers: cookie ? { cookie } : {},
      }),
    );

  const setVerified = (emailVerified: boolean) =>
    getDb()
      .update(users)
      .set({ emailVerified })
      .where(eq(users.id, seed.ownerId));

  const setBusinessStatus = (status: string, suspensionReason: string | null) =>
    getDb()
      .update(businesses)
      .set({ status, suspensionReason })
      .where(eq(businesses.id, seed.businessId));

  beforeAll(async () => {
    seed = await seedUnverifiedOwner("checklist");
    cookieOwner = await openSessionCookie(seed.ownerId, null);
    // El integrante: usuario propio, membresia `role='staff'` del MISMO negocio y su
    // sesion real. Su email es el sintetico `@staff.invalid`, que es justamente el motivo
    // por el que el checklist es owner-only (ADR 0077 §6).
    const { staff } = await createStaff(
      { id: seed.businessId, slug: seed.slug },
      { name: "Integrante Checklist" },
    );
    staffUserId = staff.userId;
    cookieStaff = await openSessionCookie(staffUserId, null);
  }, 120_000);

  afterAll(async () => {
    await getDb()
      .delete(memberships)
      .where(eq(memberships.userId, staffUserId));
    await getDb().delete(users).where(eq(users.id, staffUserId));
    await dropGrantSeed(seed);
  }, 120_000);

  /**
   * ORACULO DE M1 — EL CASO CENTRAL. El owner de este seed nace con
   * `emailVerified: false`, que es como nace toda cuenta de `auth/start`.
   */
  it("un owner SIN el email verificado recibe 200 con su item pendiente", async () => {
    await setVerified(false);
    const response = await get(cookieOwner);
    expect(response.status).toBe(200);
    const body = await response.json();
    // La asercion que hace fallar a la M1 por el motivo correcto: no hay `code` de fallo en
    // el cuerpo, y el item viene pendiente.
    expect(body.code).toBeUndefined();
    expect(body.locale).toBe("es");
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: "verify-email",
      position: 1,
      required: true,
      blocking: true,
      done: false,
      anchor: "verify-email",
    });
  }, 120_000);

  /** ORACULO DE M4 (`done: () => false`): el mismo owner, con el hecho cambiado
   * en la base, tiene que verlo `done: true`. Junto con el caso de arriba prueba que `done`
   * LEE la sesion y no devuelve una constante. */
  it("un owner CON el email verificado recibe 200 y el mismo item en `done: true`", async () => {
    await setVerified(true);
    const response = await get(cookieOwner);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: "verify-email",
      position: 1,
      required: true,
      blocking: true,
      done: true,
    });
    await setVerified(false);
  }, 120_000);

  /** `required` y `blocking` viajan como campos SEPARADOS en el JSON: dos claves propias, no
   * una derivada. (Que no sean alias lo prueba la funcion pura; que las dos EXISTAN en la
   * respuesta se prueba aca.) */
  it("`required` y `blocking` son dos claves propias del item serializado", async () => {
    const body = await (await get(cookieOwner)).json();
    expect(Object.keys(body.items[0]).sort()).toEqual([
      "anchor",
      "blocking",
      "body",
      "done",
      "id",
      "position",
      "required",
      "title",
    ]);
  }, 120_000);

  it("sin sesion → 401 `unauthorized`", async () => {
    const response = await get(null);
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("unauthorized");
  }, 120_000);

  /**
   * ORACULO DE M2 (sacar el guard entero y resolver la sesion a mano, sin owner ni `status`:
   * «total, es una lectura»). El integrante tiene sesion REAL y membresia
   * `role='staff'` activa: si el paso 2 se cayera, recibiria 200 con el checklist.
   *
   * **Y el `code` importa tanto como el status:** tiene que ser `not_owner`, NUNCA el del
   * email — esta ruta no lo emite en ningun camino.
   */
  it("un integrante (`role='staff'`) → 403 `not_owner`, y NO el codigo del email", async () => {
    const response = await get(cookieStaff);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe("not_owner");
    expect(body.code).not.toBe("email_not_verified");
  }, 120_000);

  /** ORACULO DE M2, mitad `suspended` — el paso 4 se pierde junto con el guard. El owner
   * sigue sin verificar: el 403 viene del eje `status`, no del email. */
  it("un negocio `suspended` → 403 `business_suspended`, con su motivo", async () => {
    await setBusinessStatus("suspended", "Pago rechazado");
    try {
      const response = await get(cookieOwner);
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.code).toBe("business_suspended");
      expect(body.suspensionReason).toBe("Pago rechazado");
    } finally {
      await setBusinessStatus("active", null);
    }
  }, 120_000);

  /** ORACULO DE M2, mitad `closed`. */
  it("un negocio `closed` → 403 `business_closed`", async () => {
    await setBusinessStatus("closed", null);
    try {
      const response = await get(cookieOwner);
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("business_closed");
    } finally {
      await setBusinessStatus("active", null);
    }
  }, 120_000);

  /** CONTROL DE QUE EL 403 DE ARRIBA ERA DEL EJE `status` Y NO UN ESTADO PEGADO: con el
   * negocio de vuelta en `active` y el email todavia sin verificar, la misma cookie vuelve a
   * recibir 200. */
  it("con el negocio de vuelta en `active`, la misma cookie vuelve a recibir 200", async () => {
    const response = await get(cookieOwner);
    expect(response.status).toBe(200);
    expect((await response.json()).items[0].done).toBe(false);
  }, 120_000);
});
