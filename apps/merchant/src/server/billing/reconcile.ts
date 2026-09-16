import type Stripe from "stripe";

import { withDbTransaction } from "../db";
import { lockBusiness } from "../locations/shared";
import { assessEventApplicability } from "./applicability";
import { planFromSubscription } from "./derive";
import { DEAD_STRIPE_STATUS } from "./plan-change";
import type { StripeGateway } from "./gateway";
import { applySubscriptionState, readSubscription } from "./store";

/**
 * Spec 0063, D8 — LA RECONCILIACIÓN CON STRIPE, separada de `store.ts` por el límite de 300
 * líneas del repo (hook `file-size`: dividir, no extender) al entrar el freno defensivo de
 * la spec 0065. NO es otra preocupación: escribe por `applySubscriptionState`, el mismo
 * `SET` que el webhook, y ese sigue siendo el punto donde las dos superficies no pueden
 * divergir.
 */
export type ReconcileOutcome =
  | { reconciled: true }
  | {
      reconciled: false;
      /** Cada motivo dice UNA cosa distinta, y la fase C los traduce a lo que ve el owner:
       * `no_customer` = la fila no tiene `stripe_customer_id`, así que no hay por dónde
       * preguntar; `no_subscription_row` = el negocio no tiene fila de suscripción (no debería
       * pasar, el unique de D3 y la FK lo hacen improbable, pero prestarle el motivo del
       * customer mandaría a diagnosticar otra cosa); `no_subscriptions` = Stripe contestó una
       * lista VACÍA, que NO alcanza para degradar un plan; `ignored` = el guard de pertenencia
       * o de adopción lo frenó. */
      reason:
        | "no_customer"
        | "no_subscription_row"
        | "no_subscriptions"
        | "ignored";
    };

/**
 * D8 — RECONCILIACIÓN CON STRIPE. `subscription_live` (D4) es la pieza que evita facturar
 * dos veces y se calcula sobre NUESTRA base, cuyo único escritor es el webhook: si el
 * webhook se perdió un evento, la fila queda divergente y `checkout` crea una SEGUNDA
 * suscripción viva → doble cobro. Esto lo detecta al abrir la página.
 *
 * `status: "all"` es normativo: `list` sin `status` «no devuelve las canceladas»
 * (`Subscriptions.d.ts:2661`), o sea que era ciego a la mitad de la deriva. Se elige la
 * NO MUERTA más reciente; si no hay ninguna no muerta, la más reciente.
 *
 * CON LA LISTA VACÍA NO SE ESCRIBE NADA (mutación M16): vacío con `status:"all"` significa
 * «este customer nunca tuvo suscripción», que no alcanza para degradar un plan desde el
 * render de una página.
 *
 * DOS COSAS QUE LA SPEC NO FIJA Y ACÁ SE DECIDEN, declaradas en el handoff como hallazgos:
 *
 *  1. La reconciliación aplica el guard de PERTENENCIA/ADOPCIÓN (el mismo
 *     `assessEventApplicability`, que es lo que pide «el mismo guard»), pero el guard de
 *     ORDEN queda neutralizado por construcción: se le pasa `created = ahora`, así que
 *     nunca puede ser «stale». No hay ningún evento cuyo orden respetar — lo que se lee es
 *     el estado ACTUAL de Stripe.
 *  2. Y por eso tampoco MUEVE `last_event_at`: si lo moviera a `now`, un evento legítimo
 *     que llegara después con un `created` anterior quedaría clasificado `stale_event` y se
 *     perdería. Es [R2-M3] aplicado a este camino.
 */
export async function reconcileFromStripe(
  gw: StripeGateway,
  args: {
    businessId: string;
    stripeCustomerId: string | null;
    priceIds: { monthly: string; yearly: string };
  },
): Promise<ReconcileOutcome> {
  if (args.stripeCustomerId === null) {
    return { reconciled: false, reason: "no_customer" };
  }
  const list = await gw.subscriptions.list({
    customer: args.stripeCustomerId,
    status: "all",
    limit: 10,
  });
  const chosen = pickReconcilable(list.data);
  if (!chosen) return { reconciled: false, reason: "no_subscriptions" };

  return withDbTransaction(async (tx) => {
    await lockBusiness(tx, args.businessId);
    const row = await readSubscription(tx, args.businessId);
    if (!row) return { reconciled: false, reason: "no_subscription_row" };
    const applicability = assessEventApplicability({
      event: { created: Math.floor(Date.now() / 1000) },
      subscription: chosen,
      row,
      priceIds: args.priceIds,
    });
    if (!applicability.apply) return { reconciled: false, reason: "ignored" };
    const write = planFromSubscription({
      // No hay evento: `type` no puede ser `customer.subscription.deleted` porque no hay
      // ningún hecho de terminación que reportar — lo terminal, si lo hay, lo dice el
      // `status` de la suscripción recuperada.
      event: { type: "reconcile", created: Math.floor(Date.now() / 1000) },
      subscription: chosen,
      row,
      priceIds: args.priceIds,
    });
    await applySubscriptionState(tx, {
      businessId: args.businessId,
      subscription: chosen,
      write,
      lastEventAt: null,
    });
    return { reconciled: true };
  });
}

/** La no muerta más reciente; si no hay ninguna no muerta, la más reciente. */
function pickReconcilable(
  data: Stripe.Subscription[],
): Stripe.Subscription | null {
  const byNewest = [...data].sort((a, b) => b.created - a.created);
  const live = byNewest.find(
    (item) => !DEAD_STRIPE_STATUS.has(item.status as string),
  );
  return live ?? byNewest[0] ?? null;
}
