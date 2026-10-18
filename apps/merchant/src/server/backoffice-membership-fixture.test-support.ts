/** Explicit adapter for existing guard tests' legacy world/read doubles, not SQL evidence. */
import { asc, eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { businesses, memberships } from "@mi-pasaporte/db/schema";
import { ownerContext, membershipContext } from "./staff";
import { readBusinessBilling, type BusinessBilling } from "./billing-gate";
import type { BackofficeSelectionMode } from "../backoffice-context-contract";
import type { BackofficeMembershipRow } from "./backoffice-membership";

async function legacyRow(userId: string, mode: BackofficeSelectionMode) {
  if (mode === "active-owner") return ownerContext(userId);
  if (mode === "active-member") return membershipContext(userId);
  const [row] = await getDb()
    .select()
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(businesses.createdAt))
    .limit(1);
  return row ?? null;
}
function normalize(
  source: object,
  mode: BackofficeSelectionMode,
): BackofficeMembershipRow {
  const row = source as Record<string, unknown>;
  return {
    id: String(row.id),
    name: String(row.name ?? "Synthetic"),
    slug: String(row.slug ?? "synthetic"),
    countryCode: String(row.countryCode ?? "EC"),
    currencyCode: String(row.currencyCode ?? "USD"),
    timezone: String(row.timezone ?? "America/Guayaquil"),
    categoryGcid: "gcid:store",
    businessStatus: String(mode === "page" ? row.businessStatus : row.status),
    suspensionReason: row.suspensionReason as string | null,
    role: String(mode === "active-owner" ? "owner" : row.role),
    membershipStatus:
      mode === "page" ? String(row.membershipStatus ?? row.status) : "active",
    permissions: (row.permissions ?? []) as string[],
    pinMustChange: row.pinMustChange === true,
  };
}
/** Existing route tests isolate decisions/domain, while native JOIN tests exercise PostgreSQL. */
export function legacyMembershipFixtures(billingReader = readBusinessBilling) {
  const only = async (userId: string, mode: BackofficeSelectionMode) => {
    const row = await legacyRow(userId, mode);
    return row ? normalize(row, mode) : null;
  };
  return {
    readBackofficeMembershipOnly: only,
    readBackofficeMembership: async (
      userId: string,
      mode: BackofficeSelectionMode,
      now: Date,
    ) => {
      const member = await only(userId, mode);
      if (!member) return null;
      const billing: BusinessBilling = await billingReader(member.id, now);
      const subscription =
        billing.access === "blocked"
          ? null
          : {
              id: "00000000-0000-4000-8000-000000000001",
              plan: billing.access === "trial" ? "trial" : "base",
              status: "active",
              stripeCustomerId: null,
              stripeSubscriptionId:
                billing.access === "subscribed"
                  ? "synthetic-subscription"
                  : null,
              trialEndsAt: billing.trialEndsAt,
            };
      return { member, subscription, billing };
    },
  };
}
