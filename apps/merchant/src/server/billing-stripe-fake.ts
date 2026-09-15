import Stripe from "stripe";

import {
  applyUpdate,
  asResponse,
  stripeSession,
} from "./billing-stripe-objects";
import type { StripeGateway } from "./billing";

/**
 * Spec 0063 — EL DOBLE DE STRIPE de la integración de billing. Nada de producción lo importa.
 *
 * CORTE DECIDIDO POR EL ORQUESTADOR ANTES DE DESPACHAR LA FASE D (`billing-integration-support.ts`
 * estaba en 297/300 y la D tenía que EXTENDER el fake). El archivo viejo REEXPORTA lo que se
 * mudó acá: ningún test de las fases B/C —que tienen PASS— cambia de import.
 *
 * SEGUNDO CORTE (spec 0064, fase A): los CONSTRUCTORES de objetos se mudaron a
 * `billing-stripe-objects.ts` porque este archivo quedó en 299/300 y A1 le suma
 * `subscriptions.cancel` + `invoices.list`. Se reexportan por el mismo motivo de siempre —
 * ningún test cambia de import.
 */
export {
  applyUpdate,
  asResponse,
  stripeInvoice,
  stripeSession,
  stripeSubscription,
} from "./billing-stripe-objects";
export type { InvoiceSpec, SubscriptionSpec } from "./billing-stripe-objects";

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
  /** Las `idempotencyKey` de cada `update`. */
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

  // ——— SPEC 0064, FASE A (la baja inmediata y los datos del cobro) ———

  /** Lo que tira el próximo `subscriptions.cancel`: los dos caminos de error del paso 3 de A2
   * (red → estado PUESTO; determinista + `createdNow` → REVERTIDO). */
  cancelError: Error | null;
  /** Params de cada `subscriptions.cancel`. El DoD pide aseverar que NO se manda `prorate` ni
   * `invoice_now`: sin guardarlos no hay con qué. */
  cancelParams: (Stripe.SubscriptionCancelParams | undefined)[];
  cancelKeys: (string | undefined)[];
  /** Se ejecuta DENTRO de `subscriptions.cancel`, antes de aplicar nada: la ventana en la que
   * A-T4 mete el `deleted` del webhook ANTES del paso 4. */
  beforeCancel: (() => Promise<void>) | null;
  /** Lo que devuelve `invoices.list` (A4). Vacío = «no hay factura pagada» → `null`, y la UI
   * omite el dato. */
  invoices: Stripe.Invoice[];
  /** Lo que tira el próximo `invoices.list`: A4 exige que `readBillingFacts` NO TIRE NUNCA. */
  invoicesError: Error | null;
  /** Params de cada `invoices.list`: el oráculo de que se pide `status: "paid"` del customer
   * correcto. */
  invoiceParams: (Stripe.InvoiceListParams | undefined)[];
};

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
    cancelError: null,
    cancelParams: [],
    cancelKeys: [],
    beforeCancel: null,
    invoices: [],
    invoicesError: null,
    invoiceParams: [],
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
        /**
         * La baja INMEDIATA (ADR 0063). Modelada como la documenta Stripe: la suscripción pasa
         * a `canceled` EN EL ACTO —no queda «programada»— y `cancel_at_period_end` NO se toca.
         * Que quede `canceled` es lo que hace que el `deleted` tardío de A-T4 sea un caso real
         * y no una maqueta.
         */
        cancel: (async (
          id: string,
          params?: Stripe.SubscriptionCancelParams,
          options?: Stripe.RequestOptions,
        ) => {
          fake.calls.push(`subscriptions.cancel:${id}`);
          fake.cancelParams.push(params);
          fake.cancelKeys.push(options?.idempotencyKey);
          if (fake.beforeCancel) await fake.beforeCancel();
          if (fake.cancelError) throw fake.cancelError;
          const found = fake.subscriptions.get(id);
          if (!found) throw new Error(`No such subscription: ${id}`);
          const canceled = {
            ...found,
            status: "canceled",
            canceled_at: Math.floor(Date.now() / 1000),
          } as Stripe.Subscription;
          fake.subscriptions.set(id, canceled);
          return asResponse(canceled);
        }) as StripeGateway["subscriptions"]["cancel"],
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
      invoices: {
        list: (async (params?: Stripe.InvoiceListParams) => {
          fake.calls.push("invoices.list");
          fake.invoiceParams.push(params);
          if (fake.invoicesError) throw fake.invoicesError;
          return asResponse({
            object: "list" as const,
            data: fake.invoices,
            has_more: false,
            url: "/v1/invoices",
          });
        }) as StripeGateway["invoices"]["list"],
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
 * único camino (la spec lo fija en §Archivos compartidos). Los recursos SÍ están tipados
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
    invoices: fake.gateway.invoices,
    checkout: fake.gateway.checkout,
    customers: fake.gateway.customers,
  } as unknown as Stripe;
}
