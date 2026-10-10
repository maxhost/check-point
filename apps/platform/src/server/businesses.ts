import { and, desc, eq } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  memberships,
  platformAuditLog,
  subscriptions,
  users,
} from "@mi-pasaporte/db/schema";
import {
  billingAccess,
  trialDaysLeft,
  type BillingAccess,
} from "@mi-pasaporte/domain/server/billing-access";
import { hasLiveSubscription } from "@mi-pasaporte/domain/server/entitlements/live-subscription";
import { nextTrialEnd, type TrialChange } from "./trial";

/** Spec 0190 §D4 — una fila de la lista del panel. */
export type AdminBusiness = {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: Date;
  ownerEmail: string | null;
  plan: string | null;
  hasStripe: boolean;
  trialEndsAt: Date | null;
  access: BillingAccess;
  trialDaysLeft: number | null;
};

/** Orden de la lista: bloqueados, despues en prueba (el que vence antes arriba), despues los que pagan. */
const ACCESS_ORDER: Record<BillingAccess, number> = {
  blocked: 0,
  trial: 1,
  subscribed: 2,
};

export function sortAdminBusinesses(rows: AdminBusiness[]): AdminBusiness[] {
  return [...rows].sort(
    (a, b) =>
      ACCESS_ORDER[a.access] - ACCESS_ORDER[b.access] ||
      (a.trialEndsAt?.getTime() ?? 0) - (b.trialEndsAt?.getTime() ?? 0) ||
      a.name.localeCompare(b.name, "es"),
  );
}

/**
 * Los comercios con su acceso calculado por `billingAccess`/`trialDaysLeft` (spec 0189), nunca
 * reimplementado. Sin fila de suscripcion → `blocked` (el fail-closed de `billingAccess(null)`).
 * Con `businessId`, solo ese comercio.
 */
export async function listBusinesses(
  now: Date,
  businessId?: string,
): Promise<AdminBusiness[]> {
  const rows = await getDb()
    .select({
      id: businesses.id,
      name: businesses.name,
      slug: businesses.slug,
      status: businesses.status,
      createdAt: businesses.createdAt,
      ownerEmail: users.email,
      plan: subscriptions.plan,
      subStatus: subscriptions.status,
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      trialEndsAt: subscriptions.trialEndsAt,
    })
    .from(businesses)
    .leftJoin(subscriptions, eq(subscriptions.businessId, businesses.id))
    .leftJoin(
      memberships,
      and(
        eq(memberships.businessId, businesses.id),
        eq(memberships.role, "owner"),
      ),
    )
    .leftJoin(users, eq(users.id, memberships.userId))
    .where(
      businessId === undefined ? undefined : eq(businesses.id, businessId),
    );

  const seen = new Map<string, AdminBusiness>();
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    const accessRow =
      row.subStatus === null
        ? null
        : {
            status: row.subStatus,
            stripeSubscriptionId: row.stripeSubscriptionId,
            trialEndsAt: row.trialEndsAt,
          };
    const access = billingAccess(accessRow, now);
    seen.set(row.id, {
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      createdAt: row.createdAt,
      ownerEmail: row.ownerEmail,
      plan: row.plan,
      hasStripe: row.stripeSubscriptionId !== null,
      trialEndsAt: row.trialEndsAt,
      access,
      trialDaysLeft: trialDaysLeft(access, row.trialEndsAt, now),
    });
  }
  return sortAdminBusinesses([...seen.values()]);
}

/** Los ultimos registros del panel sobre un comercio (la ficha). */
export async function auditFor(businessId: string, limit = 20) {
  return getDb()
    .select()
    .from(platformAuditLog)
    .where(eq(platformAuditLog.businessId, businessId))
    .orderBy(desc(platformAuditLog.createdAt))
    .limit(limit);
}

export type TrialChangeResult =
  | {
      kind: "ok";
      trialEndsAt: Date;
      access: BillingAccess;
      trialDaysLeft: number | null;
    }
  | { kind: "not_found" }
  | { kind: "subscription_live" }
  | { kind: "would_block" };

/**
 * Spec 0190 §D5 — mueve `trial_ends_at` de UN comercio y deja su `audit_log`, en una sola
 * transaccion con la fila de suscripcion bloqueada. Se niega con suscripcion de Stripe viva
 * (la prueba de quien ya paga se mueve en Stripe) y, sin `confirmBlock`, cuando la fecha
 * resultante bloquearia al comercio.
 */
export async function applyTrialChange(input: {
  businessId: string;
  adminEmail: string;
  change: TrialChange;
  now: Date;
}): Promise<TrialChangeResult> {
  const { businessId, adminEmail, change, now } = input;
  return withDbTransaction(async (tx) => {
    const [row] = await tx
      .select({
        status: subscriptions.status,
        stripeSubscriptionId: subscriptions.stripeSubscriptionId,
        trialEndsAt: subscriptions.trialEndsAt,
      })
      .from(subscriptions)
      .where(eq(subscriptions.businessId, businessId))
      .for("update");
    if (!row) return { kind: "not_found" };
    if (hasLiveSubscription(row)) return { kind: "subscription_live" };

    const trialEndsAt = nextTrialEnd(row.trialEndsAt, now, change);
    const confirmed =
      change.mode === "set_date" && change.confirmBlock === true;
    if (trialEndsAt.getTime() <= now.getTime() && !confirmed) {
      return { kind: "would_block" };
    }

    await tx
      .update(subscriptions)
      .set({ trialEndsAt, updatedAt: now })
      .where(eq(subscriptions.businessId, businessId));
    await tx.insert(platformAuditLog).values({
      adminEmail,
      businessId,
      action: change.mode === "add_days" ? "trial_add_days" : "trial_set_date",
      beforeTrialEndsAt: row.trialEndsAt,
      afterTrialEndsAt: trialEndsAt,
    });
    const access = billingAccess({ ...row, trialEndsAt }, now);
    return {
      kind: "ok",
      trialEndsAt,
      access,
      trialDaysLeft: trialDaysLeft(access, trialEndsAt, now),
    };
  });
}
