import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// better-auth necesita estas dos para construirse; valores de test sobre la rama aislada.
process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
if (enabled) process.env.DATABASE_URL = url;

import {
  type GrantSeed,
  dropGrantSeed,
  openSessionCookie,
  seedUnverifiedOwner,
} from "./onboarding-grant-support";
import {
  countOf,
  postTour,
  rawInsertViolation,
  setBusinessStatus,
  setVerified,
  tourTableColumns,
  tourTablePrimaryKey,
  tourTableUserColumns,
  toursOf,
  wipeTours,
} from "./onboarding-tours-support";
import { POST } from "../app/api/onboarding/tours/[tourId]/route";

/**
 * Spec 0084 — `POST /api/onboarding/tours/{tourId}` CONTRA LA BASE, con sesiones REALES.
 *
 * **Por qué contra Neon y no con dobles:** los tres invariantes de esta spec son de la BASE,
 * no del handler. El no-degradado de `completed` vive en el `where` del `do update`, la
 * idempotencia vive en la PK compuesta y el aislamiento vive en que el `business_id` salga del
 * guard — los tres son invisibles para un doble de `getDb()`. Además, con `ownerContext`
 * doblado un staff ACTIVO y un owner DESACTIVADO son el mismo `null`.
 *
 * El montaje vive en `onboarding-tours-support.ts` por el hook `file-size`; los oráculos
 * están todos acá.
 *
 * **Lo que NO prueba, declarado:** el `503 onboarding_unavailable` (es un `catch` de última
 * línea y su oráculo exigiría doblar la capa de datos — el owner todavía no decidió si se
 * cierra, y si lo decide se cierra para las dos rutas de una vez) y la concurrencia REAL de
 * dos `POST` simultáneos sobre la misma fila (lo resuelve el `on conflict` a nivel de PG y no
 * hay oráculo barato para una carrera de verdad; la idempotencia SECUENCIAL sí está cubierta).
 */
