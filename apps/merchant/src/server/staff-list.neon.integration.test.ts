import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// better-auth necesita estas dos para construirse; valores de test sobre la rama aislada.
process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
// getDb() lee DATABASE_URL de forma perezosa; apuntarlo a la rama aislada.
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "./db";
import { businesses, memberships, users } from "./schema";
import { openMerchantSession } from "./merchant-session";
import { createStaff } from "./staff-create";
import { GET } from "../app/api/staff/route";

/**
 * Spec 0068 §1 — `GET /api/staff` CONTRA LA BASE, con sesiones REALES.
 *
 * Lo que ningún test con la base doblada puede dar:
 *
 * 1. **El aislamiento por negocio**: el `businessId` sale de la sesión, así que un owner de
 *    A no ve un solo integrante de B. Con `ownerContext` doblado los dos negocios serían el
 *    mismo objeto y un `listStaff` apuntado a otro id pasaría en verde.
 * 2. **El orden por `createdAt` ascendente**: las filas se siembran con timestamps que NO
 *    siguen el orden de inserción, así que un `ORDER BY` perdido devolvería el orden físico.
 * 3. **Los 4 actores del gate** con cookies emitidas por `internalAdapter.createSession`.
 *
 * **El seed NO pone `emailVerified: true` por default**: cada owner declara el suyo. Ese
 * default es exactamente lo que dejó vivo el agujero del gate en `billing-routes-auth.neon`
 * (spec 0067), porque el caso «owner sin verificar» nunca se ejercitaba.
 */
const listWith = (cookie?: string, query = "") =>
  GET(
    new Request(`http://localhost:3001/api/staff${query}`, {
      method: "GET",
      headers: cookie ? { cookie } : {},
    }),
  );

