import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getMerchantAuth } from "./auth";
import { getDb } from "./db";
import { businesses, memberships, sessions } from "./schema";

/**
 * Reason code the guard puts on `/login?e=…` when it bounces a deactivated staff
 * member (ADR 0055). The login page translates it through an allow-list
 * (`app/login/login-notice.ts`); it never renders the raw query param.
 */
export const STAFF_DISABLED = "staff_disabled";

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
 *  - membership `status='disabled'` → revokes the session and sends the member to
 *    `/login?e=staff_disabled`, so the login can say why (ADR 0055).
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
  if (row.status !== "active") {
    // ADR 0055 §3: better-auth authenticates against merchant_auth and knows nothing
    // about core.business_membership, so a deactivated member still gets a fresh
    // session on sign-in. Revoke it here with a DELETE identical in shape and scope to
    // the one in `setStaffStatus` (staff.ts) — this adds no new revocation mechanism of
    // its own. (Other revocation paths do exist and are better-auth's, not ours:
    // `revokeSessionsOnPasswordReset` in auth.ts, and better-auth's CORE `/sign-out`
    // route — `dist/api/routes/sign-out.mjs`, `internalAdapter.deleteSession`; it is
    // not contributed by any plugin.)
    // The await MUST come before `redirect()`: redirect throws NEXT_REDIRECT, so
    // anything written after it never runs.
    await getDb().delete(sessions).where(eq(sessions.userId, session.user.id));
    redirect(`/login?e=${STAFF_DISABLED}`);
  }

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
