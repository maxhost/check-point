import { hasLiveSubscription } from "./live-subscription";
import {
  ENTITLEMENTS,
  type EntitlementDef,
  type FlagKey,
  type LimitKey,
} from "./catalog";

export {
  DEAD_STRIPE_STATUS,
  hasLiveSubscription,
  type LiveSubscriptionInput,
} from "./live-subscription";

export {
  ENTITLEMENTS,
  KNOWN_PLANS,
  PAID_PLANS,
  type EntitlementDef,
  type EntitlementKey,
  type FlagKey,
  type KnownPlan,
  type LimitKey,
} from "./catalog";

/**
 * Spec 0072 §D2.4 — LA CAPA DE ENTITLEMENTS: `can()` y `limitOf()` sobre el catalogo.
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
 * Lo minimo de `core.subscription` con lo que se decide — la misma forma que ya leen los
 * dos call-sites (`CampaignPlanRow`, `PlanChangeInput`).
 *
 * `status` y `stripeSubscriptionId` son OPCIONALES porque las entradas con
 * `requiresLiveSubscription: false` no los miran, y sus envoltorios historicos
 * (`locationLimitForPlan(plan)`) no los tienen. Ausentes cuentan como **sin suscripcion
 * viva**: fail-closed, igual que el `!== true` del gate de email.
 */
export type EntitlementContext = {
  plan: string | null | undefined;
  pendingPlan?: string | null | undefined;
  status?: string | null | undefined;
  stripeSubscriptionId?: string | null | undefined;
};

/** El valor declarado para ese plan, o el `fallback` si el plan no tiene fila. Un plan que
 * no es `string` (NULL en la base, fila ausente) tambien cae al `fallback`. */
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

/** El menor de dos valores del MISMO tipo: `Math.min` para limites, `AND` para flags. */
function minOf(a: number | boolean, b: number | boolean): number | boolean {
  if (typeof a === "boolean" || typeof b === "boolean") {
    return Boolean(a) && Boolean(b);
  }
  return Math.min(a, b);
}

/**
 * EL VALOR EFECTIVO. Dos reglas, en este orden:
 *
 *  1. `pendingRule: "min"` (ADR 0063 D2) — el menor entre el plan vigente y el destino.
 *     Un `pending_plan` **vacio NO es una baja programada** ([R1-N8] de la spec 0063: sin
 *     ese detalle el tope caia a 1 sin que nadie hubiera programado nada).
 *  2. `requiresLiveSubscription` — sin suscripcion viva la entrada cae a su `fallback`,
 *     que es el valor declarado para lo desconocido y el mas restrictivo. Es lo que impide
 *     que un `plus` forma A1 (sin `stripe_subscription_id`) active campañas.
 */
function effectiveValue(
  def: EntitlementDef,
  ctx: EntitlementContext,
): number | boolean {
  let value = valueForPlan(def, ctx.plan);
  const pending = ctx.pendingPlan;
  if (
    def.pendingRule === "min" &&
    typeof pending === "string" &&
    pending !== ""
  ) {
    value = minOf(value, valueForPlan(def, pending));
  }
  if (
    def.requiresLiveSubscription &&
    !hasLiveSubscription({
      status: typeof ctx.status === "string" ? ctx.status : "",
      stripeSubscriptionId: ctx.stripeSubscriptionId ?? null,
    })
  ) {
    return def.fallback;
  }
  return value;
}

/** El tope efectivo de una entrada `kind: "limit"`. */
export function limitOf(ctx: EntitlementContext, key: LimitKey): number {
  const value = effectiveValue(ENTITLEMENTS[key], ctx);
  // La firma del catalogo ya garantiza `number` para una `LimitKey`; el guard existe para
  // que un catalogo mal escrito no devuelva `NaN` silencioso al conteo de locales.
  return typeof value === "number" ? value : 0;
}

/** Si el plan permite una entrada `kind: "flag"`. NUNCA mira `core.business.status`. */
export function can(ctx: EntitlementContext, key: FlagKey): boolean {
  return effectiveValue(ENTITLEMENTS[key], ctx) === true;
}
