import type { PriceIds } from "../stripe-config";

/**
 * Spec 0189 §D5 — LOS CUATRO PRECIOS DE STRIPE COMO DATO. Antes cada guard comparaba contra
 * `{monthly, yearly}` de un solo plan; ahora el precio que matcheo dice el PLAN y el INTERVALO,
 * y esta es la unica funcion que hace esa traduccion (derivacion, adopcion, reconciliacion y el
 * item a cambiar en `plan`/`interval`).
 *
 * `import type` de `stripe-config`: no arrastra el SDK ni crea ciclo con los supports de test.
 */
export type { PriceIds } from "../stripe-config";

export type PaidPlan = "base" | "plus";
export type BillingInterval = "month" | "year";

const PLANS: readonly PaidPlan[] = ["base", "plus"];
const INTERVALS: readonly BillingInterval[] = ["month", "year"];

/** El plan e intervalo de un `price.id` de NUESTRA cuenta, o `null` si es ajeno. */
export function matchPrice(
  priceIds: PriceIds,
  priceId: string | null | undefined,
): { plan: PaidPlan; interval: BillingInterval } | null {
  if (typeof priceId !== "string") return null;
  for (const plan of PLANS) {
    for (const interval of INTERVALS) {
      if (priceIds[plan][interval] === priceId) return { plan, interval };
    }
  }
  return null;
}

/** ¿Es un precio nuestro? (el discriminante de adopcion de `applicability.ts`). */
export function isOurPrice(
  priceIds: PriceIds,
  priceId: string | null | undefined,
): boolean {
  return matchPrice(priceIds, priceId) !== null;
}
