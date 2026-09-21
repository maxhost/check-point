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
import { memberships, users } from "./schema";
import { createStaff } from "./staff-create";
import {
  type GrantSeed,
  dropGrantSeed,
  openSessionCookie,
  seedUnverifiedOwner,
} from "./onboarding-grant-support";
import {
  type ChecklistItemJson,
  getChecklist,
  seedTour,
  setBusinessStatus,
  setVerified,
  wipeTours,
} from "./onboarding-checklist-support";

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
 * **Spec 0085 — y ACA viven los tres casos del `done` de un tour**: `completed` → `true`,
 * **`skipped` → `true`** y sin fila → `false`, mas el AISLAMIENTO entre negocios. Los cuatro
 * son de la BASE y ningun doble los puede falsificar: el `skipped` es una decision textual del
 * owner que solo se ve con una fila real, y el aislamiento vive en que el `business_id` salga
 * del guard.
 *
 * **Lo que este archivo NO prueba, declarado:** el `sort` por `position` con entradas que
 * lleguen DESORDENADAS —el catalogo real sale ordenado, asi que desde la base no se puede
 * falsificar; su oraculo son las entradas sinteticas de `onboarding/checklist.test.ts`— y el
 * `503 onboarding_unavailable`, que **ya NO esta declarado afuera**: lo cierra
 * `onboarding-503.test.ts` con dobles (status, `code`, que no se invente un desenlace
 * positivo y que el `catch` NO filtre el mensaje de la excepcion).
 */
