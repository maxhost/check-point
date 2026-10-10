import { withDbTransaction } from "@mi-pasaporte/db";
import {
  BillingError,
  billingErrorResponse,
  billingStateResponse,
  decideUnderLock,
  readBody,
  requireBillingOwner,
  stripeContext,
} from "../_auth";
import { cardErrorAsPaymentFailed, soleOurItem } from "../_stripe-item";

/**
 * Spec 0063, D9 — `POST /api/billing/interval`: cambio de intervalo, SÓLO mensual → anual.
 * El sentido inverso lo rechaza `decidePlanChange` con `interval_downgrade_unsupported` y es
 * la tarea 55: hacerlo bien exige `subscription_schedules`, porque `proration_behavior:
 * 'none'` NO significa «aplicalo al final del periodo» sino «no generes créditos por el tiempo
 * no usado, y cobrá igual ahora» (`Subscriptions.d.ts:50`) — o sea la peor opción para el
 * cliente, que pierde lo que pagó y se le cobra de nuevo.
 *
 * No cambia el tope de locales, así que no toca el invariante de D1.
 *
 * ORDEN DE OPERACIONES:
 *  1. gate + `decidePlanChange`. Si bloquea: 409.
 *  2. `subscriptions.retrieve` — DE ACÁ SALE EL `itemId`, y no se persiste: el id del item
 *     puede cambiar y una copia nuestra sería una segunda fuente de verdad. ([R2-5]: la
 *     versión anterior de la spec escribía `items: [{ id: itemId }]` con un `itemId` que NO
 *     EXISTÍA en ninguna parte del sistema — ni columna, ni payload, ni body.)
 *  3. SELECCIÓN EXPLÍCITA (`soleOurItem`): el único item cuyo `price.id` es uno de los
 *     cuatro nuestros (spec 0189 §D5). Con 0, con más de 1, o con `items.has_more === true`
 *     → NO SE TOCA NADA, 409 `interval_ambiguous`. El precio anual es el del PLAN de ese
 *     item (base o plus): cambiar el intervalo no cambia el plan.
 *  4. `update` con `payment_behavior: "error_if_incomplete"`, que es NORMATIVO: el DoD afirma
 *     «cobra la diferencia en el acto», y con el default un cobro rechazado dejaría la factura
 *     abierta, la suscripción hacia `past_due` CON EL PRICE ANUAL YA APLICADO y este handler
 *     devolviendo 200 — la fila mintiendo. Con `error_if_incomplete` el `update` falla y no se
 *     aplica nada. Mutación M17.
 *  5. `StripeCardError` → **402 `payment_failed`**, sin escribir nada.
 *  6. EL `interval` DE LA FILA LO ESCRIBE EL WEBHOOK, no esta ruta, derivándolo del price que
 *     matcheó (D5.d). Así no hay dos escritores del mismo campo y la fila nunca afirma un
 *     intervalo que Stripe no confirmó.
 */
export async function POST(request: Request) {
  const gate = await requireBillingOwner(request);
  if ("response" in gate) return gate.response;
  const businessId = gate.business.id;
  try {
    const body = await readBody(request);
    const to =
      body.to === "year" ? "year" : body.to === "month" ? "month" : null;
    if (to === null) {
      throw new BillingError(
        400,
        "invalid_input",
        "El intervalo no es válido.",
      );
    }
    const { gateway, priceIds } = stripeContext();
    const subscriptionId = await withDbTransaction(async (tx) => {
      const { row } = await decideUnderLock(tx, businessId, {
        kind: "change_interval",
        to,
      });
      return row.stripeSubscriptionId as string;
    });

    const subscription = await gateway.subscriptions.retrieve(subscriptionId);
    const { item, plan } = soleOurItem(subscription, priceIds);
    await gateway.subscriptions.update(
      subscriptionId,
      {
        items: [{ id: item.id, price: priceIds[plan].year }],
        proration_behavior: "always_invoice",
        payment_behavior: "error_if_incomplete",
      },
      {
        idempotencyKey: `billing:interval:${subscriptionId}:${to}:${item.current_period_end}`,
      },
    );
    return await billingStateResponse(businessId);
  } catch (error) {
    return billingErrorResponse(
      cardErrorAsPaymentFailed(error),
      "No pudimos cambiar el intervalo. Vuelve a intentarlo.",
    );
  }
}
