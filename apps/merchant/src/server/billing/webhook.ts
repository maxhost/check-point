import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { sql } from "drizzle-orm";

import { getDb } from "../db";
import { stripeWebhookEvents } from "../schema";
import { getStripeClient, getStripeConfiguration } from "../stripe-config";
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
 *  2. CLAIM, en su propia transacción corta. Sin fila → `200 {duplicate:true}` y `return`
 *     INMEDIATO. [R1-M1] Un `ON CONFLICT DO UPDATE` que FALLA el filtro deja la fila del
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

  if (!(await claimEvent(event))) {
    return NextResponse.json({ received: true, duplicate: true });
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

/**
 * (D5.g) EL CLAIM. La ortografía es LOAD-BEARING, y está demostrado mutándola: con
 * `WHERE excluded.processed_at IS NULL` —el error natural, porque `excluded` es la fila
 * PROPUESTA y ahí `processed_at` siempre es `NULL`— el claim sobre una fila YA PROCESADA
 * devuelve 1 fila: LA OTORGA. El guard se vuelve un no-op con el statement visualmente
 * idéntico (mutación M7).
 *
 * `setWhere` referencia LA TABLA, no `excluded`, y drizzle la renderiza calificada
 * (`"core"."stripe_webhook_event"."processed_at"`, verificado con `toSQL()`). El `EXPLAIN`
 * sobre Neon da `Conflict Filter: (stripe_webhook_event.processed_at IS NULL)` — NO
 * `InitPlan` ni `One-Time Filter`: es el nodo que se evalúa sobre la fila YA LOCKEADA, en su
 * versión más nueva, que es la distinción del ADR 0054.
 *
 * QUÉ GARANTIZA ESTE GUARD Y QUÉ NO — acotado a lo que está MEDIDO contra Neon, porque la
 * versión anterior de este comentario afirmaba «UNA SOLA ENTREGA GANA EL CLAIM» y eso es falso
 * para el solape (ADR 0054 del lado del comentario, tres líneas arriba del statement).
 *
 *  - SÍ: una REENTREGA SECUENCIAL de un evento ya procesado NO vuelve a ganar el claim —
 *    responde `{duplicate:true}` y no se vuelve a aplicar. Ése es el reintento de Stripe, el
 *    caso real, y el bug del §Problema-4 (la versión vieja marcaba el evento recibido ANTES de
 *    procesarlo, así que un fallo hacía que el reintento contestara `{duplicate:true}` y el
 *    evento no se procesara NUNCA). Es lo que muerde con las mutaciones M3 y M7, que comparten
 *    ese observable. El observable NO es el estado final: aplicar el mismo `UPDATE` dos veces
 *    deja exactamente la misma fila, así que un test de estado final quedaría verde con el
 *    guard roto.
 *  - NO: dos entregas que SE SOLAPAN ganan las dos, y la segunda contesta `{received:true}`
 *    sin `duplicate`. Medido contra Neon. No es un descuido: [R1-M1] obliga a que el claim sea
 *    su propia transacción corta y commitee ANTES del `retrieve` —dejarlo abierto deja la fila
 *    del evento lockeada hasta el final del procesamiento—, así que la segunda entrega
 *    encuentra `processed_at IS NULL` mientras la primera está en la red. Lo que sí vale
 *    siempre es: UNA fila de evento, procesada, y el estado final correcto.
 *
 * Cerrar el solape es una DECISIÓN PENDIENTE, con su costo real (verificado, y más barato de
 * lo que decía el handoff de la fase B) escrito en el §Plan de mutaciones de la spec.
 *
 * `payload_version` sale de `event.api_version`: es el dato que prueba en qué versión
 * serializó Stripe el payload (en prod, `2020-08-27`).
 */
async function claimEvent(event: Stripe.Event): Promise<boolean> {
  const claimed = await getDb()
    .insert(stripeWebhookEvents)
    .values({
      eventId: event.id,
      eventType: event.type,
      payloadVersion: event.api_version ?? "unknown",
    })
    .onConflictDoUpdate({
      target: stripeWebhookEvents.eventId,
      set: { receivedAt: new Date() },
      setWhere: sql`${stripeWebhookEvents.processedAt} is null`,
    })
    .returning({ eventId: stripeWebhookEvents.eventId });
  return claimed.length > 0;
}

/** El `id` del objeto del payload: el único campo que la tabla de D5.a autoriza a leer
 * además de `type`, `id` y `created`, y sólo para pasárselo al `retrieve`. */
function payloadObjectId(event: Stripe.Event): string | null {
  const object = event.data.object as { id?: unknown };
  return typeof object.id === "string" ? object.id : null;
}