describe.skipIf(!enabled)("GET /api/staff contra Neon (spec 0068 §1)", () => {
  const ids = {
    ownerA: `list-int-a-${randomUUID()}`,
    ownerB: `list-int-b-${randomUUID()}`,
    ownerEmpty: `list-int-c-${randomUUID()}`,
    ownerUnverified: `list-int-u-${randomUUID()}`,
  };
  const businessIds = {
    a: randomUUID(),
    b: randomUUID(),
    empty: randomUUID(),
    unverified: randomUUID(),
  };
  const slugs = {
    a: `listtest-a-${businessIds.a.slice(0, 8)}`,
    b: `listtest-b-${businessIds.b.slice(0, 8)}`,
    empty: `listtest-c-${businessIds.empty.slice(0, 8)}`,
    unverified: `listtest-u-${businessIds.unverified.slice(0, 8)}`,
  };
  /** Los `user.id` del staff sembrado, para poder limpiarlos al final. */
  const staffIds: string[] = [];
  let cookieA = "";
  let cookieB = "";
  let cookieEmpty = "";
  let cookieUnverified = "";
  let cookieStaffOfA = "";

  const seedOwner = async (
    userId: string,
    businessId: string,
    slug: string,
    /** SIN default a propósito: el caso del gate depende de esto. */
    emailVerified: boolean,
  ) => {
    const db = getDb();
    await db.insert(users).values({
      id: userId,
      name: "Owner List",
      email: `${userId}@example.test`,
      emailVerified,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(businesses).values({
      id: businessId,
      name: "List QA",
      slug,
      countryCode: "EC",
      timezone: "America/Guayaquil",
    });
    await db
      .insert(memberships)
      .values({ businessId, userId, role: "owner", status: "active" });
  };

  /** Da de alta un integrante y le fija un `created_at` EXPLÍCITO en la membresía. */
  const seedStaff = async (
    businessId: string,
    slug: string,
    name: string,
    createdAt: Date,
  ): Promise<string> => {
    const { staff } = await createStaff({ id: businessId, slug }, { name });
    staffIds.push(staff.userId);
    await getDb()
      .update(memberships)
      .set({ createdAt })
      .where(
        and(
          eq(memberships.businessId, businessId),
          eq(memberships.userId, staff.userId),
        ),
      );
    return staff.userId;
  };

  beforeAll(async () => {
    await seedOwner(ids.ownerA, businessIds.a, slugs.a, true);
    await seedOwner(ids.ownerB, businessIds.b, slugs.b, true);
    await seedOwner(ids.ownerEmpty, businessIds.empty, slugs.empty, true);
    await seedOwner(
      ids.ownerUnverified,
      businessIds.unverified,
      slugs.unverified,
      false,
    );

    // El orden de INSERCIÓN es Uno → Dos → Tres, y los `created_at` los mandan al revés:
    // si la consulta pierde el `ORDER BY`, Postgres devuelve el orden físico y el caso del
    // orden se pone rojo.
    const staffOfA = await seedStaff(
      businessIds.a,
      slugs.a,
      "Uno",
      new Date("2026-02-01T10:00:00.000Z"),
    );
    await seedStaff(
      businessIds.a,
      slugs.a,
      "Dos",
      new Date("2026-03-01T10:00:00.000Z"),
    );
    await seedStaff(
      businessIds.a,
      slugs.a,
      "Tres",
      new Date("2026-01-01T10:00:00.000Z"),
    );
    await seedStaff(
      businessIds.b,
      slugs.b,
      "Bravo",
      new Date("2026-01-15T10:00:00.000Z"),
    );

    const cookie = async (userId: string) =>
      (await openMerchantSession(userId)).split(";")[0];
    cookieA = await cookie(ids.ownerA);
    cookieB = await cookie(ids.ownerB);
    cookieEmpty = await cookie(ids.ownerEmpty);
    cookieUnverified = await cookie(ids.ownerUnverified);
    cookieStaffOfA = await cookie(staffOfA);
  }, 120_000);

  afterAll(async () => {
    const db = getDb();
    for (const businessId of Object.values(businessIds)) {
      await db
        .delete(memberships)
        .where(eq(memberships.businessId, businessId));
      await db.delete(businesses).where(eq(businesses.id, businessId));
    }
    for (const userId of [...Object.values(ids), ...staffIds]) {
      await db.delete(users).where(eq(users.id, userId));
    }
  }, 60_000);

  it("el owner verificado ve a SU equipo, ordenado por `createdAt` ascendente", async () => {
    const response = await listWith(cookieA);
    expect(response.status).toBe(200);
    const { staff } = (await response.json()) as {
      staff: Array<Record<string, string>>;
    };
    expect(staff.map((row) => row.identifier)).toEqual([
      `tres@${slugs.a}`,
      `uno@${slugs.a}`,
      `dos@${slugs.a}`,
    ]);
    expect(staff.every((row) => row.role === "staff")).toBe(true);
    expect(staff.every((row) => row.status === "active")).toBe(true);
  }, 60_000);

  it("un owner de A NO ve a los integrantes de B (y al revés)", async () => {
    const a = (await (await listWith(cookieA)).json()) as {
      staff: Array<{ identifier: string }>;
    };
    const b = (await (await listWith(cookieB)).json()) as {
      staff: Array<{ identifier: string }>;
    };
    expect(a.staff.some((row) => row.identifier.endsWith(`@${slugs.b}`))).toBe(
      false,
    );
    expect(b.staff.map((row) => row.identifier)).toEqual([`bravo@${slugs.b}`]);
  }, 60_000);

  it("un `?businessId=` en la query se IGNORA: el negocio sale de la sesión", async () => {
    // El parámetro GRITA el negocio de B a propósito. Es la preimagen plausible de la fuga:
    // un `GET` que lo honrara le entregaría a A el equipo de B sin tocar ninguna sesión.
    const response = await listWith(cookieA, `?businessId=${businessIds.b}`);
    expect(response.status).toBe(200);
    const { staff } = (await response.json()) as {
      staff: Array<{ identifier: string }>;
    };
    expect(staff.map((row) => row.identifier)).toEqual([
      `tres@${slugs.a}`,
      `uno@${slugs.a}`,
      `dos@${slugs.a}`,
    ]);
  }, 60_000);

  it("un negocio sin integrantes devuelve `[]` con 200, no 404", async () => {
    const response = await listWith(cookieEmpty);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ staff: [] });
  }, 60_000);

  it("el cuerpo NO lleva el email sintético ni la clave `email`", async () => {
    // Spec 0068 §2: el sintético se persiste y no se serializa nunca. Se mira el TEXTO de
    // la respuesta, no el objeto ya parseado.
    const body = await (await listWith(cookieA)).text();
    expect(body).not.toContain("staff.invalid");
    expect(body).not.toContain('"email"');
    const { staff } = JSON.parse(body) as { staff: Array<object> };
    for (const row of staff) {
      expect(Object.keys(row).sort()).toEqual([
        "createdAt",
        "identifier",
        "name",
        "role",
        "status",
        "userId",
      ]);
    }
    // Y el sintético SÍ está en la base: lo que cambió es la serialización.
    const [row] = await getDb()
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, staffIds[0]));
    expect(row.email).toMatch(/@staff\.invalid$/);
  }, 60_000);

  it("un owner con el email SIN verificar → 403 `email_not_verified`", async () => {
    const response = await listWith(cookieUnverified);
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("email_not_verified");
  }, 60_000);

  it("un integrante ACTIVO → 403 `not_owner`, nunca `email_not_verified`", async () => {
    // El orden de los chequeos es la regla: el email de un integrante es sintético y nunca
    // se verifica, así que con el gate adelantado recibiría un código imposible de resolver.
    const response = await listWith(cookieStaffOfA);
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("not_owner");
  }, 60_000);

  it("sin sesión → 401 `unauthorized`", async () => {
    const response = await listWith();
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("unauthorized");
  }, 60_000);
});
