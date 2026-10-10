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
 * Spec 0189 §D7 / ADR 0134 §9 — `POST /api/billing/plan` `{to: "base"|"plus"}`: cambiar de plan
 * con la suscripción VIVA. Subir a plus cobra la diferencia prorrateada en el acto
 * (`always_invoice`); bajar a base rige desde la próxima factura, sin devolución (`none`), y
 * exige el mismo ajuste previo que siempre (archivar locales, apagar campañas fuera del base):
 * lo decide `decidePlanChange` bajo el lock.
 *
 * ORDEN DE OPERACIONES (el de `interval`, que ya está probado):
 *  1. gate + `decidePlanChange` bajo `lockBusiness`. Si bloquea: 409.
 *  2. FUERA del lock: `retrieve` y el ÚNICO item nuestro (`soleOurItem`, 409
 *     `interval_ambiguous` si no hay exactamente uno).
 *  3. `update` del item al precio `to` del MISMO intervalo, con `payment_behavior:
 *     "error_if_incomplete"`: una tarjeta rechazada falla el `update` entero (402
 *     `payment_failed`) en vez de dejar la suscripción `past_due` con el precio nuevo.
 *  4. EL PLAN DE LA FILA LO ESCRIBE EL WEBHOOK, derivándolo del price que matcheó (§D5): un
 *     solo escritor del campo, y la fila nunca afirma un plan que Stripe no confirmó.
 *
 * La `idempotencyKey` lleva el `current_period_end` del item: un reintento del mismo pedido
 * reusa la respuesta, y un cambio en otro periodo estrena clave.
 */
export async function POST(request: Request) {
  const gate = await requireBillingOwner(request);
  if ("response" in gate) return gate.response;
  const businessId = gate.business.id;
  try {
    const body = await readBody(request);
    const to = body.to === "base" ? "base" : body.to === "plus" ? "plus" : null;
    if (to === null) {
      throw new BillingError(400, "invalid_input", "El plan no es válido.");
    }
    const { gateway, priceIds } = stripeContext();
    const { subscriptionId, proration } = await withDbTransaction(
      async (tx) => {
        const { row, decision } = await decideUnderLock(tx, businessId, {
          kind: "change_plan",
          to,
        });
        // Con `intent: change_plan`, lo único que no es `blocked` es `change_plan`.
        if (decision.kind !== "change_plan") throw new Error(decision.kind);
        return {
          // `change_plan` sólo se decide con `hasLiveSubscription`, que exige el id.
          subscriptionId: row.stripeSubscriptionId as string,
          proration: decision.proration,
        };
      },
    );

    const subscription = await gateway.subscriptions.retrieve(subscriptionId);
    const { item, interval } = soleOurItem(subscription, priceIds);
    await gateway.subscriptions.update(
      subscriptionId,
      {
        items: [{ id: item.id, price: priceIds[to][interval] }],
        proration_behavior: proration,
        payment_behavior: "error_if_incomplete",
      },
      {
        idempotencyKey: `billing:plan:${subscriptionId}:${to}:${item.current_period_end}`,
      },
    );
    return await billingStateResponse(businessId);
  } catch (error) {
    return billingErrorResponse(
      cardErrorAsPaymentFailed(error),
      "No pudimos cambiar el plan. Vuelve a intentarlo.",
    );
  }
}
