import type Stripe from "stripe";

import { subscriptionFake } from "./billing-derive-support";

/**
 * Spec 0064, fase A — LOS OBJETOS DE STRIPE que usa la integración de billing, separados del
 * DOBLE (`billing-stripe-fake.ts`). Nada de producción los importa.
 *
 * CORTE DE TAMAÑO, decidido antes de tocar nada: el fake estaba en 299/300 y la fase A tiene
 * que sumarle `subscriptions.cancel` y `invoices.list` (A1). El fake reexporta lo de acá, así
 * que ningún test cambia de import — mismo criterio con el que el fake salió de
 * `billing-integration-support.ts` cuando ESE llegó a 297.
 */

/** `lastResponse` es metadata de transporte del SDK que nada de este dominio lee: el cast va
 * acá, en UN solo lugar nombrado, en vez de repartido por los tests. */
export function asResponse<T>(value: T): Stripe.Response<T> {
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

export type InvoiceSpec = {
  id?: string;
  created: number;
  amountPaid?: number;
  currency?: string;
  hostedInvoiceUrl?: string | null;
  invoicePdf?: string | null;
};

/**
 * Una `Stripe.Invoice` como la devuelve `invoices.list` (A4). Sólo los cinco campos que
 * `readBillingFacts` lee: `created` (el criterio de «la última»), `amount_paid`, `currency` y
 * los dos links del recibo. El objeto va a propósito INCOMPLETO —igual que `eventBody`— para
 * que si alguien empieza a leer otro campo, este doble no se lo tape.
 *
 * `hostedInvoiceUrl` e `invoicePdf` distinguen `undefined` de `null` a propósito: el tipo del
 * SDK los declara `?string | null` y el fallback de `readBillingFacts` tiene que cubrir los
 * dos (`?? null`, no `|| null`).
 */
export function stripeInvoice(spec: InvoiceSpec) {
  const invoice = {
    id: spec.id ?? `in_${spec.created}`,
    object: "invoice",
    created: spec.created,
    amount_paid: spec.amountPaid ?? 1500,
    currency: spec.currency ?? "usd",
    ...(spec.hostedInvoiceUrl === undefined
      ? {}
      : { hosted_invoice_url: spec.hostedInvoiceUrl }),
    ...(spec.invoicePdf === undefined ? {} : { invoice_pdf: spec.invoicePdf }),
  };
  return invoice as Stripe.Invoice;
}

/**
 * Aplica un `subscriptions.update` sobre una suscripción del doble. Vive con los objetos y no
 * con el gateway porque es una transformación de `Stripe.Subscription`, no una llamada: sólo
 * los tres campos que alguna ruta pide (`cancel_at_period_end`, `cancel_at` y el `price` de un
 * item). Lo que no está acá no lo aplica el fake, y eso es a propósito — un campo que se
 * «aplica» sin que ninguna ruta lo mande es un doble que promete más de lo que se usa.
 */
export function applyUpdate(
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
