import type Stripe from "stripe";
import { withDbTransaction } from "../../../../server/db";
import {
  BillingError,
  billingErrorResponse,
  billingStateResponse,
  decideUnderLock,
  readBody,
  requireBillingOwner,
  stripeContext,
} from "../_auth";

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
 *  3. SELECCIÓN EXPLÍCITA: el único item cuyo `price.id` está en {monthly, yearly}. Con 0,
 *     con más de 1, o con `items.has_more === true` → NO SE TOCA NADA, 409
 *     `interval_ambiguous`. D5.f ya estableció que `items` viene truncado a 10 y sin orden
 *     contractual: elegir `data[0]` para ESCRIBIR un precio sería el mismo error que ahí se
 *     prohíbe para leer.
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
    const item = soleOurItem(subscription, priceIds);
    await gateway.subscriptions.update(
      subscriptionId,
      {
        items: [{ id: item.id, price: priceIds.yearly }],
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
      isCardError(error)
        ? new BillingError(
            402,
            "payment_failed",
            "Tu tarjeta rechazó el cobro. No cambiamos nada: revisa el medio de pago y vuelve a intentarlo.",
          )
        : error,
      "No pudimos cambiar el intervalo. Vuelve a intentarlo.",
    );
  }
}

/** El ÚNICO item cuyo price es de nuestra cuenta. Cero, más de uno, o una lista truncada son
 * el mismo caso: no sabemos cuál cambiar, así que no se toca nada. */
function soleOurItem(
  subscription: Stripe.Subscription,
  priceIds: { monthly: string; yearly: string },
): Stripe.SubscriptionItem {
  const ambiguous = new BillingError(
    409,
    "interval_ambiguous",
    "No pudimos identificar el plan a cambiar. Escríbenos y lo resolvemos.",
  );
  if (subscription.items.has_more) throw ambiguous;
  const ours = subscription.items.data.filter(
    (item) =>
      item.price.id === priceIds.monthly || item.price.id === priceIds.yearly,
  );
  if (ours.length !== 1) throw ambiguous;
  return ours[0];
}

/** `type` es el nombre de la clase salvo que se construya con el 2.º argumento
 * (`Error.js:79`), y `rawType` es el `type` que mandó la API. Se miran los dos y no
 * `instanceof`: un `instanceof` contra la clase importada acá se rompe si el que construyó el
 * error cargó otra copia del módulo. */
function isCardError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { type?: unknown; rawType?: unknown };
  return (
    candidate.type === "StripeCardError" || candidate.rawType === "card_error"
  );
}