describe.skipIf(!enabled)("el checklist del onboarding (spec 0085)", () => {
  let seed: GrantSeed;
  /** El SEGUNDO negocio, que existe solo para el caso de aislamiento: sus filas de progreso
   * son las que este owner NO tiene que ver. */
  let seedAjeno: GrantSeed;
  let cookieOwner = "";
  let cookieStaff = "";
  let staffUserId = "";

  beforeAll(async () => {
    seed = await seedUnverifiedOwner("checklist");
    seedAjeno = await seedUnverifiedOwner("checklist-ajeno");
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
    await wipeTours(seed.businessId);
    await wipeTours(seedAjeno.businessId);
    await dropGrantSeed(seed);
    await dropGrantSeed(seedAjeno);
  }, 120_000);

  /**
   * ORACULO DE M1 — EL CASO CENTRAL. El owner de este seed nace con
   * `emailVerified: false`, que es como nace toda cuenta de `auth/start`.
   */
  it("un owner SIN el email verificado recibe 200 con su item pendiente", async () => {
    await setVerified(seed, false);
    await wipeTours(seed.businessId);
    const response = await getChecklist(cookieOwner);
    expect(response.status).toBe(200);
    const body = await response.json();
    // La asercion que hace fallar a la M1 por el motivo correcto: no hay `code` de fallo en
    // el cuerpo, y el item viene pendiente.
    expect(body.code).toBeUndefined();
    expect(body.locale).toBe("es");
    expect(body.items[0]).toMatchObject({
      id: "verify-email",
      position: 1,
      required: true,
      done: false,
      anchor: "verify-email",
    });
  }, 120_000);

  /**
   * SPEC 0085 — LOS CINCO ITEMS, EN ORDEN, SERIALIZADOS POR LA RUTA REAL. Es el oraculo de
   * la M5 (sacar el `sort`) del lado de la integracion, el de la M4 (`required` en un tour) y
   * la mitad «sin fila → `done: false`» de la M2: este negocio no tiene ni una fila de
   * progreso.
   *
   * El vector entero en un solo `toEqual` y no cinco `expect` sueltos: partido, el primero que
   * falla aborta el caso y las otras cuatro filas nunca se evaluan.
   */
  it("los CINCO items salen en orden, con `verify-email` como unico `required`", async () => {
    await wipeTours(seed.businessId);
    const body = await (await getChecklist(cookieOwner)).json();
    expect(
      body.items.map((item: ChecklistItemJson) => [
        item.position,
        item.id,
        item.anchor,
        item.required,
        item.done,
      ]),
    ).toEqual([
      [1, "verify-email", "verify-email", true, false],
      [2, "staff", "staff", false, false],
      [3, "catalog", "catalog", false, false],
      [4, "program", "program", false, false],
      [5, "brand", "brand", false, false],
    ]);
  }, 120_000);

  /** ORACULO DE M4 (`done: () => false`): el mismo owner, con el hecho cambiado
   * en la base, tiene que verlo `done: true`. Junto con el caso de arriba prueba que `done`
   * LEE la sesion y no devuelve una constante. */
  it("un owner CON el email verificado recibe 200 y el mismo item en `done: true`", async () => {
    await setVerified(seed, true);
    const response = await getChecklist(cookieOwner);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(5);
    expect(body.items[0]).toMatchObject({
      id: "verify-email",
      position: 1,
      required: true,
      done: true,
    });
    await setVerified(seed, false);
  }, 120_000);

  /** EL CONJUNTO EXACTO DE CLAVES QUE SALE POR HTTP, item por item — **y aca se asevera que
   * el segundo eje YA NO VIAJA** (spec 0085). Es una lista cerrada: el dia que alguien vuelva
   * a emitir el campo borrado, o agregue uno, este `toEqual` lo ve. */
  it("cada item serializado trae las SIETE claves del contrato, y ninguna mas", async () => {
    const body = await (await getChecklist(cookieOwner)).json();
    for (const item of body.items) {
      expect(Object.keys(item).sort()).toEqual([
        "anchor",
        "body",
        "done",
        "id",
        "position",
        "required",
        "title",
      ]);
    }
  }, 120_000);

  it("sin sesion → 401 `unauthorized`", async () => {
    const response = await getChecklist(null);
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
    const response = await getChecklist(cookieStaff);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe("not_owner");
    expect(body.code).not.toBe("email_not_verified");
  }, 120_000);

  /** ORACULO DE M2, mitad `suspended` — el paso 4 se pierde junto con el guard. El owner
   * sigue sin verificar: el 403 viene del eje `status`, no del email. */
  it("un negocio `suspended` → 403 `business_suspended`, con su motivo", async () => {
    await setBusinessStatus(seed, "suspended", "Pago rechazado");
    try {
      const response = await getChecklist(cookieOwner);
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.code).toBe("business_suspended");
      expect(body.suspensionReason).toBe("Pago rechazado");
    } finally {
      await setBusinessStatus(seed, "active", null);
    }
  }, 120_000);

  /** ORACULO DE M2, mitad `closed`. */
  it("un negocio `closed` → 403 `business_closed`", async () => {
    await setBusinessStatus(seed, "closed", null);
    try {
      const response = await getChecklist(cookieOwner);
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("business_closed");
    } finally {
      await setBusinessStatus(seed, "active", null);
    }
  }, 120_000);

  /** CONTROL DE QUE EL 403 DE ARRIBA ERA DEL EJE `status` Y NO UN ESTADO PEGADO: con el
   * negocio de vuelta en `active` y el email todavia sin verificar, la misma cookie vuelve a
   * recibir 200. */
  it("con el negocio de vuelta en `active`, la misma cookie vuelve a recibir 200", async () => {
    const response = await getChecklist(cookieOwner);
    expect(response.status).toBe(200);
    expect((await response.json()).items[0].done).toBe(false);
  }, 120_000);

  // ── EL `done` DE UN TOUR, CONTRA LA BASE (spec 0085) ────────────────────────────────

  /**
   * ORACULO DE LA M1 — **`skipped` cuenta como `done`**, que es la decision textual del owner
   * (*«si, un merchant puede completar el onboarding con skip de todo»*, ADR 0078 §2) y el
   * UNICO oraculo que la sostiene. Van los tres estados en la misma respuesta: uno
   * `completed`, uno `skipped` y dos sin fila. Contar solo `completed` pone rojo la fila de
   * `program`; dar `done` por constante pone rojas las otras.
   */
  it("`completed` y `skipped` proyectan los dos `done: true`; sin fila queda `false`", async () => {
    await wipeTours(seed.businessId);
    await seedTour(seed.businessId, "catalog", "completed");
    await seedTour(seed.businessId, "program", "skipped");
    const body = await (await getChecklist(cookieOwner)).json();
    expect(
      body.items.map((item: ChecklistItemJson) => [item.id, item.done]),
    ).toEqual([
      ["verify-email", false],
      ["staff", false],
      ["catalog", true],
      ["program", true],
      ["brand", false],
    ]);
    // Y el JSON NO dice cual de los dos fue: la distincion se persiste, no se serializa.
    expect(Object.keys(body.items[2])).not.toContain("status");
  }, 120_000);

  /**
   * ORACULO DE LA M3 — EL AISLAMIENTO. El otro negocio tiene los CUATRO tours hechos y este
   * ninguno: una consulta que ignorara el `business_id` le mostraria a este el progreso del
   * otro. El control positivo va en la MISMA respuesta —una fila propia, que si tiene que
   * verse— para que un `done` constante en `false` tampoco pase.
   */
  it("un negocio NO ve el progreso de otro (y si ve el suyo)", async () => {
    await wipeTours(seed.businessId);
    await wipeTours(seedAjeno.businessId);
    for (const tourId of ["staff", "catalog", "program", "brand"])
      await seedTour(seedAjeno.businessId, tourId, "completed");
    await seedTour(seed.businessId, "brand", "skipped");
    const body = await (await getChecklist(cookieOwner)).json();
    expect(
      body.items.map((item: ChecklistItemJson) => [item.id, item.done]),
    ).toEqual([
      ["verify-email", false],
      ["staff", false],
      ["catalog", false],
      ["program", false],
      ["brand", true],
    ]);
  }, 120_000);
});
