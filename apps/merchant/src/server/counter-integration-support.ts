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
  loyaltyRewards,
  memberships,
  orders,
  programMemberships,
  rewardRedemptions,
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
  /** Program `configuration` jsonb. Sellos read `target` from here (spec 0055): the
   * default `{}` is the shape the pre-0055 corpus already inserts, and the exact one
   * that `Number(undefined)` would have turned into a free redemption. */
  configuration?: Record<string, unknown>;
  /** `core.loyalty_program.redeem_allow_insufficient` (spec 0055 §5). */
  redeemAllowInsufficient?: boolean;
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
    configuration: opts.configuration ?? {},
    status: "active",
    termsMarkdown: "TOS",
    termsHash: "hash",
    createdBy: userId,
    accrualMode: opts.mode,
    accrualGrant: opts.grant,
    accrualBlockAmount: opts.blockAmount,
    redeemAllowInsufficient: opts.redeemAllowInsufficient ?? false,
  });
  return {
    business: { id: businessId, currencyCode: "USD" },
    userId,
    locationId,
    programId,
  };
}

/** Seeds one reward of a program and returns its id. `pointsCost` may be null on
 * purpose: `loyalty_reward.points_cost` is nullable and its check only says
 * `IS NULL OR > 0`, so a Puntos reward without a cost is representable in the DB. */
export async function seedReward(opts: {
  programId: string;
  businessId: string;
  type?: "catalog_product" | "custom" | "discount";
  label?: string;
  pointsCost: number | null;
  discountPercent?: number | null;
  position?: number;
}): Promise<string> {
  const [row] = await getDb()
    .insert(loyaltyRewards)
    .values({
      programId: opts.programId,
      businessId: opts.businessId,
      rewardType: opts.type ?? "custom",
      label: opts.label ?? "Café gratis",
      discountPercent: opts.discountPercent ?? null,
      pointsCost: opts.pointsCost,
      position: opts.position ?? 0,
    })
    .returning({ id: loyaltyRewards.id });
  return row.id;
}

/** Seeds an extra member of a business (ADR 0044) and returns its user id. A
 * `disabled` member keeps identity and audit but must not operate the counter. */
export async function seedMember(opts: {
  businessId: string;
  role?: "owner" | "staff";
  status?: "active" | "disabled";
}): Promise<string> {
  const userId = `counter-int-${randomUUID()}`;
  await getDb()
    .insert(users)
    .values({
      id: userId,
      name: `Staff ${userId.slice(-6)}`,
      email: `${userId}@example.test`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  await getDb()
    .insert(memberships)
    .values({
      businessId: opts.businessId,
      userId,
      role: opts.role ?? "staff",
      status: opts.status ?? "active",
    });
  return userId;
}

/** Forces a membership balance. Used to reach a redeemable state without running a
 * whole accreditation, so the redemption tests do not depend on the grant path. */
export async function setBalance(
  membershipId: string,
  balance: { points?: number; stamps?: number },
): Promise<void> {
  await getDb()
    .update(programMemberships)
    .set({
      ...(balance.points === undefined
        ? {}
        : { pointsBalance: balance.points }),
      ...(balance.stamps === undefined ? {} : { stampsCount: balance.stamps }),
    })
    .where(eq(programMemberships.id, membershipId));
}

/** Both balances of a membership, read by SQL. The API response is NOT an oracle
 * (ADR 0054 §4): with the idempotency bug it reported a balance that did not exist. */
export async function readBalances(
  membershipId: string,
): Promise<{ points: number; stamps: number }> {
  const [row] = await getDb()
    .select({
      points: programMemberships.pointsBalance,
      stamps: programMemberships.stampsCount,
    })
    .from(programMemberships)
    .where(eq(programMemberships.id, membershipId));
  return row;
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
 * `loyalty_program`, and `core.order` / `core.reward_redemption` non-cascading FKs to
 * both — so tear down redemptions and orders (cascades items) and memberships first,
 * then the business (cascades program/location/rewards).
 */
export async function dropBusiness(businessId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(rewardRedemptions)
    .where(eq(rewardRedemptions.businessId, businessId));
  await db.delete(orders).where(eq(orders.businessId, businessId));
  await db
    .delete(programMemberships)
    .where(eq(programMemberships.businessId, businessId));
  await db.delete(businesses).where(eq(businesses.id, businessId));
}
