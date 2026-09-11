import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getDb } from "../db";
import { getStripeClient, getStripeConfiguration } from "../stripe-config";
import { claimEvent } from "./claim";
import type { IgnoredReason } from "./derive";
import { asStripeGateway } from "./gateway";
import {
  applySubscriptionEvent,
  bindCheckoutSession,
  markProcessed,
} from "./webhook-apply";

/**
 * Spec 0063, D5 — EL WEBHOOK. Reemplaza al handler que escribía `plan: "plus"` para
 * CUALQUIER evento `customer.subscription.*` (incluido `deleted`) y que marcaba el evento
 * como recibido ANTES de procesarlo, con lo cual un fallo en el procesamiento hacía que el
 * reintento de Stripe contestara `{duplicate:true}` y el evento no se procesara nunca.
 *
 * EL PAYLOAD ES UN DISPARADOR, NO UNA FUENTE DE DATOS. Se leen CINCO campos y nada más:
 * `type`, `id`, `created`, el `data.object.id` que la tabla de D5.a prescribe para el
 * `retrieve`, y `api_version` — que NO es estado de la suscripción sino la versión con la que
 * Stripe serializó ESE payload, y va a `payload_version` para poder diagnosticar después
 * exactamente el desfase que describe el párrafo de abajo. La forma del
 * JSON entrante la fija la `api_version` del ENDPOINT (en prod `2020-08-27`), no el SDK, así
 * que `items.data[0].current_period_end` llega `undefined` CON EL TYPECHECK EN VERDE. Todo
 * el estado sale de `subscriptions.retrieve` / `checkout.sessions.retrieve`, cuya respuesta
 * viene en la versión del SDK y está correctamente tipada.
 */

/**
 * (D5.a) ALLOW-LIST DE TIPOS. Al endpoint llegan eventos que NO son
 * `customer.subscription.*`: en la base de prod ya hay `invoice.paid` (cuyo `id` es un
 * `in_…`) y `checkout.session.completed` (un `cs_…`). Pasarle esos ids a
 * `subscriptions.retrieve` tira `resource_missing`, y si encima el claim fuera después, no
 * quedaría NINGUNA fila → Stripe reintenta → mismo error → hasta desactivar el endpoint.
 */
const CHECKOUT_EVENT = "checkout.session.completed";

export const HANDLED_EVENT_TYPES: ReadonlySet<string> = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  CHECKOUT_EVENT,
]);

/**
 * (D5.b) ORDEN DE OPERACIONES Y DE LOCKS. Es normativo:
 *
 *  1. firma (`constructEvent`). Si falla: 400 SIN FILA — no sabemos si el request era de
 *     Stripe. Es el único camino que no deja rastro, y es correcto (D11).
 *  2. CLAIM, en su propia transacción corta (`claim.ts`). Devuelve TRES resultados y cada
 *     uno tiene su respuesta: `claimed` sigue; `already_processed` → `200 {duplicate:true}`;
 *     `in_flight` → **409**, que NO es un 2xx a propósito, para que Stripe reintente (D12,
 *     ADR 0061). Los dos rechazos hacen `return` INMEDIATO, antes de tocar la red.
 *     [R1-M1] Un `ON CONFLICT DO UPDATE` que FALLA el filtro deja la fila del
 *     evento LOCKEADA HASTA EL COMMIT (un revisor lo ejecutó: una tercera sesión con
 *     `SELECT … FOR UPDATE` queda esperando en `Lock/transactionid`), así que nada lento
 *     puede quedar después del claim dentro de esa transacción. Acá el claim es UN statement
 *     por `getDb()` (neon-http, autocommit): no hay «después» posible dentro de ella.
 *  3. tipo fuera de la allow-list → `processed_at` + `ignored_reason`, 200, SIN `retrieve`.
 *  4. `retrieve` — FUERA DE TODA TRANSACCIÓN. Si falla: 500 sin marcar procesado. Como el
 *     claim ya ocurrió, queda FILA CON `processed_at IS NULL`, que es la señal de
 *     diagnóstico de D11; el reintento de Stripe la vuelve a tomar.
 *  5. segunda transacción: resolver `businessId` → `lockBusiness` → guard → escribir →
 *     `processed_at`. EN ESE ORDEN DE LOCKS (evento, negocio), por convención, para que
 *     ningún camino futuro los tome al revés. Vive en `webhook-apply.ts`.
 *
 * [R2-B4] `lockBusiness` ACÁ NO ES POR EL TOPE DE LOCALES. El lock serializa, no ordena: si
 * un desarchivado concurrente gana el lock primero es una operación VÁLIDA (3 ≤ 3) y el
 * sobre-tope resultante es justo lo que D1 declara tolerado. El motivo real es la
 * CONSISTENCIA DEL READ-MODIFY-WRITE de `core.subscription` frente a `cancel` / `resume` /
 * `settle-free`: `planFromSubscription` decide `free` vs `none` leyendo
 * `downgrade_requested_at` DE LA FILA, así que sin el lock un `cancel` que commitea entre la
 * lectura y la escritura se pierde — el evento escribe `none` sobre una baja que sí pedimos,
 * y encima la limpia. Mutación M4.
 */
