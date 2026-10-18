/** Spec0238: one selection policy for the nullable JOIN and its exceptional member-only read. */
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  memberships,
  subscriptions,
} from "@mi-pasaporte/db/schema";
import { billingFromSubscription } from "./billing-gate";
import type { BackofficeSelectionMode } from "../backoffice-context-contract";

const memberProjection = {
  id: businesses.id,
  name: businesses.name,
  slug: businesses.slug,
  countryCode: businesses.countryCode,
  currencyCode: businesses.currencyCode,
  timezone: businesses.timezone,
  categoryGcid: businesses.categoryGcid,
  businessStatus: businesses.status,
  suspensionReason: businesses.suspensionReason,
  role: memberships.role,
  membershipStatus: memberships.status,
  permissions: memberships.permissions,
  pinMustChange: memberships.pinMustChange,
};
const subscriptionProjection = {
  id: subscriptions.id,
  plan: subscriptions.plan,
  status: subscriptions.status,
  stripeCustomerId: subscriptions.stripeCustomerId,
  stripeSubscriptionId: subscriptions.stripeSubscriptionId,
  trialEndsAt: subscriptions.trialEndsAt,
};
function selection(userId: string, mode: BackofficeSelectionMode) {
  if (mode === "active-owner")
    return and(
      eq(memberships.userId, userId),
      eq(memberships.role, "owner"),
      eq(memberships.status, "active"),
    );
  if (mode === "active-member")
    return and(
      eq(memberships.userId, userId),
      eq(memberships.status, "active"),
    );
  return eq(memberships.userId, userId);
}
/** Exported SQL builder permits focal EXPLAIN without duplicating the actual query. */
export function backofficeMembershipQuery(
  userId: string,
  mode: BackofficeSelectionMode,
) {
  return getDb()
    .select({ member: memberProjection, subscription: subscriptionProjection })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .leftJoin(subscriptions, eq(subscriptions.businessId, businesses.id))
    .where(selection(userId, mode))
    .orderBy(asc(businesses.createdAt))
    .limit(1);
}
export async function readBackofficeMembership(
  userId: string,
  mode: BackofficeSelectionMode,
  now: Date,
) {
  const [row] = await backofficeMembershipQuery(userId, mode);
  return row
    ? { ...row, billing: billingFromSubscription(row.subscription, now) }
    : null;
}
export async function readBackofficeMembershipOnly(
  userId: string,
  mode: BackofficeSelectionMode,
) {
  const [row] = await getDb()
    .select(memberProjection)
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(selection(userId, mode))
    .orderBy(asc(businesses.createdAt))
    .limit(1);
  return row ?? null;
}
export type BackofficeMembershipRow = NonNullable<
  Awaited<ReturnType<typeof readBackofficeMembershipOnly>>
>;
export type BackofficeMembershipRead = Awaited<
  ReturnType<typeof readBackofficeMembership>
>;
