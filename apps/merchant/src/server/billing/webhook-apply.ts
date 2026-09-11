import type Stripe from "stripe";
import { eq, type SQL } from "drizzle-orm";

import { parseUuid } from "../counter/core";
import { withDbTransaction, type DbTransaction } from "../db";
import { lockBusiness } from "../locations/shared";
import { stripeWebhookEvents, subscriptions } from "../schema";
import {
  assessEventApplicability,
  canBindSubscriptionId,
} from "./applicability";
import { planFromSubscription, type IgnoredReason } from "./derive";
import type { StripeGateway } from "./gateway";
import { applySubscriptionState, readSubscription } from "./store";

/**
 * Spec 0063, D5.c-h — LO QUE PASA DENTRO DE LA SEGUNDA TRANSACCIÓN del webhook, un archivo
 * por tipo de camino. Vive separado de `webhook.ts` por el límite de 300 líneas del repo
 * (hook `file-size`: dividir, no extender), no porque sea otra preocupación: el orden de
 * operaciones y el por qué de cada paso están escritos en `webhook.ts`.
 *
 * Las dos funciones devuelven el `ignored_reason` con el que quedó el evento, o `null` si se
 * aplicó, y marcan `processed_at` DENTRO de su transacción (D5.b paso 5).
 */

/**
 * LO MÍNIMO que `markProcessed` necesita de un ejecutor de drizzle, declarado como interfaz
 * estructural y NO con un cast.
 *
 * Hace falta porque el `processed_at` se escribe desde los dos lados: DENTRO de la segunda
 * transacción (junto con la escritura de la fila, D5.b paso 5) y FUERA de toda transacción,
 * por `getDb()`, cuando el evento se descarta por tipo (paso 3) — ahí una transacción
 * interactiva sería un socket de más para un solo `UPDATE`. Los dos ejecutores tienen la
 * misma forma pero NO el mismo tipo: `NeonHttpQueryResult` no tiene el `oid` que
 * `QueryResult` exige, así que `Pick<DbTransaction, "update">` rechaza el `getDb()`.
 *
 * La tentación era `as unknown as …`, que apaga justamente el typecheck que la costura
 * compró: con el cast, un `set` con una columna que no existe compilaría igual. Con esta
 * interfaz, si la forma no coincide no compila — y la firma admite a los dos por estructura.
 */
export type EventUpdater = {
  update(table: typeof stripeWebhookEvents): {
    set(values: { processedAt: Date; ignoredReason?: IgnoredReason }): {
      where(condition: SQL): PromiseLike<unknown>;
    };
  };
};

export async function markProcessed(
  db: EventUpdater,
  eventId: string,
  ignoredReason: IgnoredReason | null,
): Promise<void> {
  await db
    .update(stripeWebhookEvents)
    .set({
      processedAt: new Date(),
      ...(ignoredReason === null ? {} : { ignoredReason }),
    })
    .where(eq(stripeWebhookEvents.eventId, eventId));
}

/**
 * (D5.c) `businessId`, EN ORDEN: metadata, después el `stripe_customer_id` (índice único,
 * resuelve sin ambigüedad), después nada → `unknown_business`.
 *
 * La versión vieja dejaba el `businessId` saliendo de la metadata con un `if (businessId)`
 * que, siendo falso, hacía que el evento NO HICIERA NADA EN SILENCIO.
 *
 * Ojo con el uuid: `business_id` es una columna `uuid`, así que compararla contra una
 * metadata arbitraria tira `22P02` → 500 → Stripe reintenta para siempre. `parseUuid` es el
 * mismo validador del resto del repo.
 */
async function confirmBusiness(
  tx: DbTransaction,
  candidate: unknown,
): Promise<string | null> {
  let businessId: string;
  try {
    businessId = parseUuid(candidate, "negocio");
  } catch {
    return null;
  }
  const [row] = await tx
    .select({ businessId: subscriptions.businessId })
    .from(subscriptions)
    .where(eq(subscriptions.businessId, businessId))
    .limit(1);
  return row?.businessId ?? null;
}

async function resolveBusinessId(
  tx: DbTransaction,
  subscription: Pick<Stripe.Subscription, "metadata" | "customer">,
): Promise<string | null> {
  const byMetadata = await confirmBusiness(
    tx,
    subscription.metadata?.businessId,
  );
  if (byMetadata !== null) return byMetadata;
  const customer = customerId(subscription.customer);
  if (customer === null) return null;
  const [row] = await tx
    .select({ businessId: subscriptions.businessId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, customer))
    .limit(1);
  return row?.businessId ?? null;
}

export function customerId(
  customer:
    | Stripe.Subscription["customer"]
    | Stripe.Checkout.Session["customer"],
): string | null {
  if (typeof customer === "string") return customer;
  return customer?.id ?? null;
}

