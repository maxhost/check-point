import type Stripe from "stripe";

import type { SubscriptionRow } from "./billing";

/**
 * Spec 0063, D5 — constructores para los units de derivación (`billing-derive.test.ts`,
 * `billing-applicability.test.ts`). Vive fuera del `.test.ts` sólo por el límite de 300
 * líneas del repo; no lo usa nada de producción.
 *
 * Los campos ESCALARES se arman con un objeto tipado por `Pick<Stripe.Subscription, …>`,
 * así que un nombre o un tipo equivocado no compila. El cast final es sólo para el resto
 * de la `Subscription` (decenas de campos que la derivación no lee).
 */

export const MONTHLY_PRICE = "price_plus_monthly";
export const YEARLY_PRICE = "price_plus_yearly";
export const PRICE_IDS = { monthly: MONTHLY_PRICE, yearly: YEARLY_PRICE };

/** Unix SECONDS, con año propio: sin el `* 1000` la fecha cae en 1970 y el unit lo caza. */
export const PERIOD_END_SECONDS = Date.UTC(2027, 0, 15) / 1000;
export const PERIOD_END_YEAR = 2027;
export const CANCEL_AT_SECONDS = Date.UTC(2026, 11, 1) / 1000;
export const CANCEL_AT_YEAR = 2026;

type ItemSpec = { priceId: string; currentPeriodEnd?: number };

type SubscriptionSpec = Partial<
  Pick<
    Stripe.Subscription,
    "id" | "cancel_at" | "cancel_at_period_end" | "pause_collection"
  >
> & {
  status?: string;
  /** `[]` es el caso real de `items.data` vacío (lista truncada / sin orden). */
  items?: ItemSpec[];
};

export function subscriptionFake(
  spec: SubscriptionSpec = {},
): Stripe.Subscription {
  const scalars: Pick<
    Stripe.Subscription,
    "id" | "cancel_at" | "cancel_at_period_end" | "pause_collection"
  > = {
    id: spec.id ?? "sub_1",
    cancel_at: spec.cancel_at ?? null,
    cancel_at_period_end: spec.cancel_at_period_end ?? false,
    pause_collection: spec.pause_collection ?? null,
  };
  const items = (spec.items ?? [{ priceId: MONTHLY_PRICE }]).map(
    (item, index) => ({
      id: `si_${index}`,
      current_period_end: item.currentPeriodEnd ?? PERIOD_END_SECONDS,
      price: { id: item.priceId },
    }),
  );
  return {
    ...scalars,
    status: spec.status ?? "active",
    items: { object: "list", data: items, has_more: false, url: "/v1/items" },
  } as unknown as Stripe.Subscription;
}

export function subscriptionRow(
  overrides: Partial<SubscriptionRow> = {},
): SubscriptionRow {
  return {
    businessId: "11111111-1111-1111-1111-111111111111",
    plan: "plus",
    interval: "month",
    status: "active",
    stripeCustomerId: "cus_1",
    stripeSubscriptionId: "sub_1",
    pendingPlan: null,
    pendingPlanAt: null,
    downgradeRequestedAt: null,
    lastEventAt: null,
    ...overrides,
  };
}

export const UPDATED_EVENT = {
  type: "customer.subscription.updated",
  created: Math.floor(Date.UTC(2026, 8, 10) / 1000),
};

export const DELETED_EVENT = {
  type: "customer.subscription.deleted",
  created: UPDATED_EVENT.created,
};
