import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  campaignCoupons,
  campaigns,
  consumerAccounts,
  couponRedemptions,
  orders,
  products,
  webPushSubscriptions,
} from "@mi-pasaporte/db/schema";
import { issueWelcomeGifts } from "@mi-pasaporte/domain/server/marketing/welcome-issue";
import { selectCoupon } from "@mi-pasaporte/domain/server/consumer/coupon-selection";
import type { CouponKind } from "@mi-pasaporte/domain/server/marketing/reward-input";
import {
  type Seed,
  dropBusiness,
  seedConsumer,
} from "../counter-integration-support";
import { seedLocationsBusiness } from "../locations-integration-support";
import { seedWelcomeCampaign } from "../marketing-welcome-support";
import { dropCampaigns } from "../marketing-read-support";
import { resolveScan } from "./resolve";
import { grantAccrual } from "./grant";

/**
 * Spec 0148 — THE WORLD OF THE CHOSEN COUPON, with the shape of PRODUCTION:
 *  - a business in `America/Guayaquil` with a POINTS program, 10 points per 1.00
 *    (`seedLocationsBusiness`, plan `plus`), and two catalog products;
 *  - every customer is created by the counter's SCAN (`resolveScan` auto-enrols and writes
 *    `core.business_customer`), then opens the app from Home with Web Push on;
 *  - their coupon is ISSUED BY THE BIENVENIDA (`issueWelcomeGifts`, `same_visit`) with the
 *    reward the case asks for — the real issuer copies the whole reward (ADR 0098 §8).
 * A SECOND coupon of the same customer (the daily limit needs two distinct ones) is seeded
 * directly: the welcome gives ONE per enrolment, forever.
 */

export const PRICE = { medialuna: "3.50", cafe: "2.00" } as const;

export type CycleWorld = {
  seed: Seed;
  welcomeId: string;
  medialuna: string;
  cafe: string;
};

export type Customer = {
  consumerId: string;
  qrToken: string;
  membershipId: string;
};

export type Reward = {
  kind: CouponKind;
  label: string;
  productId?: string | null;
  discountUnit?: "percent" | "amount" | null;
  discountValue?: string | null;
  extraUnits?: number | null;
};

export async function seedCycleWorld(label: string): Promise<CycleWorld> {
  const live = randomUUID().slice(0, 8);
  const seed = await seedLocationsBusiness(`${label} ${live}`, "plus", {
    interval: "month",
    stripeCustomerId: `cus_${live}`,
    stripeSubscriptionId: `sub_${live}`,
  });
  const product = async (name: string, unitPrice: string) =>
    (
      await getDb()
        .insert(products)
        .values({
          businessId: seed.business.id,
          name,
          unitPrice,
          availableAllLocations: true,
        })
        .returning({ id: products.id })
    )[0].id;
  return {
    seed,
    medialuna: await product("Medialuna", PRICE.medialuna),
    cafe: await product("Café", PRICE.cafe),
    welcomeId: await seedWelcomeCampaign(seed, {
      activatedAt: new Date(Date.now() - 3_600_000),
      redeemFrom: "same_visit",
      monthlyCap: 500,
    }),
  };
}

export async function dropCycleWorld(world: CycleWorld): Promise<void> {
  await dropCampaigns(world.seed.business.id);
  await dropBusiness(world.seed.business.id);
}

/** A customer created by the SCAN (auto-enrolment + `business_customer`), app on Home. */
export async function scannedCustomer(world: CycleWorld): Promise<Customer> {
  const consumer = await seedConsumer();
  const scan = await resolveScan(world.seed.business, consumer.qrToken);
  await getDb()
    .update(consumerAccounts)
    .set({ homeLaunchedAt: new Date() })
    .where(eq(consumerAccounts.id, consumer.id));
  await getDb()
    .insert(webPushSubscriptions)
    .values({
      consumerId: consumer.id,
      endpoint: `https://push.test/${randomUUID()}`,
      p256dhKey: "test-key",
      authKey: "test-auth",
      platform: "android",
    });
  return {
    consumerId: consumer.id,
    qrToken: consumer.qrToken,
    membershipId: scan.membership.id,
  };
}

