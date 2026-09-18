import type Stripe from "stripe";

import type { SubscriptionWrite } from "./derive";

/**
 * Spec 0063, D5.d-f — las piezas PURAS de la derivación. Viven acá y no en `derive.ts`
 * porque el contrato normativo de ese archivo ya ocupa ~200 líneas y el límite del repo
 * son 300 (hook `file-size`, `LIMIT=300`): dividir, no extender. Nada de esto es una
 * decisión nueva — el «por qué» de cada conjunto está escrito en `derive.ts`.
 */

/** Los 8 status que Stripe documenta hoy. `Subscription.Status` termina en `| OtherString`
 * (`Subscriptions.d.ts:473`), así que esta lista dice lo que CONOCEMOS, no lo que puede
 * llegar: un status fuera de acá es `unknown_status`, no un error. */
export const KNOWN_STRIPE_STATUS: ReadonlySet<string> = new Set([
  "active",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "past_due",
  "paused",
  "trialing",
  "unpaid",
]);

/** Allow-list POSITIVA: sólo estos status otorgan `plus`. Polaridad OPUESTA a la de
 * `DEAD_STRIPE_STATUS` (`plan-change.ts`) y a propósito — acá lo desconocido no debe
 * otorgar plan pago; allá lo desconocido debe contar como suscripción viva. */
export const GRANTING_STATUS: ReadonlySet<string> = new Set([
  "active",
  "trialing",
]);

/** Status que prueban que la suscripción se terminó. */
export const TERMINAL_STATUS: ReadonlySet<string> = new Set([
  "canceled",
  "incomplete_expired",
]);

/** Sólo un plan PAGO puede caer a `none` ([R2-7]): un negocio `free` cuya primera factura
 * expira sigue en `free`, nunca queda «sin plan» por haber intentado pagar.
 *
 * Spec 0072 §P1: la lista ya NO se declara acá. «Qué plan es pago» era el tercer lugar
 * donde el conocimiento de plan estaba copiado, y vive en el catálogo de entitlements
 * junto a los topes. Se re-exporta para no tocar a `derive.ts` ni a sus tests. */
export { PAID_PLANS } from "../entitlements/catalog";

/** Las fechas de Stripe son unix SECONDS. Sin el `* 1000` caen en 1970 y el bug es visual,
 * no de tipos — por eso el unit asevera el AÑO. */
export function fromUnixSeconds(value: number | null | undefined): Date | null {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

/**
 * Ramas 2 y 3 de la jerarquía de `pendingPlan` (D5.f). La rama 1 —plan derivado en
 * `free`/`none` → todo a null, incondicional— vive en `planFromSubscription`, porque
 * depende del plan derivado y no de la suscripción.
 */
export function pendingPlanFor(
  subscription: Stripe.Subscription,
): Pick<
  SubscriptionWrite,
  "pendingPlan" | "pendingPlanAt" | "clearDowngradeRequest"
> {
  // `cancel_at` va en la condición porque es INDEPENDIENTE de `cancel_at_period_end`
  // (`Subscriptions.d.ts:129`) y se puede setear desde el dashboard.
  const scheduled =
    subscription.cancel_at !== null || subscription.cancel_at_period_end;
  if (!scheduled) {
    return {
      pendingPlan: null,
      pendingPlanAt: null,
      clearDowngradeRequest: false,
    };
  }
  // Acceso DEFENSIVO al periodo: `items` es un `ApiList` truncado y sin orden contractual;
  // `data[0]` pelado con la lista vacía tira `TypeError` DENTRO de la transacción →
  // rollback → reintento → mismo `TypeError`. «Sin fecha» es un caso válido.
  return {
    pendingPlan: "free",
    pendingPlanAt:
      fromUnixSeconds(subscription.cancel_at) ??
      fromUnixSeconds(subscription.items?.data?.[0]?.current_period_end),
    clearDowngradeRequest: false,
  };
}
