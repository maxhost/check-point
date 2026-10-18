import { NextResponse } from "next/server";
import {
  NOT_AUTHENTICATED,
  toSessionView,
} from "../../../../server/session-view";
import { getBackofficeRequestContext } from "../../../../server/backoffice-context";
import { publicBackofficeBilling } from "../../../../server/backoffice-initial-context";
import { enabledModuleList } from "../../../../modules/activation";

export const dynamic = "force-dynamic";

/**
 * Spec 0074 §D1 — `GET /api/merchant/session`, EL CONTEXTO DE SESION.
 *
 * **Es un REPORTERO de estado, no un guard, y esa es la decision central de la spec.** No pasa
 * por `requireApiOwner` y **no emite ninguno de los cinco `code` de la 0072**: si contestara
 * `403 business_suspended`, la UI **nunca** podria renderizar la pantalla de cuenta suspendida
 * —la que el owner pidio textualmente el 2026-09-17—. Un endpoint que reporta el estado no
 * puede estar gateado por el estado que reporta.
 *
 * **Contesta SIEMPRE `200`.** Sin sesion devuelve `{ authenticated: false }`, no un `401`: es
 * el caso NORMAL de `/login` y de la landing, que lo consultan en cada carga, y es la misma
 * forma que ya tiene `GET /api/auth/get-session` de better-auth. Es la mutacion M1.
 *
 * **NO devuelve el plan**, y por eso `GET /api/billing/state` es un endpoint aparte:
 * `billingStateResponse` toma un lock de fila (`lockBusiness`) y cuenta locales y campañas
 * activas. Meterlo aca pondria un lock en cada carga de cada pantalla, incluida la landing.
 *
 * **El `orderBy(asc(businesses.createdAt))` + `limit(1)` es EXACTAMENTE el criterio de
 * `requireBackofficeSession`** (`auth-guards.ts:106`) y tiene que serlo, o la UI y el guard
 * hablan de negocios distintos. Un `limit(1)` sin `orderBy` es no determinista — el revisor de
 * la 0072 cazo justo eso en el corte del link magico. Es la mutacion M2.
 */
export async function GET(request: Request) {
  const context = getBackofficeRequestContext(request);
  const session = await context.readSession();
  if (!session) return NextResponse.json(NOT_AUTHENTICATED);
  const selection = await context.readSelection("page");
  const row =
    selection.state === "joined"
      ? (selection.data?.member ?? null)
      : selection.member;
  const user = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    emailVerified: session.user.emailVerified === true,
  };
  // Reporter keeps inactive membership private and never invokes the page's revocation.
  if (!row || row.membershipStatus !== "active")
    return NextResponse.json(toSessionView(user, row));
  const billing = await publicBackofficeBilling(context, row.id);
  const enabled = await enabledModuleList(row.id);
  return NextResponse.json(toSessionView(user, row, billing, enabled));
}