/** El camino de `customer.subscription.created|updated|deleted`. */
export async function applySubscriptionEvent(
  gw: StripeGateway,
  event: Pick<Stripe.Event, "id" | "type" | "created">,
  subscriptionId: string,
  priceIds: { monthly: string; yearly: string },
): Promise<IgnoredReason | null> {
  // El `retrieve` va FUERA de toda transacción (D5.b paso 4): si falla, queda la fila del
  // claim con `processed_at IS NULL` y el reintento la vuelve a tomar.
  const subscription = await gw.subscriptions.retrieve(subscriptionId);
  return withDbTransaction(async (tx) => {
    const businessId = await resolveBusinessId(tx, subscription);
    if (businessId === null) {
      await markProcessed(tx, event.id, "unknown_business");
      return "unknown_business";
    }
    // Orden de locks: evento (el claim, ya commiteado) y después negocio.
    await lockBusiness(tx, businessId);
    const row = await readSubscription(tx, businessId);
    if (row === null) {
      await markProcessed(tx, event.id, "unknown_business");
      return "unknown_business";
    }
    const applicability = assessEventApplicability({
      event: { created: event.created },
      subscription,
      row,
      priceIds,
    });
    if (!applicability.apply) {
      // Un evento ignorado NO MUEVE `last_event_at` ([R2-M3]): si lo moviera, el guard de
      // orden podría tapar un evento legítimo posterior con `created` menor.
      await markProcessed(tx, event.id, applicability.ignoredReason);
      return applicability.ignoredReason;
    }
    const write = planFromSubscription({
      event: { type: event.type, created: event.created },
      subscription,
      row,
      priceIds,
    });
    await applySubscriptionState(tx, {
      businessId,
      subscription,
      write,
      // Se APLICÓ, así que el guard de orden avanza — también con `unknown_price` /
      // `unknown_status`, donde el plan no se toca pero el `status` crudo SÍ se registra.
      lastEventAt: new Date(event.created * 1000),
    });
    const reason = write.ignoredReason ?? null;
    await markProcessed(tx, event.id, reason);
    return reason;
  });
}

/**
 * (D5.a + m1-b) `checkout.session.completed`: SÓLO BINDEA IDS. No toca el plan — una sesión
 * puede completarse con `payment_status: 'unpaid'`, y el plan lo otorga el evento de
 * suscripción cuando el pago está confirmado.
 *
 * m1-b: el binding tampoco puede escribir sobre una fila NO ADOPTABLE. Una sesión vieja que
 * se completa tarde repuntaría `stripe_subscription_id` a una suscripción distinta de la que
 * está viva y facturando. El `businessId` sale de `client_reference_id`, que SÓLO lo escribe
 * nuestro checkout — ése sí es un discriminante legítimo, a diferencia de un campo que el
 * dashboard de Stripe también puede escribir.
 *
 * ESTE CAMINO NO MUEVE `last_event_at` Y NO APLICA EL GUARD DE ORDEN, y es una decisión de
 * implementación declarada en el handoff: no deriva ningún plan, y adelantar la marca sería
 * peligroso — `checkout.session.completed` y `customer.subscription.created` llegan casi
 * juntos y sin orden garantizado entre sus `created`, así que moverla acá dejaría al evento
 * de suscripción clasificado `stale_event` y el plan nunca se otorgaría. Es [R2-M3] aplicado
 * a este camino.
 */
export async function bindCheckoutSession(
  gw: StripeGateway,
  event: Pick<Stripe.Event, "id">,
  sessionId: string,
): Promise<IgnoredReason | null> {
  const session = await gw.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription?.id ?? null);
  return withDbTransaction(async (tx) => {
    const businessId = await confirmBusiness(tx, session.client_reference_id);
    if (businessId === null) {
      await markProcessed(tx, event.id, "unknown_business");
      return "unknown_business";
    }
    await lockBusiness(tx, businessId);
    const row = await readSubscription(tx, businessId);
    if (row === null) {
      await markProcessed(tx, event.id, "unknown_business");
      return "unknown_business";
    }
    if (subscriptionId === null) {
      // Una sesión completada que no creó ninguna suscripción (no es `mode:"subscription"`)
      // no tiene nada que bindear. Vocabulario nuevo, declarado en el handoff.
      await markProcessed(tx, event.id, "session_without_subscription");
      return "session_without_subscription";
    }
    if (!canBindSubscriptionId(row, subscriptionId)) {
      await markProcessed(tx, event.id, "foreign_subscription");
      return "foreign_subscription";
    }
    const customer = customerId(session.customer);
    await tx
      .update(subscriptions)
      .set({
        ...(customer === null ? {} : { stripeCustomerId: customer }),
        stripeSubscriptionId: subscriptionId,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.businessId, businessId));
    await markProcessed(tx, event.id, null);
    return null;
  });
}