function rewardColumns(reward: Reward) {
  return {
    couponLabel: reward.label,
    couponKind: reward.kind,
    couponProductId: reward.productId ?? null,
    couponDiscountUnit: reward.discountUnit ?? null,
    couponDiscountValue: reward.discountValue ?? null,
    couponExtraUnits: reward.extraUnits ?? null,
  };
}

/** The Bienvenida issues the customer's coupon with `reward` (the real issuer). */
export async function welcomeCoupon(
  world: CycleWorld,
  customer: Customer,
  reward: Reward,
): Promise<string> {
  await getDb()
    .update(campaigns)
    .set(rewardColumns(reward))
    .where(eq(campaigns.id, world.welcomeId));
  const issued = await issueWelcomeGifts(customer.consumerId);
  if (issued !== 1) throw new Error(`welcomeCoupon: issued ${issued}`);
  const [row] = await getDb()
    .select({ id: campaignCoupons.id })
    .from(campaignCoupons)
    .where(eq(campaignCoupons.welcomeMembershipId, customer.membershipId));
  return row.id;
}

/** A second coupon of the same customer (free product), seeded directly. */
export async function secondCoupon(
  world: CycleWorld,
  customer: Customer,
  label = "Café gratis",
): Promise<string> {
  const [row] = await getDb()
    .insert(campaignCoupons)
    .values({
      campaignId: world.welcomeId,
      businessId: world.seed.business.id,
      consumerId: customer.consumerId,
      membershipId: customer.membershipId,
      labelSnapshot: label,
      costSnapshot: "1.00",
      kindSnapshot: "free_product",
      validFrom: new Date(Date.now() - 3_600_000),
      validUntil: new Date(Date.now() + 15 * 86_400_000),
    })
    .returning({ id: campaignCoupons.id });
  return row.id;
}

/** The customer chooses the coupon in the PWA; a refusal never hides here. */
export async function choose(customer: Customer, couponId: string, now?: Date) {
  const result = await selectCoupon(customer.consumerId, couponId, now);
  if (result.status !== 200)
    throw new Error(`choose: ${result.status} ${result.code}`);
}

export function validateBody(
  world: CycleWorld,
  customer: Customer,
  couponId: string,
) {
  return {
    clientRequestId: randomUUID(),
    membershipId: customer.membershipId,
    couponId,
    locationId: world.seed.locationId,
  };
}

export function sell(
  world: CycleWorld,
  customer: Customer,
  sale:
    | { mode: "quick"; total: string }
    | {
        mode: "detailed";
        items: { productId: string; quantity: number }[];
      },
  coupon: { couponId: string; productId?: string | null } | null,
  key: string = randomUUID(),
  now?: Date,
) {
  return grantAccrual(
    world.seed.business,
    world.seed.userId,
    {
      clientRequestId: key,
      membershipId: customer.membershipId,
      locationId: world.seed.locationId,
      ...sale,
      ...(coupon ? { coupon } : {}),
    },
    now,
  );
}

/** The redemption rows of a coupon, BY SQL (ADR 0054 §4: the answer is never the oracle). */
export async function redemptionsOf(couponId: string) {
  return getDb()
    .select({
      id: couponRedemptions.id,
      orderId: couponRedemptions.orderId,
      discountAmount: couponRedemptions.discountAmount,
      createdAt: couponRedemptions.createdAt,
    })
    .from(couponRedemptions)
    .where(eq(couponRedemptions.couponId, couponId));
}

export async function ordersOf(world: CycleWorld, customer: Customer) {
  return getDb()
    .select({ id: orders.id, total: orders.total, units: orders.unitsGranted })
    .from(orders)
    .where(
      and(
        eq(orders.businessId, world.seed.business.id),
        eq(orders.consumerId, customer.consumerId),
      ),
    );
}

export async function selectionOf(customer: Customer): Promise<string | null> {
  const result = await getDb().execute<{ selected_coupon_id: string | null }>(
    sql`select selected_coupon_id from consumer.consumer_account where id = ${customer.consumerId}`,
  );
  return result.rows[0]?.selected_coupon_id ?? null;
}

/** Moves a redemption row's `created_at` (the day is the business's local one). */
export async function backdate(redemptionId: string, at: Date): Promise<void> {
  await getDb()
    .update(couponRedemptions)
    .set({ createdAt: at })
    .where(eq(couponRedemptions.id, redemptionId));
}
