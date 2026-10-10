import { billingAccess } from "../billing-access";
import {
  ENTITLEMENTS,
  PAID_PLANS,
  type EntitlementDef,
  type FlagKey,
  type KnownPlan,
  type LimitKey,
} from "./catalog";

export {
  DEAD_STRIPE_STATUS,
  hasLiveSubscription,
  type LiveSubscriptionInput,
} from "./live-subscription";

export {
  BASE_TEMPLATE_KEYS,
  ENTITLEMENTS,
  KNOWN_PLANS,
  PAID_PLANS,
  PLAN_PRICES_USD,
  TRIAL_DAYS,
  type EntitlementDef,
  type EntitlementKey,
  type EntitlementWindow,
  type FlagKey,
  type KnownPlan,
  type LimitKey,
} from "./catalog";

export { retryAfterSeconds, windowEnd, windowOf, windowStart } from "./window";

/**
 * Spec 0072 §D2.4 + spec 0189 §D2 — LA CAPA DE ENTITLEMENTS: `can()` y `limitOf()` sobre el
 * catalogo, por el PLAN EFECTIVO.
 *
 * La firma recibe **la fila de `core.subscription`, no un `businessId`**, y es deliberado:
 * el gate de campañas se resuelve DENTRO de la transaccion que escribe (ADR 0054 §2), asi
 * que una capa que abriera su propia conexion romperia esa garantia. La lectura se queda
 * en el llamador.
 *
 * **Nunca recibe `core.business`** (ADR 0073 §1): el eje `status` se evalua antes y por
 * separado. Ver el docblock de `catalog.ts`.
 */

/**
 * Lo minimo de `core.subscription` con lo que se decide, mas el reloj. Todo obligatorio: un
 * contexto sin `trialEndsAt` o sin `status` no puede decidir el acceso, y un default en la capa
 * seria una decision escondida. Una fila AUSENTE se pasa como `null` a `can`/`limitOf`.
 */
export type EntitlementContext = {
  plan: string;
  status: string;
  stripeSubscriptionId: string | null;
  trialEndsAt: Date | null;
  now: Date;
};

/**
 * EL PLAN EFECTIVO (spec 0189 §D2), sobre el eje de acceso de `billing-access.ts`:
 *  - `subscribed` → el plan de la fila si es pago (`base`/`plus`); si no, `null` (= `fallback`:
 *    una suscripcion viva sobre una fila que todavia no tiene plan pago no regala nada).
 *  - `trial` → `"trial"` (todo incluido, ADR 0134 §2), sea cual sea el plan escrito.
 *  - `blocked` → `"none"`. Una fila ausente es `blocked` (fail-closed).
 *
 * `pending_plan` NO influye: solo toma `'none'` (cancelacion programada) y el ADR 0134 §8 dice
 * que se usa lo pagado hasta el final del periodo.
 */
export function effectivePlan(
  ctx: EntitlementContext | null,
): KnownPlan | null {
  if (ctx === null) return "none";
  const access = billingAccess(ctx, ctx.now);
  if (access === "blocked") return "none";
  if (access === "trial") return "trial";
  return PAID_PLANS.has(ctx.plan) ? (ctx.plan as KnownPlan) : null;
}

/** El valor de un plan LITERAL, o el `fallback` si el plan no tiene fila (o es `null`). */
function valueForPlan(
  def: EntitlementDef,
  plan: string | null | undefined,
): number | boolean {
  if (typeof plan !== "string") return def.fallback;
  const byPlan: Record<string, number | boolean> = def.byPlan;
  return Object.prototype.hasOwnProperty.call(byPlan, plan)
    ? byPlan[plan]
    : def.fallback;
}

/** El tope efectivo de una entrada `kind: "limit"`. */
export function limitOf(ctx: EntitlementContext | null, key: LimitKey): number {
  return limitForPlan(effectivePlan(ctx), key);
}

/** Si el plan efectivo permite una entrada `kind: "flag"`. NUNCA mira `core.business.status`. */
export function can(ctx: EntitlementContext | null, key: FlagKey): boolean {
  return flagForPlan(effectivePlan(ctx), key);
}

/**
 * El tope de un plan DESTINO literal, sin contexto: para los bloqueos de bajada («¿cuantos
 * locales admite `base`?»), donde la pregunta no es por el acceso de hoy.
 */
export function limitForPlan(
  plan: string | null | undefined,
  key: LimitKey,
): number {
  const value = valueForPlan(ENTITLEMENTS[key], plan);
  // La firma del catalogo ya garantiza `number` para una `LimitKey`; el guard existe para
  // que un catalogo mal escrito no devuelva `NaN` silencioso al conteo de locales.
  return typeof value === "number" ? value : 0;
}

/** El flag de un plan DESTINO literal, sin contexto (mismo uso que `limitForPlan`). */
export function flagForPlan(
  plan: string | null | undefined,
  key: FlagKey,
): boolean {
  return valueForPlan(ENTITLEMENTS[key], plan) === true;
}