export async function handleStripeWebhook(request: Request): Promise<Response> {
  let stripe: Stripe;
  let priceIds: { monthly: string; yearly: string };
  let secret: string | undefined;
  try {
    const configuration = getStripeConfiguration();
    stripe = getStripeClient(configuration);
    secret = configuration.webhookSecret;
    priceIds = {
      monthly: configuration.monthlyPriceId,
      yearly: configuration.yearlyPriceId,
    };
  } catch {
    return new NextResponse("Webhook no configurado.", { status: 400 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) {
    return new NextResponse("Webhook no configurado.", { status: 400 });
  }
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return new NextResponse("Firma inválida.", { status: 400 });
  }

  const claim = await claimEvent(event);
  // (D12.b) Las TRES respuestas del claim. No se colapsan dos en una: `already_processed`
  // es «terminado de verdad» y Stripe DEBE dejar de reintentar; `in_flight` es «otro lo
  // tiene tomado, o lo tomó y murió» y Stripe TIENE que reintentar. Un 2xx ahí le prometería
  // a Stripe que el evento está terminado y un evento cuya primera entrega murió no se
  // procesaría nunca (ADR 0061). El cuerpo del 409 es texto plano como el resto de los
  // caminos de error de la ruta: el JSON de esta ruta significa «lo recibimos».
  if (claim === "already_processed") {
    return NextResponse.json({ received: true, duplicate: true });
  }
  if (claim === "in_flight") {
    return new NextResponse("Evento en proceso.", { status: 409 });
  }
  if (!HANDLED_EVENT_TYPES.has(event.type)) {
    await markProcessed(getDb(), event.id, "event_type_not_handled");
    return ignoredResponse("event_type_not_handled");
  }
  const objectId = payloadObjectId(event);
  if (objectId === null) {
    await markProcessed(getDb(), event.id, "unknown_business");
    return ignoredResponse("unknown_business");
  }

  const gateway = asStripeGateway(stripe);
  let ignoredReason: IgnoredReason | null;
  try {
    ignoredReason =
      event.type === CHECKOUT_EVENT
        ? await bindCheckoutSession(gateway, event, objectId)
        : await applySubscriptionEvent(gateway, event, objectId, priceIds);
  } catch {
    // 500 SIN marcar procesado. El claim ya dejó la fila con `processed_at IS NULL`, que es
    // lo que distingue «Stripe nunca entregó» (no hay fila) de «lo tomamos y falló».
    return new NextResponse("No se pudo procesar el evento.", { status: 500 });
  }
  return ignoredReason === null
    ? NextResponse.json({ received: true })
    : ignoredResponse(ignoredReason);
}

function ignoredResponse(ignoredReason: IgnoredReason) {
  return NextResponse.json({ received: true, ignored: ignoredReason });
}

/** El `id` del objeto del payload: el único campo que la tabla de D5.a autoriza a leer
 * además de `type`, `id` y `created`, y sólo para pasárselo al `retrieve`. */
function payloadObjectId(event: Stripe.Event): string | null {
  const object = event.data.object as { id?: unknown };
  return typeof object.id === "string" ? object.id : null;
}
