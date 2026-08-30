import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getMerchantAuth } from "./auth";
import { getDb } from "./db";
import { businesses, memberships } from "./schema";

/** The business the current backoffice session operates on (its first business). */
export type GuardBusiness = {
  id: string;
  name: string;
  currencyCode: string;
  timezone: string;
};

export type GuardMembership = {
  role: string;
  status: string;
};

export type BackofficeSession = {
  userId: string;
  userName: string;
  business: GuardBusiness;
  membership: GuardMembership;
};

/**
 * Shared backoffice guard (ADR 0044). Resolves the authenticated merchant_auth user's
 * business + membership (role + status), redirecting when there is no access:
 *  - no session → `/login`;
 *  - session but no membership at all → `/onboarding` (a brand-new owner);
 *  - membership `status='disabled'` → `/login` (a deactivated staff; sessions are already
 *    revoked at deactivation, this is defense in depth).
 * Never returns a disabled or sessionless caller.
 */
export async function requireBackofficeSession(): Promise<BackofficeSession> {
  const session = await getMerchantAuth().api.getSession({
    headers: await headers(),
  });
  if (!session) redirect("/login");

  const [row] = await getDb()
    .select({
      id: businesses.id,
      name: businesses.name,
      currencyCode: businesses.currencyCode,
      timezone: businesses.timezone,
      role: memberships.role,
      status: memberships.status,
    })
    .from(memberships)
    .innerJoin(businesses, eq(businesses.id, memberships.businessId))
    .where(eq(memberships.userId, session.user.id))
    .orderBy(asc(businesses.createdAt))
    .limit(1);

  if (!row) redirect("/onboarding");
  if (row.status !== "active") redirect("/login");

  return {
    userId: session.user.id,
    userName: session.user.name,
    business: {
      id: row.id,
      name: row.name,
      currencyCode: row.currencyCode,
      timezone: row.timezone,
    },
    membership: { role: row.role, status: row.status },
  };
}

/**
 * Owner-only guard: a staff member is redirected to the counter console (never to
 * onboarding). Used by every owner-only page (brand, loyalty, catalog, staff, home).
 */
export async function requireOwner(): Promise<BackofficeSession> {
  const ctx = await requireBackofficeSession();
  if (ctx.membership.role !== "owner") redirect("/backoffice/counter");
  return ctx;
}
