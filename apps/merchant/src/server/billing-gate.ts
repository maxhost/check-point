import { eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { subscriptions } from "@mi-pasaporte/db/schema";
import {
  billingAccess,
  billingAccessFailure,
  type BillingAccess,
  type BillingAccessFailure,
} from "@mi-pasaporte/domain/server/billing-access";

/**
 * Spec 0189 §D4 — EL EJE DE ACCESO EN LOS GUARDS DEL MERCHANT. La decisión es pura y vive en
 * `billing-access.ts`; acá solo se LEE la fila de `core.subscription` del negocio, una vez, para
 * los cinco guards (`requireApiOwner` y su hermana sin email, `requireApiPermission` y su
 * hermana, el operador del mostrador/POS, el login del personal y el backoffice).
 *
 * Es un módulo aparte, y no una columna más en `ownerContext`/`membershipContext`, para que el
 * eje se pueda doblar en las suites de unidad que doblan `./staff` sin tocar a `./staff`.
 */

export type BusinessBilling = {
  access: BillingAccess;
  trialEndsAt: Date | null;
  failure: BillingAccessFailure | null;
};

export type BusinessSubscription = Pick<
  typeof subscriptions.$inferSelect,
  | "plan"
  | "status"
  | "stripeSubscriptionId"
  | "stripeCustomerId"
  | "trialEndsAt"
>;

/** Reuse a confirmed nullable row; operational failures must never be passed as null. */
export function billingFromSubscription(
  row: BusinessSubscription | null,
  now: Date,
): BusinessBilling {
  const access = billingAccess(row, now);
  return {
    access,
    trialEndsAt: row?.trialEndsAt ?? null,
    failure: billingAccessFailure(access, row),
  };
}

/** La fila de acceso del negocio + la decisión. Una fila AUSENTE es `blocked` (fail-closed). */
export async function readBusinessBilling(
  businessId: string,
  now = new Date(),
): Promise<BusinessBilling> {
  const [row] = await getDb()
    .select({
      plan: subscriptions.plan,
      status: subscriptions.status,
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      stripeCustomerId: subscriptions.stripeCustomerId,
      trialEndsAt: subscriptions.trialEndsAt,
    })
    .from(subscriptions)
    .where(eq(subscriptions.businessId, businessId))
    .limit(1);
  return billingFromSubscription(row ?? null, now);
}

/** El 402 `payment_required` del negocio, o `null` si tiene acceso. */
export async function businessBillingFailure(
  businessId: string,
  now = new Date(),
): Promise<BillingAccessFailure | null> {
  return (await readBusinessBilling(businessId, now)).failure;
}
