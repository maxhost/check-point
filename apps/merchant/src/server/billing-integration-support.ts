import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { NextRequest } from "next/server";
import Stripe from "stripe";

import {
  stripeClientDouble,
  stripeSubscription,
  type FakeStripe,
} from "./billing-stripe-fake";
import type { SeededSubscription } from "./locations-integration-support";
import { getDb } from "./db";
import { locations, stripeWebhookEvents, subscriptions } from "./schema";

/**
 * Spec 0063, [R2-I7] — el mundo compartido de la integración de billing: las env, el
 * constructor de payloads FIRMADOS y los lectores por SQL. El doble de Stripe se mudó a
 * `billing-stripe-fake.ts` (ver el bloque de reexports).
 *
 * Vive fuera de los `.test.ts` por el límite de 300 líneas del repo; no lo usa nada de
 * producción.
 */

/**
 * LAS 5 ENV DE STRIPE, con valores falsos que PASAN la validación real de
 * `stripe-config.ts`: el prefijo `sk_test_` tiene que coincidir con
 * `STRIPE_ENVIRONMENT=test` (`stripe-config.ts:29-31`) o `getStripeConfiguration()` tira y el
 * webhook contesta 400 «Webhook no configurado» — un test podría quedar VERDE aseverando el
 * 400 equivocado. `.env.integration.local` tiene sólo las 3 `NEON_INTEGRATION_*`, así que
 * estas se ponen con `vi.stubEnv` desde el test (patrón de `stripe-config.test.ts:10-16`).
 *
 * La red NO se toca: el gateway va fakeado y la firma se construye localmente con este mismo
 * `whsec_` falso.
 */
export const STRIPE_TEST_ENV = {
  STRIPE_ENVIRONMENT: "test",
  STRIPE_SECRET_KEY_TEST: "sk_test_falsa_para_la_integracion",
  STRIPE_WEBHOOK_SECRET_TEST: "whsec_falso_para_la_integracion",
  STRIPE_PRICE_PLUS_MONTHLY_TEST: "price_plus_monthly",
  STRIPE_PRICE_PLUS_YEARLY_TEST: "price_plus_yearly",
} as const;

export const MONTHLY_PRICE = STRIPE_TEST_ENV.STRIPE_PRICE_PLUS_MONTHLY_TEST;
export const YEARLY_PRICE = STRIPE_TEST_ENV.STRIPE_PRICE_PLUS_YEARLY_TEST;
export const PRICE_IDS = { monthly: MONTHLY_PRICE, yearly: YEARLY_PRICE };

/**
 * EL DOBLE DE STRIPE VIVE EN `billing-stripe-fake.ts` — corte de tamaño decidido por el
 * orquestador antes de despachar la fase D (este archivo estaba en 297/300 y la fase D tiene
 * que extender el fake). Se REEXPORTA para que ningún test de las fases B/C —que tienen PASS
 * de revisor— cambie de import: un churn gratuito en archivos ya revisados es ruido que tapa
 * el diff real.
 */
export {
  fakeStripe,
  stripeClientDouble,
  stripeSession,
  stripeSubscription,
} from "./billing-stripe-fake";
export type { FakeStripe, SubscriptionSpec } from "./billing-stripe-fake";

export type EventSpec = {
  id: string;
  type: string;
  created?: number;
  object: Record<string, unknown>;
  apiVersion?: string;
};

/**
 * El cuerpo del evento tal como Stripe lo serializa, con la `api_version` del ENDPOINT
 * —`2020-08-27` en prod— y NO la del SDK. El código bajo prueba no puede leer nada de acá
 * fuera de `type`, `id` y `created` (+ el `data.object.id` para el `retrieve`), así que el
 * objeto va a propósito INCOMPLETO: si alguien empezara a leer campos del payload, estos
 * tests no se lo taparían.
 */
export function eventBody(spec: EventSpec): string {
  return JSON.stringify({
    id: spec.id,
    object: "event",
    api_version: spec.apiVersion ?? "2020-08-27",
    created: spec.created ?? Math.floor(Date.UTC(2026, 8, 10) / 1000),
    type: spec.type,
    data: { object: spec.object },
    livemode: false,
    pending_webhooks: 0,
    request: null,
  });
}

