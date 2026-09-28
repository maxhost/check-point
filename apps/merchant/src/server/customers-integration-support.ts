import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  type Seed,
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  setBalance,
} from "./counter-integration-support";
import { getDb } from "./db";
import {
  businessCustomers,
  consumerAccounts,
  loyaltyPrograms,
  programMemberships,
} from "./schema";
import { resolveScan } from "./counter/resolve";
import { insertMembershipWithProjection } from "./customers/projection";

export { integrationEnabled };

/**
 * THE WORLD OF THE SPEC 0108 (§Plan de pruebas): businesses A, B and C. X in A and in B; Y only
 * in B; Z in A in an OLD (`inactive`) program and in the operational one; W in A only in an old
 * program. C has nobody. D has members but NO operational program (balance null for all).
 *
 * Every membership is written by the PRODUCTION writers (`resolveScan` auto-enroll, or
 * `insertMembershipWithProjection` for the historical alta in a program that no longer takes
 * altas), so the projection rows are the ones the app writes — not a hand-made copy.
 * Nothing here asserts: the oracles live in the tests.
 */
export type Person = {
  id: string;
  qrToken: string;
  phone: string;
  name: string;
};

export type CustomersWorld = {
  a: Seed;
  b: Seed;
  c: Seed;
  d: Seed;
  /** The old (`inactive`) program of A, and the one of D. */
  oldProgramA: string;
  oldProgramD: string;
  x: Person;
  y: Person;
  z: Person;
  w: Person;
};

function randomPhone(): string {
  return `+5939${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
}

export async function seedPerson(
  firstName: string,
  lastName: string,
): Promise<Person> {
  const qrToken = `qr-${randomUUID()}`;
  const phone = randomPhone();
  const [row] = await getDb()
    .insert(consumerAccounts)
    .values({
      phoneE164: phone,
      firstName,
      lastName,
      qrToken,
      webViewToken: `wv-${randomUUID()}`,
    })
    .returning({ id: consumerAccounts.id });
  return { id: row.id, qrToken, phone, name: `${firstName} ${lastName}` };
}

async function seedOldProgram(seed: Seed): Promise<string> {
  const id = randomUUID();
  await getDb()
    .insert(loyaltyPrograms)
    .values({
      id,
      businessId: seed.business.id,
      kind: "points",
      configuration: {},
      status: "inactive",
      termsMarkdown: "TOS",
      termsHash: "hash",
      createdBy: seed.userId,
      // A different `created_at` than the operational one: unique per business.
      createdAt: new Date(Date.now() - 86_400_000),
    });
  return id;
}

/** A historical alta in a program that does not take altas anymore — same writer as the app. */
export async function enrollInOld(
  seed: Seed,
  programId: string,
  person: Person,
): Promise<void> {
  await insertMembershipWithProjection({
    consumerId: person.id,
    programId,
    businessId: seed.business.id,
  });
}

export const seedPointsBusiness = (name: string) =>
  seedBusiness({
    name,
    kind: "points",
    mode: "per_amount",
    grant: 10,
    blockAmount: "1.00",
  });

export async function seedCustomersWorld(
  prefix: string,
): Promise<CustomersWorld> {
  const a = await seedPointsBusiness(`${prefix} A`);
  const b = await seedBusiness({
    name: `${prefix} B`,
    kind: "stamps",
    mode: "per_purchase",
    grant: 1,
    blockAmount: null,
    configuration: { unitName: "sellos", target: 10 },
  });
  const c = await seedPointsBusiness(`${prefix} C`);
  const d = await seedPointsBusiness(`${prefix} D`);
  const oldProgramA = await seedOldProgram(a);
  const oldProgramD = await seedOldProgram(d);
  // D keeps members but loses its operational program.
  await getDb()
    .update(loyaltyPrograms)
    .set({ status: "inactive" })
    .where(eq(loyaltyPrograms.id, d.programId));

  const x = await seedPerson("María", "López");
  const y = await seedPerson("Yolanda", "Quispe");
  const z = await seedPerson("Zoe", "Martínez");
  const w = await seedPerson("Walter", "Gómez");

  await resolveScan(a.business, x.qrToken);
  await resolveScan(b.business, x.qrToken);
  await resolveScan(b.business, y.qrToken);
  // Z: the OLD alta first, then the operational one — its first alta is the old one.
  await enrollInOld(a, oldProgramA, z);
  const zOperational = await resolveScan(a.business, z.qrToken);
  // Distinct balances per program: the list has to read the OPERATIONAL one (7), not the old (99).
  await setBalance(zOperational.membership.id, { points: 7 });
  await getDb()
    .update(programMemberships)
    .set({ pointsBalance: 99 })
    .where(
      and(
        eq(programMemberships.programId, oldProgramA),
        eq(programMemberships.consumerId, z.id),
      ),
    );
  await enrollInOld(a, oldProgramA, w);
  await enrollInOld(d, oldProgramD, x);
  await enrollInOld(d, d.programId, y);

  return { a, b, c, d, oldProgramA, oldProgramD, x, y, z, w };
}

export async function dropCustomersWorld(world: CustomersWorld) {
  for (const seed of [world.a, world.b, world.c, world.d])
    await dropBusiness(seed.business.id);
}

/** The projection row of (business, consumer), read as the app's role. */
export async function projectionRow(businessId: string, consumerId: string) {
  const [row] = await getDb()
    .select()
    .from(businessCustomers)
    .where(
      and(
        eq(businessCustomers.businessId, businessId),
        eq(businessCustomers.consumerId, consumerId),
      ),
    );
  return row;
}

/** The oldest membership alta of (business, consumer), read by SQL. */
export async function oldestAlta(businessId: string, consumerId: string) {
  const rows = await getDb()
    .select({ at: programMemberships.enrolledAt })
    .from(programMemberships)
    .where(
      and(
        eq(programMemberships.businessId, businessId),
        eq(programMemberships.consumerId, consumerId),
      ),
    );
  return rows.map((r) => r.at.getTime()).sort((p, q) => p - q);
}
