import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// better-auth necesita estas dos para construirse; valores de test sobre la rama aislada.
process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
// getDb() lee DATABASE_URL de forma perezosa; apuntarlo a la rama aislada.
if (enabled) process.env.DATABASE_URL = url;

/**
 * Spec 0069 §D1 y §D2 — el alta del negocio CONTRA LA BASE.
 *
 * Geoapify va doblado (`verifyLocation`) porque pega contra un proveedor real por red;
 * **`isSupportedCountryCode` NO se dobla**: es justo la función que esta spec cambia al
 * sumar México, así que doblarla haría pasar el test por el motivo equivocado.
 *
 * Lo que sólo se puede medir con base de verdad:
 *  - la fila persiste el `category_gcid` que mandó el cliente (columna nueva, 0035);
 *  - un alta con `MX` persiste `currency_code = 'MXN'`.
 */
vi.mock("./location-providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./location-providers")>();
  return {
    ...actual,
    verifyLocation: async (_selection: unknown, countryCode: unknown) => ({
      source: "provider_verified" as const,
      provider: "geoapify" as const,
      providerPlaceId: "place-doble",
      label: "Calle Falsa 123",
      longitude: "-79.0000000",
      latitude: "-2.9000000",
      countryCode: String(countryCode),
      snapshot: { doble: true },
      attribution: "© OpenStreetMap contributors, © Geoapify",
    }),
  };
});

import { getDb } from "./db";
import {
  businesses,
  locationVerifications,
  locations,
  memberships,
  ownerProfiles,
  subscriptions,
  users,
} from "./schema";
import { openMerchantSession } from "./merchant-session";
import { POST } from "../app/api/onboarding/business/route";

const address = {
  label: "Calle Falsa 123",
  provider: "geoapify",
  longitude: -79,
  latitude: -2.9,
  featureId: "f1",
};

describe.skipIf(!enabled)("alta del negocio contra Neon (spec 0069)", () => {
  const ownerId = `onb-biz-${randomUUID()}`;
  let cookie = "";
  const created: string[] = [];

  const post = (body: unknown) =>
    POST(
      new Request("http://localhost:3001/api/onboarding/business", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify(body),
      }),
    );

  const payload = (overrides: Record<string, unknown> = {}) => ({
    name: `Negocio ${randomUUID().slice(0, 8)}`,
    categoryGcid: "gcid:cafe",
    countryCode: "EC",
    timezone: "America/Guayaquil",
    locationName: "Matriz",
    address,
    ...overrides,
  });

  const rowOf = async (businessId: string) => {
    const [row] = await getDb()
      .select({
        categoryGcid: businesses.categoryGcid,
        currencyCode: businesses.currencyCode,
        countryCode: businesses.countryCode,
      })
      .from(businesses)
      .where(eq(businesses.id, businessId));
    return row ?? null;
  };

  /** El alta es «una por owner» (409 si ya tiene negocio): se limpia entre casos. */
  const wipe = async () => {
    const db = getDb();
    const ids = created.splice(0);
    if (!ids.length) return;
    const rows = await db
      .select({ id: locations.id })
      .from(locations)
      .where(inArray(locations.businessId, ids));
    if (rows.length) {
      await db.delete(locationVerifications).where(
        inArray(
          locationVerifications.locationId,
          rows.map((row) => row.id),
        ),
      );
    }
    await db.delete(locations).where(inArray(locations.businessId, ids));
    await db
      .delete(subscriptions)
      .where(inArray(subscriptions.businessId, ids));
    await db.delete(memberships).where(inArray(memberships.businessId, ids));
    await db.delete(businesses).where(inArray(businesses.id, ids));
  };

  beforeAll(async () => {
    await getDb()
      .insert(users)
      .values({
        id: ownerId,
        name: "Owner Alta",
        email: `${ownerId}@example.test`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    cookie = (await openMerchantSession(ownerId)).split(";")[0];
  }, 60_000);

  afterEach(wipe, 60_000);

  afterAll(async () => {
    const db = getDb();
    await wipe();
    await db.delete(ownerProfiles).where(eq(ownerProfiles.userId, ownerId));
    await db.delete(users).where(eq(users.id, ownerId));
  }, 60_000);

  const noBusinessYet = async () => {
    const rows = await getDb()
      .select({ id: memberships.businessId })
      .from(memberships)
      .where(eq(memberships.userId, ownerId));
    expect(rows).toHaveLength(0);
  };

  it("sin categoryGcid responde 400 y no escribe ninguna fila", async () => {
    const body = payload();
    delete (body as Record<string, unknown>).categoryGcid;
    const response = await post(body);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("categoría");
    await noBusinessYet();
  }, 60_000);

  // === MUTACIÓN #1 ===
  it.each([
    ["gcid:inventado"],
    ["restaurant"],
    ["gcid:store"],
    [""],
    [42],
    [null],
  ])(
    "una categoría fuera de la lista (%j) responde 400 y no escribe nada",
    async (value) => {
      const response = await post(payload({ categoryGcid: value }));
      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("categoría");
      await noBusinessYet();
    },
    60_000,
  );

  it("con una categoría válida responde 201 y la FILA lleva ese category_gcid", async () => {
    const response = await post(payload({ categoryGcid: "gcid:pharmacy" }));
    expect(response.status).toBe(201);
    const { businessId } = await response.json();
    created.push(businessId);
    expect(await rowOf(businessId)).toMatchObject({
      categoryGcid: "gcid:pharmacy",
      countryCode: "EC",
      currencyCode: "USD",
    });
  }, 60_000);

  it("un alta con MX persiste currency_code = 'MXN'", async () => {
    const response = await post(
      payload({ countryCode: "MX", timezone: "America/Mexico_City" }),
    );
    expect(response.status).toBe(201);
    const { businessId } = await response.json();
    created.push(businessId);
    expect(await rowOf(businessId)).toMatchObject({
      countryCode: "MX",
      currencyCode: "MXN",
      categoryGcid: "gcid:cafe",
    });
  }, 60_000);

  /**
   * LIMITE HEREDADO, medido y declarado en el contrato (§2): `await request.json()` corre
   * FUERA de todo `try`, así que un cuerpo que no es JSON hace que el handler RECHACE —y
   * Next lo traduce a un 500 sin `code`— en vez de contestar el 400 que sería correcto.
   * Es anterior a la spec 0069 y ésta no lo arregla; el test existe para que el límite no
   * sea una suposición y para que el día que se arregle, esta línea se ponga roja.
   */
  it("LÍMITE: un cuerpo que no es JSON hace que el handler rechace (no da 400)", async () => {
    await expect(
      POST(
        new Request("http://localhost:3001/api/onboarding/business", {
          method: "POST",
          headers: { "content-type": "application/json", cookie },
          body: "esto no es json",
        }),
      ),
    ).rejects.toThrow();
    await noBusinessYet();
  }, 60_000);

  it("un país que sigue SIN estar soportado (ES) responde 400", async () => {
    const response = await post(
      payload({ countryCode: "ES", timezone: "Europe/Madrid" }),
    );
    expect(response.status).toBe(400);
    await noBusinessYet();
  }, 60_000);
});
