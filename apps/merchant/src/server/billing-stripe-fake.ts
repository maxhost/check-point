import Stripe from "stripe";

import { subscriptionFake } from "./billing-derive-support";
import type { StripeGateway } from "./billing";

/**
 * Spec 0063 — EL DOBLE DE STRIPE de la integración de billing. Nada de producción lo importa.
 *
 * CORTE DECIDIDO POR EL ORQUESTADOR ANTES DE DESPACHAR LA FASE D (`billing-integration-support.ts`
 * estaba en 297/300 y la D tenía que EXTENDER el fake). El archivo viejo REEXPORTA lo que se
 * mudó acá: ningún test de las fases B/C —que tienen PASS— cambia de import.
 *
 * OJO AL SUMARLE ALGO: quedó en el filo del límite de 300. Lo próximo que entre necesita un
 * corte decidido antes, no un recorte de comentarios a último momento.
 */

/** `lastResponse` es metadata de transporte del SDK que nada de este dominio lee: el cast va
 * acá, en UN solo lugar nombrado, en vez de repartido por los tests. */
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
 * Una `Stripe.Subscription` como la devuelve `subscriptions.retrieve`. Parte del constructor de
 * los units (`billing-derive-support.ts`) y suma lo que el WEBHOOK necesita: `customer` y
 * `metadata` (el `businessId` de D5.c) y `created` (la más reciente en D8).
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
  /** Toda llamada, en orden. El DoD pide aseverar CERO llamadas en varios caminos (tipo fuera
   * de la allow-list, `settle_to_free`), y eso sólo se asevera si se cuentan. */
  calls: string[];
  subscriptions: Map<string, Stripe.Subscription>;
  sessions: Map<string, Stripe.Checkout.Session>;
  /** Lo que tire el próximo `retrieve` (el camino «falla → 500 sin marcar procesado»). */
  retrieveError: Error | null;
  /** Lo que devuelve `subscriptions.list` (D8). Vacío = «nunca tuvo suscripción» → no se
   * escribe NADA (M16). */
  list: Stripe.Subscription[];

  // ——— FASE D (las rutas) ———

  /** Lo que tira el próximo `subscriptions.update`: hace construibles los dos caminos de error
   * de D6 — `StripeConnectionError` (503, estado PUESTO) y `StripeInvalidRequestError` (503,
   * REVERTIDO). */
  updateError: Error | null;
  /** Params de cada `subscriptions.update`, en orden: el oráculo de `cancel_at_period_end`, del
   * `items[].price` de D9 y del `payment_behavior` de M17 es lo que se le PIDIÓ a Stripe. */
  updateParams: Stripe.SubscriptionUpdateParams[];
  /** Las `idempotencyKey` de cada `update`: el ítem del DoD `cancel → resume → cancel` se
   * asevera acá (la 2.ª cancelación estrena clave). */
  updateKeys: (string | undefined)[];
  /**
   * M17 — LA TARJETA RECHAZADA, modelada como Stripe la documenta: con
   * `payment_behavior: "error_if_incomplete"` el `update` FALLA y no aplica nada; SIN él tiene
   * ÉXITO, el price nuevo queda aplicado y la suscripción se va a `past_due` con la factura
   * abierta. Esa asimetría es la que le da oráculo a M17.
   */
  cardDeclined: boolean;
  /** Se ejecuta DENTRO de `subscriptions.update`, antes de aplicar nada: es la ventana en la
   * que M5 dispara un desarchivado concurrente para ver si el tope ya cayó. */
  beforeUpdate: (() => Promise<void>) | null;
  /** El `status`/`url` con el que nace la sesión de Checkout. `status: "complete"` es la
   * sesión cacheada por la `idempotencyKey` fija → 409 `checkout_session_stale`. */
  sessionStatus: Stripe.Checkout.Session.Status;
  sessionUrl: string | null;
  /** Params de `checkout.sessions.create` y de `customers.create`, en orden. */
  sessionParams: Stripe.Checkout.SessionCreateParams[];
  customerParams: Stripe.CustomerCreateParams[];
  /** Claves de idempotencia, UNA CANASTA POR SUPERFICIE (no dentro de `updateKeys`): una lista
   * compartida obliga a filtrar por prefijo, y el día que un prefijo se repita, el filtro miente. */
  sessionKeys: (string | undefined)[];
  customerKeys: (string | undefined)[];
  /** El id que devuelve `customers.create`. */
  nextCustomerId: string;
};

