import { eq, inArray } from "drizzle-orm";
import { NextRequest } from "next/server";
import Stripe from "stripe";

import { subscriptionFake } from "./billing-derive-support";
import type { StripeGateway } from "./billing";
import { getDb } from "./db";
import { stripeWebhookEvents, subscriptions } from "./schema";

/**
 * Spec 0063, [R2-I7] — el mundo compartido de la integración de billing: el doble de Stripe,
 * el constructor de payloads FIRMADOS y los lectores por SQL.
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

/** `lastResponse` es metadata de transporte del SDK que nada de este dominio lee. El cast
 * está acá, en UN solo lugar nombrado, en vez de repartido por los tests. */
function asResponse<T>(value: T): Stripe.Response<T> {
  return value as Stripe.Response<T>;
}

export type SubscriptionSpec = {
  id?: string;
  status?: string;
  items?: { priceId: string }[];
  customer?: string;
  created?: number;
  businessId?: string;
  cancelAt?: number | null;
  cancelAtPeriodEnd?: boolean;
};

/**
 * Una `Stripe.Subscription` como la devuelve `subscriptions.retrieve`. Parte del constructor
 * de los units (`billing-derive-support.ts`) y le agrega los campos que el WEBHOOK necesita
 * y los units no: `customer` y `metadata` (resolución del `businessId`, D5.c) y `created`
 * (elección de la más reciente en `reconcileFromStripe`, D8).
 */
export function stripeSubscription(spec: SubscriptionSpec = {}) {
  const extra: Pick<Stripe.Subscription, "customer" | "created" | "metadata"> =
    {
      customer: spec.customer ?? "cus_integration",
      created: spec.created ?? Math.floor(Date.UTC(2026, 8, 1) / 1000),
      metadata:
        spec.businessId === undefined ? {} : { businessId: spec.businessId },
    };
  return Object.assign(
    subscriptionFake({
      id: spec.id ?? "sub_integration",
      status: spec.status,
      items: spec.items,
      cancel_at: spec.cancelAt ?? null,
      cancel_at_period_end: spec.cancelAtPeriodEnd ?? false,
    }),
    extra,
  );
}

/** Una `Checkout.Session` como la devuelve `checkout.sessions.retrieve`. El `businessId` sale
 * de `client_reference_id`, que SÓLO lo escribe nuestro checkout (m1-b). */
export function stripeSession(spec: {
  id?: string;
  businessId: string | null;
  subscriptionId: string | null;
  customer?: string | null;
}) {
  const session: Pick<
    Stripe.Checkout.Session,
    "id" | "object" | "client_reference_id" | "customer" | "subscription"
  > = {
    id: spec.id ?? "cs_integration",
    object: "checkout.session",
    client_reference_id: spec.businessId,
    customer: spec.customer ?? "cus_integration",
    subscription: spec.subscriptionId,
  };
  return session as Stripe.Checkout.Session;
}

export type FakeStripe = {
  gateway: StripeGateway;
  /** Toda llamada, en orden: `subscriptions.retrieve`, `checkout.sessions.retrieve`, … El
   * DoD pide aseverar CERO llamadas en varios caminos (tipo fuera de la allow-list,
   * `settle_to_free`), y eso sólo se puede aseverar si se cuentan. */
  calls: string[];
  subscriptions: Map<string, Stripe.Subscription>;
  sessions: Map<string, Stripe.Checkout.Session>;
  /** Lo que tire el próximo `retrieve`, para el camino «el `retrieve` falla → 500 sin marcar
   * procesado, fila con `processed_at IS NULL`». */
  retrieveError: Error | null;
  /** Lo que devuelve `subscriptions.list` (D8). Vacío = «este customer nunca tuvo
   * suscripción» → no se escribe NADA (mutación M16). */
  list: Stripe.Subscription[];
};

export function fakeStripe(): FakeStripe {
  const fake: FakeStripe = {
    calls: [],
    subscriptions: new Map(),
    sessions: new Map(),
    retrieveError: null,
    list: [],
    gateway: {
      subscriptions: {
        retrieve: (async (id: string) => {
          fake.calls.push(`subscriptions.retrieve:${id}`);
          if (fake.retrieveError) throw fake.retrieveError;
          const found = fake.subscriptions.get(id);
          if (!found) {
            // Lo que Stripe contesta de verdad con un id que no existe.
            throw new Error(`No such subscription: ${id}`);
          }
          return asResponse(found);
        }) as StripeGateway["subscriptions"]["retrieve"],
        update: (async (id: string) => {
          fake.calls.push(`subscriptions.update:${id}`);
          const found = fake.subscriptions.get(id);
          if (!found) throw new Error(`No such subscription: ${id}`);
          return asResponse(found);
        }) as StripeGateway["subscriptions"]["update"],
        list: (async () => {
          fake.calls.push("subscriptions.list");
          return asResponse({
            object: "list" as const,
            data: fake.list,
            has_more: false,
            url: "/v1/subscriptions",
          });
        }) as StripeGateway["subscriptions"]["list"],
      },
      checkout: {
        sessions: {
          create: (async () => {
            fake.calls.push("checkout.sessions.create");
            throw new Error("La fase B no crea sesiones de Checkout.");
          }) as StripeGateway["checkout"]["sessions"]["create"],
          retrieve: (async (id: string) => {
            fake.calls.push(`checkout.sessions.retrieve:${id}`);
            if (fake.retrieveError) throw fake.retrieveError;
            const found = fake.sessions.get(id);
            if (!found) throw new Error(`No such checkout session: ${id}`);
            return asResponse(found);
          }) as StripeGateway["checkout"]["sessions"]["retrieve"],
        },
      },
      customers: {
        create: (async () => {
          fake.calls.push("customers.create");
          throw new Error("La fase B no crea customers.");
        }) as StripeGateway["customers"]["create"],
      },
    },
  };
  return fake;
}

/**
 * El cliente que el módulo `stripe-config` mockeado le devuelve al webhook: `webhooks` es EL
 * REAL (la firma se verifica de verdad, con `node:crypto`) y los recursos son el fake.
 *
 * El cast a `Stripe` está acá y sólo acá. Es exactamente lo que la costura `StripeGateway`
 * evita en PRODUCCIÓN —donde un `as unknown as Stripe` apagaría el typecheck que la costura
 * compró— pero la ruta toma su cliente de `stripe-config`, así que el doble del módulo es el
 * único camino, y la spec lo fija así en §Archivos compartidos. Los tres recursos SÍ están
 * tipados por `StripeGateway`, que es donde un fake mal escrito se caza.
 */
export function stripeClientDouble(
  fake: FakeStripe,
  secretKey: string,
): Stripe {
  const real = new Stripe(secretKey);
  return {
    webhooks: real.webhooks,
    subscriptions: fake.gateway.subscriptions,
    checkout: fake.gateway.checkout,
    customers: fake.gateway.customers,
  } as unknown as Stripe;
}

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
