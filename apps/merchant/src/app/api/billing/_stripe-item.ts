import type Stripe from "stripe";
import {
  matchPrice,
  type BillingInterval,
  type PaidPlan,
  type PriceIds,
} from "../../../server/billing";
import { BillingError } from "./_auth";

/**
 * Lo que comparten `plan` e `interval` (spec 0189 §D7), que cambian el precio del ÚNICO item
 * nuestro de la suscripción. Vive en un módulo `_` porque un Route Handler de Next solo puede
 * exportar handlers (el mismo motivo que `_auth.ts`).
 */

/**
 * El ÚNICO item cuyo price es de nuestra cuenta, con el plan e intervalo de ESE price. Cero,
 * más de uno, o una lista truncada (`has_more`) son el mismo caso: no sabemos cuál cambiar,
 * así que no se toca nada (409 `interval_ambiguous`, spec 0063 D9 [R2-5]). `items` viene
 * truncado a 10 y sin orden contractual: elegir `data[0]` para ESCRIBIR un precio sería el
 * error que D5.f prohíbe para leer.
 */
export function soleOurItem(
  subscription: Stripe.Subscription,
  priceIds: PriceIds,
): {
  item: Stripe.SubscriptionItem;
  plan: PaidPlan;
  interval: BillingInterval;
} {
  const ambiguous = new BillingError(
    409,
    "interval_ambiguous",
    "No pudimos identificar el plan a cambiar. Escríbenos y lo resolvemos.",
  );
  if (subscription.items.has_more) throw ambiguous;
  const ours = subscription.items.data.flatMap((item) => {
    const match = matchPrice(priceIds, item.price.id);
    return match === null ? [] : [{ item, ...match }];
  });
  if (ours.length !== 1) throw ambiguous;
  return ours[0];
}

/** `type` es el nombre de la clase salvo que se construya con el 2.º argumento
 * (`Error.js:79`), y `rawType` es el `type` que mandó la API. Se miran los dos y no
 * `instanceof`: un `instanceof` contra la clase importada acá se rompe si el que construyó el
 * error cargó otra copia del módulo. */
export function isCardError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { type?: unknown; rawType?: unknown };
  return (
    candidate.type === "StripeCardError" || candidate.rawType === "card_error"
  );
}

/** Una tarjeta rechazada en `plan`/`interval` es 402 `payment_failed` y no se escribe nada:
 * con `payment_behavior: "error_if_incomplete"` Stripe tampoco aplicó el cambio. */
export function cardErrorAsPaymentFailed(error: unknown): unknown {
  return isCardError(error)
    ? new BillingError(
        402,
        "payment_failed",
        "Tu tarjeta rechazó el cobro. No cambiamos nada: revisa el medio de pago y vuelve a intentarlo.",
      )
    : error;
}
