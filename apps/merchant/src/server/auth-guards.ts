import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getMerchantAuth } from "./auth";
import { getDb } from "./db";
import { businesses, memberships, sessions } from "./schema";

/**
 * Reason code the guard puts on `/?e=…` when it bounces a deactivated staff member
 * (ADR 0055). It used to travel to the sign-in page, which spec 0067 §7 deleted; the
 * allow-list that turns the code into copy moved to the CONTRACT
 * (`docs/specs/0067-contratos-de-api.md`, «códigos de rebote»), which is what whoever
 * builds the new UI reads. The raw query param is never rendered: the UI looks the code
 * up, an unknown one prints nothing.
 */
export const STAFF_DISABLED = "staff_disabled";

/**
 * Reason code for an OWNER whose email is still unverified (spec 0067 §3 / ADR 0070 §11).
 * Same channel and same allow-list as {@link STAFF_DISABLED}. The API twin of this bounce
 * is the 403 `email_not_verified` of `app/api/staff/_auth.ts`.
 */
export const EMAIL_NOT_VERIFIED = "email_not_verified";

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
 *  - no session → `/`;
 *  - session but no membership at all → `/` (a brand-new owner);
 *  - membership `status='disabled'` → revokes the session and sends the member to
 *    `/?e=staff_disabled`, so the landing can say why (ADR 0055);
 *  - OWNER with an unverified email → `/?e=email_not_verified` (spec 0067 §3).
 *
 * **The three destinations are `/` and no longer the sign-in page, which spec 0067 §7
 * deleted.** It is not cosmetics: a redirect to a route that no longer exists turns a
 * bounce into a 404, and the `staff_disabled` case of ADR 0055 loses the channel that
 * explains the rejection. Pinned by `auth-guards.test.ts` (mutation #6 of the budget).
 *
 * **And `app/page.tsx` no longer bounces a live session to `/backoffice`**: with these
 * three redirects pointing at `/`, that bounce would close an infinite redirect loop.
 *
 * Never returns a disabled, unverified-owner or sessionless caller.
 */
export async function requireBackofficeSession(): Promise<BackofficeSession> {
  const session = await getMerchantAuth().api.getSession({
    headers: await headers(),
  });
  if (!session) redirect("/");

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

  if (!row) redirect("/");
  if (row.status !== "active") {
    // ADR 0055 §3: better-auth authenticates against merchant_auth and knows nothing
    // about core.business_membership, so a deactivated member still gets a fresh
    // session on sign-in. Revoke it here with a DELETE identical in shape and scope to
    // the one in `setStaffStatus` (staff.ts) — this adds no new revocation mechanism of
    // its own. (Other revocation paths do exist and are better-auth's, not ours:
    // better-auth's CORE `/sign-out` route — `dist/api/routes/sign-out.mjs`,
    // `internalAdapter.deleteSession`; it is not contributed by any plugin — and
    // `revokeUnprovenAccountAccess`, which the magic-link verify calls before flipping
    // `emailVerified` on an account that never proved its mailbox. The
    // `revokeSessionsOnPasswordReset` path named here until spec 0067 is GONE: it lived
    // in `emailAndPassword`, which that spec turned off.)
    // The await MUST come before `redirect()`: redirect throws NEXT_REDIRECT, so
    // anything written after it never runs.
    await getDb().delete(sessions).where(eq(sessions.userId, session.user.id));
    redirect(`/?e=${STAFF_DISABLED}`);
  }

  // EL GATE DE EMAIL VERIFICADO (spec 0067 §3 / ADR 0070 §11), acá adentro y no repartido
  // por pantalla: éste es el guard de las 8 páginas del backoffice **y del mostrador**.
  //
  // `role === "owner"` NO es una optimización: el staff no tiene email por diseño (su
  // `user` lleva un sintético `@staff.invalid` que nunca se entrega, spec §4), así que sin
  // esa condición el mostrador quedaría inutilizable PARA SIEMPRE — no hay ninguna acción
  // con la que un integrante pueda verificar nada. Es la mutación #3 del presupuesto.
  //
  // Va DESPUÉS del chequeo de `status`: un miembro desactivado tiene que seguir recibiendo
  // su propio motivo, y su sesión revocada, antes que cualquier otra cosa.
  //
  // `emailVerified` sale de la sesión de better-auth, que ya leyó la fila del usuario: no
  // agrega una consulta. Se compara contra `true` en vez de negar, para que un `undefined`
  // —una fila vieja, un doble de test incompleto— cierre en vez de abrir (fail-closed).
  if (row.role === "owner" && session.user.emailVerified !== true)
    redirect(`/?e=${EMAIL_NOT_VERIFIED}`);

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