describe.skipIf(!enabled)("el progreso de los tours (spec 0084)", () => {
  let seedA: GrantSeed;
  let seedB: GrantSeed;
  let cookieA = "";
  let cookieB = "";

  beforeAll(async () => {
    seedA = await seedUnverifiedOwner("tours-a");
    seedB = await seedUnverifiedOwner("tours-b");
    // Los dos owners nacen con `emailVerified: false` (así nace toda cuenta de `auth/start`);
    // esta ruta SÍ lleva el paso 3, así que el camino feliz necesita el email verificado.
    await setVerified(seedA, true);
    await setVerified(seedB, true);
    cookieA = await openSessionCookie(seedA.ownerId, null);
    cookieB = await openSessionCookie(seedB.ownerId, null);
  }, 120_000);

  afterAll(async () => {
    await wipeTours(seedA.businessId);
    await wipeTours(seedB.businessId);
    await dropGrantSeed(seedA);
    await dropGrantSeed(seedB);
  }, 120_000);

  beforeEach(async () => {
    await wipeTours(seedA.businessId);
    await wipeTours(seedB.businessId);
  }, 120_000);

  // ── LA TABLA, VERIFICADA POR SQL ────────────────────────────────────────────────────

  /** DoD: la tabla existe **en la base**, con sus cuatro columnas y su PK compuesta — leído
   * de `information_schema`, NO del `.sql` de la migración. */
  it("`core.business_onboarding_tour` existe con sus columnas y su PK compuesta", async () => {
    expect(await tourTableColumns()).toEqual([
      { column_name: "business_id", data_type: "uuid", is_nullable: "NO" },
      { column_name: "tour_id", data_type: "text", is_nullable: "NO" },
      { column_name: "status", data_type: "text", is_nullable: "NO" },
      {
        column_name: "updated_at",
        data_type: "timestamp with time zone",
        is_nullable: "NO",
      },
    ]);
    expect(await tourTablePrimaryKey()).toEqual(["business_id", "tour_id"]);
  }, 120_000);

  /** **NO hay `user_id`**: el progreso es POR NEGOCIO (ADR 0078 §3) y la ausencia de esa
   * columna es la decisión, no un olvido. Aseverado contra la BASE, no contra el archivo. */
  it("la tabla NO tiene ninguna columna de usuario", async () => {
    expect(await tourTableUserColumns()).toEqual([]);
  }, 120_000);

  /** DoD: la migración **aplicada**, probada por su efecto — un `status` fuera de los dos
   * valores lo rechaza el `CHECK` de la base, no el handler. */
  it("un INSERT con `status = 'invalid'` lo rechaza el CHECK de la base", async () => {
    // `23514` (check_violation) **y** el nombre de la constraint: sin los dos, un `NOT NULL`
    // violado o una FK rota darían el mismo rojo y este caso no distinguiría nada.
    expect(
      await rawInsertViolation(seedA.businessId, "staff", "invalid"),
    ).toEqual({
      code: "23514",
      constraint: "business_onboarding_tour_status_check",
    });
    expect(await countOf(seedA.businessId)).toBe(0);
    // CONTROL de que el rechazo es del `status` y no de que la tabla o el negocio no existan:
    // el mismo INSERT con un valor del dominio entra.
    expect(await rawInsertViolation(seedA.businessId, "staff", "skipped")).toBe(
      null,
    );
    expect(await countOf(seedA.businessId)).toBe(1);
  }, 120_000);

  // ── LA ESCRITURA ────────────────────────────────────────────────────────────────────

  it("owner con email verificado + `skipped` → 200 y la fila queda en la base", async () => {
    const response = await postTour(cookieA, "catalog");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      tourId: "catalog",
      status: "skipped",
    });
    expect(await toursOf(seedA.businessId)).toEqual([
      { tour_id: "catalog", status: "skipped" },
    ]);
  }, 120_000);

  it("IDEMPOTENCIA: el mismo POST dos veces → 200 las dos y UNA sola fila", async () => {
    expect((await postTour(cookieA, "brand")).status).toBe(200);
    expect((await postTour(cookieA, "brand")).status).toBe(200);
    expect(await countOf(seedA.businessId)).toBe(1);
  }, 120_000);

  /**
   * ORÁCULO DE M2 — EL INVARIANTE DEL ADR 0078 §2: `completed` NUNCA se degrada a `skipped`.
   * Por HTTP el efecto es nulo (los dos proyectan `done: true`), así que si el `where` del
   * `do update` se cayera **nada se vería** y el dato que el owner pidió conservar —cuántos
   * saltearon— se destruiría en silencio. Sólo lo ve esta lectura por SQL.
   */
  it("NO DEGRADA: `completed` y después `skipped` deja la fila en `completed`", async () => {
    await postTour(cookieA, "program", JSON.stringify({ status: "completed" }));
    const second = await postTour(
      cookieA,
      "program",
      JSON.stringify({ status: "skipped" }),
    );
    expect(second.status).toBe(200);
    expect(await toursOf(seedA.businessId)).toEqual([
      { tour_id: "program", status: "completed" },
    ]);
  }, 120_000);

  it("SÍ MEJORA: `skipped` y después `completed` deja la fila en `completed`", async () => {
    await postTour(cookieA, "program", JSON.stringify({ status: "skipped" }));
    await postTour(cookieA, "program", JSON.stringify({ status: "completed" }));
    expect(await toursOf(seedA.businessId)).toEqual([
      { tour_id: "program", status: "completed" },
    ]);
  }, 120_000);

  /**
   * ORÁCULO DE M3 — EL AISLAMIENTO. El cuerpo lleva un `businessId` ajeno **a propósito**: es
   * exactamente el parámetro con el que un owner escribiría el progreso de otro negocio si el
   * handler lo leyera del cuerpo en vez del guard (ADR 0070 §15.3).
   */
  it("el `businessId` sale del GUARD: uno en el cuerpo no mueve la fila de negocio", async () => {
    const response = await POST(
      new Request("http://localhost:3001/api/onboarding/tours/staff", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: cookieA },
        body: JSON.stringify({
          status: "completed",
          businessId: seedB.businessId,
        }),
      }),
      { params: Promise.resolve({ tourId: "staff" }) },
    );
    expect(response.status).toBe(200);
    expect(await toursOf(seedA.businessId)).toEqual([
      { tour_id: "staff", status: "completed" },
    ]);
    expect(await toursOf(seedB.businessId)).toEqual([]);
  }, 120_000);

  it("dos negocios conviven con el MISMO `tour_id` (lo permite la PK compuesta)", async () => {
    await postTour(cookieA, "staff", JSON.stringify({ status: "completed" }));
    await postTour(cookieB, "staff", JSON.stringify({ status: "skipped" }));
    expect(await toursOf(seedA.businessId)).toEqual([
      { tour_id: "staff", status: "completed" },
    ]);
    expect(await toursOf(seedB.businessId)).toEqual([
      { tour_id: "staff", status: "skipped" },
    ]);
  }, 120_000);

  // ── LOS FALLOS ──────────────────────────────────────────────────────────────────────

  /**
   * ORÁCULO DE M4 — el `tourId` se valida contra `ONBOARDING_TOURS`, y lo pide un owner
   * AUTENTICADO (si no, el test no distingue el 404 del 401/403). Las dos mitades importan:
   * el `404` **y** que no quede fila basura en la base.
   */
  it("`404 unknown_tour` con un `tourId` inventado, por un owner autenticado", async () => {
    // Las tres en UNA aserción a propósito: en `expect`s separados, vitest aborta el caso en
    // el primero que falla y la mitad «no quedó fila basura» NUNCA se llega a evaluar —
    // medido bajo la mutación M4. Así las dos mitades del oráculo salen en el mismo diff.
    const response = await postTour(cookieA, "tour-inventado");
    expect({
      status: response.status,
      code: (await response.json()).code,
      filas: await countOf(seedA.businessId),
    }).toEqual({ status: 404, code: "unknown_tour", filas: 0 });
  }, 120_000);

  /**
   * ORÁCULO DE M5 — el `unknown_tour` se evalúa DESPUÉS del guard. Al revés, un desconocido
   * sondearía qué ids de tour existen: `404` para los inventados, `401` para los reales.
   */
  it("sin sesión y con un `tourId` inventado → 401 `unauthorized`, NUNCA 404", async () => {
    const response = await postTour(null, "tour-inventado");
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("unauthorized");
  }, 120_000);

  /**
   * ORÁCULO DE M1 — EL PUNTO DE LA SPEC: esta ruta SÍ lleva el paso 3, al revés del checklist.
   * Y las dos mitades importan: el `403` **y** que no se haya escrito nada.
   */
  it("owner con el email SIN verificar → 403 `email_not_verified` y NO escribe", async () => {
    await setVerified(seedA, false);
    try {
      const response = await postTour(cookieA, "staff");
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("email_not_verified");
      expect(await countOf(seedA.businessId)).toBe(0);
    } finally {
      await setVerified(seedA, true);
    }
  }, 120_000);

  it("negocio `suspended` → `business_suspended` con motivo; `closed` → `business_closed`", async () => {
    await setBusinessStatus(seedA, "suspended", "Pago rechazado");
    try {
      const body = await (await postTour(cookieA, "staff")).json();
      expect(body.code).toBe("business_suspended");
      expect(body.suspensionReason).toBe("Pago rechazado");
      await setBusinessStatus(seedA, "closed", null);
      const closed = await (await postTour(cookieA, "staff")).json();
      expect(closed.code).toBe("business_closed");
      expect(closed.suspensionReason).toBeUndefined();
    } finally {
      await setBusinessStatus(seedA, "active", null);
    }
    expect(await countOf(seedA.businessId)).toBe(0);
  }, 120_000);

  it.each([
    ["sin cuerpo", null],
    ["un cuerpo ilegible", "{no-json"],
    ["`status` ausente", "{}"],
    ["`status` desconocido", JSON.stringify({ status: "done" })],
    ["`status` booleano", JSON.stringify({ status: true })],
    ["un cuerpo que no es objeto", JSON.stringify("skipped")],
  ])(
    "400 `invalid_body` con %s",
    async (_caso, body) => {
      const response = await postTour(cookieA, "staff", body);
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("invalid_body");
      expect(await countOf(seedA.businessId)).toBe(0);
    },
    120_000,
  );
});
