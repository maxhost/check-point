import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
/** Whether the Neon integration branch is wired (see the *.neon.integration tests). */
export const integrationEnabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
// getDb() reads DATABASE_URL lazily; point it at the isolated integration branch.
if (integrationEnabled) process.env.DATABASE_URL = url;

import { getDb } from "./db";
import {
  businesses,
  consumerAccounts,
  locations,
  loyaltyPrograms,
  memberships,
  orders,
  programMemberships,
  users,
} from "./schema";
import type { OperatorBusiness } from "./counter";

export type Seed = {
  business: OperatorBusiness;
  userId: string;
  locationId: string;
  programId: string;
};

/** Seeds a business with an owner, a location, and an accreditable loyalty program. */
export async function seedBusiness(opts: {
  name: string;
  kind: "points" | "stamps";
  mode: "per_amount" | "per_purchase";
  grant: number;
  blockAmount: string | null;
}): Promise<Seed> {
  const db = getDb();
  const userId = `counter-int-${randomUUID()}`;
  const businessId = randomUUID();
  const locationId = randomUUID();
  const programId = randomUUID();
  await db.insert(users).values({
    id: userId,
    name: opts.name,
    email: `${userId}@example.test`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(businesses).values({
    id: businessId,
    name: opts.name,
    countryCode: "EC",
    timezone: "America/Guayaquil",
    currencyCode: "USD",
  });
  await db.insert(memberships).values({ businessId, userId, role: "owner" });
  await db.insert(locations).values({
    id: locationId,
    businessId,
    name: `${opts.name} centro`,
    addressLabel: "Calle 1",
    longitude: "0",
    latitude: "0",
    countryCode: "EC",
    addressSnapshot: {},
  });
  await db.insert(loyaltyPrograms).values({
    id: programId,
    businessId,
    kind: opts.kind,
    configuration: {},
    status: "active",
    termsMarkdown: "TOS",
    termsHash: "hash",
    createdBy: userId,
    accrualMode: opts.mode,
    accrualGrant: opts.grant,
    accrualBlockAmount: opts.blockAmount,
  });
  return {
    business: { id: businessId, currencyCode: "USD" },
    userId,
    locationId,
    programId,
  };
}

/** Seeds a global consumer account and returns its id + raw qr_token. */
export async function seedConsumer(): Promise<{ id: string; qrToken: string }> {
  const qrToken = `qr-${randomUUID()}`;
  const [row] = await getDb()
    .insert(consumerAccounts)
    .values({
      phoneE164: `+593${Math.floor(100000000 + Math.random() * 800000000)}`,
      firstName: "Marcos",
      lastName: "Pérez",
      qrToken,
      webViewToken: `wv-${randomUUID()}`,
    })
    .returning({ id: consumerAccounts.id });
  return { id: row.id, qrToken };
}

/**
 * Removes a seeded business. `consumer.program_membership` has a non-cascading FK to
 * `loyalty_program`, and `core.order` non-cascading FKs to both — so tear down orders
 * (cascades items) and memberships first, then the business (cascades program/location).
 */
export async function dropBusiness(businessId: string): Promise<void> {
  const db = getDb();
  await db.delete(orders).where(eq(orders.businessId, businessId));
  await db
    .delete(programMemberships)
    .where(eq(programMemberships.businessId, businessId));
  await db.delete(businesses).where(eq(businesses.id, businessId));
}