function applyUpdate(
  subscription: Stripe.Subscription,
  params: Stripe.SubscriptionUpdateParams,
): Stripe.Subscription {
  const next = { ...subscription };
  if (params.cancel_at_period_end !== undefined) {
    next.cancel_at_period_end = params.cancel_at_period_end;
  }
  if (params.cancel_at !== undefined) {
    next.cancel_at =
      typeof params.cancel_at === "number" ? params.cancel_at : null;
  }
  for (const item of params.items ?? []) {
    if (typeof item.id !== "string" || typeof item.price !== "string") continue;
    next.items = {
      ...next.items,
      data: next.items.data.map((existing) =>
        existing.id === item.id
          ? ({
              ...existing,
              price: { ...existing.price, id: item.price },
            } as Stripe.SubscriptionItem)
          : existing,
      ),
    };
  }
  return next;
}

export function fakeStripe(): FakeStripe {
  const fake: FakeStripe = {
    calls: [],
    subscriptions: new Map(),
    sessions: new Map(),
    retrieveError: null,
    list: [],
    updateError: null,
    updateParams: [],
    updateKeys: [],
    cardDeclined: false,
    beforeUpdate: null,
    sessionStatus: "open",
    sessionUrl: "https://checkout.stripe.test/session",
    sessionParams: [],
    customerParams: [],
    sessionKeys: [],
    customerKeys: [],
    nextCustomerId: "cus_creado_por_el_checkout",
    gateway: {
      subscriptions: {
        retrieve: (async (id: string) => {
          fake.calls.push(`subscriptions.retrieve:${id}`);
          if (fake.retrieveError) throw fake.retrieveError;
          const found = fake.subscriptions.get(id);
          // Lo que Stripe contesta de verdad con un id que no existe.
          if (!found) throw new Error(`No such subscription: ${id}`);
          return asResponse(found);
        }) as StripeGateway["subscriptions"]["retrieve"],
        update: (async (
          id: string,
          params: Stripe.SubscriptionUpdateParams = {},
          options?: Stripe.RequestOptions,
        ) => {
          fake.calls.push(`subscriptions.update:${id}`);
          fake.updateParams.push(params);
          fake.updateKeys.push(options?.idempotencyKey);
          if (fake.beforeUpdate) await fake.beforeUpdate();
          if (fake.updateError) throw fake.updateError;
          const found = fake.subscriptions.get(id);
          if (!found) throw new Error(`No such subscription: ${id}`);
          if (fake.cardDeclined) {
            if (params.payment_behavior === "error_if_incomplete") {
              throw new Stripe.errors.StripeCardError({
                type: "card_error",
                code: "card_declined",
                message: "Your card was declined.",
              });
            }
            // Sin el guard: el cambio SÍ se aplica y la suscripción queda `past_due`.
            const applied = applyUpdate(found, params);
            applied.status = "past_due";
            fake.subscriptions.set(id, applied);
            return asResponse(applied);
          }
          const applied = applyUpdate(found, params);
          fake.subscriptions.set(id, applied);
          return asResponse(applied);
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
          create: (async (
            params: Stripe.Checkout.SessionCreateParams,
            options?: Stripe.RequestOptions,
          ) => {
            fake.calls.push("checkout.sessions.create");
            fake.sessionParams.push(params);
            fake.sessionKeys.push(options?.idempotencyKey);
            const session = {
              ...stripeSession({
                id: `cs_${fake.sessionParams.length}`,
                businessId: params.client_reference_id ?? null,
                subscriptionId: null,
                customer:
                  typeof params.customer === "string" ? params.customer : null,
              }),
              status: fake.sessionStatus,
              url: fake.sessionUrl,
            } as Stripe.Checkout.Session;
            fake.sessions.set(session.id, session);
            return asResponse(session);
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
        create: (async (
          params: Stripe.CustomerCreateParams = {},
          options?: Stripe.RequestOptions,
        ) => {
          fake.calls.push("customers.create");
          fake.customerParams.push(params);
          fake.customerKeys.push(options?.idempotencyKey);
          return asResponse({
            id: fake.nextCustomerId,
            object: "customer" as const,
          } as Stripe.Customer);
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
 * El cast a `Stripe` está acá y sólo acá: es lo que la costura `StripeGateway` evita en
 * PRODUCCIÓN, pero la ruta toma su cliente de `stripe-config` y el doble del módulo es el
 * único camino (la spec lo fija en §Archivos compartidos). Los tres recursos SÍ están tipados
 * por `StripeGateway`, que es donde un fake mal escrito se caza.
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
