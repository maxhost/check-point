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
 * Reason code for a business whose account is CLOSED (spec 0072 §D4). Same channel and same
 * allow-list as {@link STAFF_DISABLED}. El gemelo de API es el 403 `business_closed` de
 * `requireApiOwner`.
 *
 * **`suspended` NO rebota** y es una decision del owner, no un olvido: el owner de un negocio
 * suspendido **si entra**, porque lo unico que tiene que poder hacer es leer el motivo y el
 * boton de contacto. Por eso el guard devuelve `status` y `suspensionReason` en vez de
 * redirigir.
 */
export const BUSINESS_CLOSED = "business_closed";

/** The business the current backoffice session operates on (its first business). */
export type GuardBusiness = {
  id: string;
  name: string;
  currencyCode: string;
  timezone: string;
  /** El eje `status` (spec 0072 §D4). `closed` no llega nunca: rebota antes. Queda
   * `active` | `suspended`, que es lo que la pantalla necesita para decidir si muestra el
   * mensaje de cuenta suspendida. */
  status: string;
  /** El motivo, **solo para el owner** y solo con `status = 'suspended'`. Es el dato que el
   * owner pidio ver («informacion de por que fue suspendida su cuenta»). */
  suspensionReason: string | null;
};

export type GuardMembership = {
  role: string;
  status: string;
};

export type BackofficeSession = {
  userId: string;
  userName: string;
  /** ¿El usuario probó el control de su buzón? (spec 0082 / ADR 0070 §11.)
   *
   * Es un DATO que la puerta entrega, **no un gate**: el owner sin verificar entra y ve el
   * panel, y lo que muere con 403 es cada ACCIÓN. La página lo usa para renderizar el primer
   * paso del onboarding («verificá tu email»), que no se puede ver desde afuera.
   *
   * `=== true` y no `!!`: una fila vieja o un doble incompleto se lee como **sin verificar**
   * (fail-closed en el dato). */
  emailVerified: boolean;
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
 *  - business `closed` → `/?e=business_closed` (spec 0072 §D4).
 *
 * **NO gatea por email verificado, y es una decisión del owner** (spec 0082 / ADR 0070 §11,
 * textual): *«Entra a su cuenta directamente al terminar el wizard y ve el onboarding»*, y el
 * primer paso de ese onboarding **es** verificar el email — para verlo hay que estar adentro.
 * Entrar sí, ACCIONES no: las 11 superficies de API del owner contestan 403
 * `email_not_verified` (`api-owner-surfaces.test.ts`) y el mostrador también
 * (`app/api/counter/_auth.ts`). El backoffice no tiene ni una server action: sus 8 páginas son
 * lecturas, así que sacar el rebote de acá no abre ninguna escritura.
 *
 * **The three destinations are `/` and no longer the sign-in page, which spec 0067 §7
 * deleted.** It is not cosmetics: a redirect to a route that no longer exists turns a
 * bounce into a 404, and the `staff_disabled` case of ADR 0055 loses the channel that
 * explains the rejection. Pinned by `auth-guards.test.ts` (mutation #6 of the budget).
 *
 * **And `app/page.tsx` no longer bounces a live session to `/backoffice`**: with these
 * three redirects pointing at `/`, that bounce would close an infinite redirect loop.
 *
 * Never returns a disabled or sessionless caller.
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
      // `businessStatus` y no `status`: `status` ya es el de la MEMBRESIA en esta misma
      // fila (ADR 0055). Dos ejes distintos con el mismo nombre es como uno termina
      // decidiendo por el otro.
      businessStatus: businesses.status,
      suspensionReason: businesses.suspensionReason,
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

  // ACÁ VIVÍA EL REBOTE POR EMAIL SIN VERIFICAR, y su ausencia es la spec 0082: rebotar en
  // la PUERTA bloqueaba las 8 páginas y el mostrador de una, y dejaba al owner sin ninguna
  // superficie donde ver el paso «verificá tu email» que el ADR 0070 §11 pone PRIMERO en su
  // onboarding. Reproducido en prod el 2026-09-19: «Ir a mi panel» aterrizaba en la landing
  // con el motivo en el query. Ese motivo sobrevive como 403 de API, nunca más como `?e=`.

  // EL EJE `status` (spec 0072 §D4), el mismo orden que `requireApiOwner` (ADR 0073 §1) para
  // que las dos superficies contesten lo mismo ante el mismo caller. **Solo `closed` rebota**:
  // `suspended` pasa a proposito, porque el owner tiene que poder ver el motivo — y el
  // mostrador de un negocio suspendido igual no acredita nada (`api/counter/_auth.ts` lo corta
  // con 403).
  if (row.businessStatus === "closed") redirect(`/?e=${BUSINESS_CLOSED}`);

  return {
    userId: session.user.id,
    userName: session.user.name,
    emailVerified: session.user.emailVerified === true,
    business: {
      id: row.id,
      name: row.name,
      currencyCode: row.currencyCode,
      timezone: row.timezone,
      status: row.businessStatus,
      // El motivo solo para el OWNER: un integrante no tiene por que leer la nota interna
      // de por que se suspendio la cuenta del negocio donde trabaja.
      suspensionReason: row.role === "owner" ? row.suspensionReason : null,
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