/**
 * El request firmado. `generateTestHeaderString` (`cjs/Webhooks.d.ts:74`) produce la cabecera
 * `Stripe-Signature` real, así que la ruta completa —firma, claim y runtime— tiene oráculo y
 * no hace falta declarar ningún límite ahí.
 *
 * El `secret` es un parámetro y no una constante para que un test pueda firmar con el
 * EQUIVOCADO y verificar que el 400 llega por la firma y no por la configuración.
 */
export function webhookRequest(body: string, secret: string): NextRequest {
  const signature = new Stripe(
    STRIPE_TEST_ENV.STRIPE_SECRET_KEY_TEST,
  ).webhooks.generateTestHeaderString({ payload: body, secret });
  return new NextRequest("https://mp.test/api/stripe/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": signature,
    },
    body,
  });
}

/** LA FILA COMPLETA de `core.subscription`, leída por SQL. La respuesta de la API nunca es
 * el oráculo (ADR 0054). */
export async function readSubscriptionRow(businessId: string) {
  const [row] = await getDb()
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.businessId, businessId));
  return row;
}

/** La fila del evento: `processed_at`, `ignored_reason` y `received_at` son el observable de
 * «una sola entrega gana el claim» (M3 / M7). */
export async function readWebhookEvent(eventId: string) {
  const [row] = await getDb()
    .select()
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.eventId, eventId));
  return row;
}

export async function dropWebhookEvents(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;
  await getDb()
    .delete(stripeWebhookEvents)
    .where(inArray(stripeWebhookEvents.eventId, eventIds));
}

/**
 * El doble del módulo `server/stripe-config` para los tests que manejan la RUTA: conserva la
 * configuración REAL (así la validación de prefijo de `stripe-config.ts:29-31` corre de
 * verdad sobre las env stubbeadas) y sólo reemplaza el CLIENTE.
 */
export function stripeConfigDouble(
  actual: typeof import("./stripe-config"),
  getFake: () => FakeStripe,
) {
  return {
    ...actual,
    getStripeClient: (configuration = actual.getStripeConfiguration()) =>
      stripeClientDouble(getFake(), configuration.secretKey),
  };
}

/**
 * EL POST A UNA RUTA DE BILLING. Lo comparten los tres archivos de integración de la fase D
 * (las 5 rutas, el gate con sesiones reales y las carreras de `locations-races`): la URL es
 * irrelevante porque el handler se invoca directo, pero `NextRequest` sí exige una válida.
 * `headers` es parámetro para poder mandar la cookie de una sesión REAL.
 */
export function billingRequest(
  body: unknown = {},
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest("https://merchant.test/api/billing/x", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

/**
 * LOS IDS DE STRIPE DE UN TEST SON ÚNICOS POR ARCHIVO Y POR CORRIDA, y no es cosmético:
 * `core_subscription_customer_unique` y `core_subscription_stripe_unique` son uniques
 * GLOBALES, vitest paraleliza ARCHIVOS, y una corrida ABORTADA deja filas huérfanas. Con
 * literales fijos el síntoma es el peor posible — un `23505` EN EL SEED, o sea antes de
 * cualquier aserción de comportamiento, que se lee como un bug del producto y encima es no
 * determinista. Pasó de verdad dos veces en la fase D1: `cus_race` compartido con la fase B, y
 * una corrida abortada por timeout que envenenó la rama entera.
 *
 * El sufijo se calcula UNA vez por módulo: vitest aísla el grafo por archivo de test, así que
 * dos archivos nunca comparten sufijo y dos corridas tampoco.
 */
const RUN_SUFFIX = randomUUID().slice(0, 8);

export const subId = (tag: string) => `sub_${tag}_${RUN_SUFFIX}`;
export const custId = (tag: string) => `cus_${tag}_${RUN_SUFFIX}`;

/** Un `plus` mensual VIVO: deja la suscripción cargada en el fake y devuelve el estado con el
 * que sembrar la fila, para que las dos mitades no puedan desincronizarse. */
export function livePlusState(
  fake: FakeStripe,
  tag: string,
  items: { priceId: string }[] = [{ priceId: MONTHLY_PRICE }],
): SeededSubscription {
  fake.subscriptions.set(
    subId(tag),
    stripeSubscription({ id: subId(tag), items, customer: custId(tag) }),
  );
  return {
    interval: "month",
    stripeCustomerId: custId(tag),
    stripeSubscriptionId: subId(tag),
  };
}

/** Archiva un local POR SQL, sin pasar por el código bajo prueba. */
export function archiveLocation(locationId: string) {
  return getDb()
    .update(locations)
    .set({ status: "archived" })
    .where(eq(locations.id, locationId));
}
