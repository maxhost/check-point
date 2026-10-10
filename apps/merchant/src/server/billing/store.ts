import type Stripe from "stripe";
import { eq, sql } from "drizzle-orm";

import type { DbTransaction } from "@mi-pasaporte/db";
import { subscriptions } from "@mi-pasaporte/db/schema";
import { syncCampaignsWithAccess } from "../marketing/plan-brake";
import type { planFromSubscription, SubscriptionRow } from "./derive";

/**
 * Spec 0063 — la persistencia de `core.subscription`. Toda escritura del dominio de billing
 * pasa por acá, así que el `SET` de cada operación vive en UN solo lugar y no puede
 * divergir entre la ruta y el webhook.
 *
 * Allow-list de columnas: ningún lector hace `select()` pelado. Es lo que hace que el
 * esquema nuevo sea compatible con el código viejo (§Handoff de la spec, orden de
 * despliegue) y lo que evita que una columna interna viaje sin que nadie la nombre.
 */
const rowColumns = {
  businessId: subscriptions.businessId,
  plan: subscriptions.plan,
  interval: subscriptions.interval,
  status: subscriptions.status,
  stripeCustomerId: subscriptions.stripeCustomerId,
  stripeSubscriptionId: subscriptions.stripeSubscriptionId,
  pendingPlan: subscriptions.pendingPlan,
  pendingPlanAt: subscriptions.pendingPlanAt,
  downgradeRequestedAt: subscriptions.downgradeRequestedAt,
  trialEndsAt: subscriptions.trialEndsAt,
  lastEventAt: subscriptions.lastEventAt,
};

/**
 * La fila del negocio, o `null` si no tiene ninguna.
 *
 * Pide una transacción y no `getDb()` a propósito: todos sus llamadores deciden algo con lo
 * que leen (el tope, el plan destino, qué escribir), y esa decisión tiene que tomarse bajo
 * el `lockBusiness` de la misma transacción. Un read-modify-write con la lectura afuera del
 * lock es el pre-chequeo no correlacionado del ADR 0054.
 */
export async function readSubscription(
  tx: DbTransaction,
  businessId: string,
): Promise<SubscriptionRow | null> {
  const [row] = await tx
    .select(rowColumns)
    .from(subscriptions)
    .where(eq(subscriptions.businessId, businessId))
    .limit(1);
  return row ?? null;
}

/**
 * Spec 0189 §D7, `cancel`: la cancelación PROGRAMADA al fin del periodo (ADR 0134 §8). Escribe
 * `pending_plan='none'` con su fecha (la de Stripe, `pendingPlanFor` sobre la respuesta del
 * `update`) y `downgrade_requested_at` (auditoría: «la pidió el owner desde nuestra ruta»).
 *
 * Idempotente frente al webhook que llega en paralelo: el `customer.subscription.updated` de
 * la misma operación deriva el MISMO `pending_plan`/`pending_plan_at` de la misma suscripción,
 * así que el orden entre las dos escrituras no cambia el resultado. `downgrade_requested_at`
 * conserva la primera marca (`coalesce`).
 */
export async function scheduleCancel(
  tx: DbTransaction,
  businessId: string,
  args: { now: Date; pendingPlan: string | null; pendingPlanAt: Date | null },
): Promise<void> {
  await tx
    .update(subscriptions)
    .set({
      pendingPlan: args.pendingPlan,
      pendingPlanAt: args.pendingPlanAt,
      downgradeRequestedAt: sql`coalesce(${subscriptions.downgradeRequestedAt}, ${args.now})`,
      updatedAt: args.now,
    })
    .where(eq(subscriptions.businessId, businessId));
}

/**
 * Spec 0189 §D7, `resume`: deshace la cancelación programada. Limpia las tres columnas juntas
 * — `pending_plan`, su fecha y `downgrade_requested_at`.
 */
export async function clearPendingPlan(
  tx: DbTransaction,
  businessId: string,
  now = new Date(),
): Promise<void> {
  await tx
    .update(subscriptions)
    .set({
      pendingPlan: null,
      pendingPlanAt: null,
      downgradeRequestedAt: null,
      updatedAt: now,
    })
    .where(eq(subscriptions.businessId, businessId));
}

/**
 * La escritura derivada de un estado de Stripe, compartida por el webhook (D5.d-f) y por la
 * reconciliación (D8). Una segunda copia de este `SET` es cómo las dos superficies
 * divergen: la reconciliación existe justamente para arreglar lo que el webhook se perdió,
 * así que tiene que escribir lo mismo.
 *
 * `plan` ausente = «no tocar el plan» (el caso más frecuente: `past_due`, `incomplete`,
 * `unpaid`, `paused`, price o status desconocido). `clearDowngradeRequest` es lo único que
 * permite al webhook TOCAR `downgrade_requested_at`, y sólo para limpiarlo en la rama
 * incondicional de D5.f: nunca lo pone.
 *
 * `lastEventAt` va como parámetro y no sale del `write` porque la reconciliación NO mueve el
 * guard de orden (ver `reconcileFromStripe`).
 *
 * LAS CAMPAÑAS SIGUEN AL ACCESO EN EL ACTO (spec 0189 §D4). En la MISMA transacción que
 * escribe la fila, `syncCampaignsWithAccess` mira el acceso que quedó: sin acceso pausa todo
 * con `billing_blocked`; con acceso reanuda lo que el bloqueo pausó. Así pagar devuelve las
 * campañas sin esperar al barrido diario. Vale para el webhook y para la reconciliación
 * (`reconcileFromStripe`), que escriben por acá: los dos corren con `lockBusiness` tomado, así
 * que si el `update campaign` falla, el plan tampoco queda escrito.
 */
export async function applySubscriptionState(
  tx: DbTransaction,
  args: {
    businessId: string;
    subscription: Pick<Stripe.Subscription, "id" | "customer">;
    write: ReturnType<typeof planFromSubscription>;
    lastEventAt: Date | null;
    now?: Date;
  },
): Promise<void> {
  const now = args.now ?? new Date();
  const { write } = args;
  const [written] = await tx
    .update(subscriptions)
    .set({
      ...(write.plan === undefined ? {} : { plan: write.plan }),
      ...(write.interval === undefined ? {} : { interval: write.interval }),
      status: write.status,
      pendingPlan: write.pendingPlan,
      pendingPlanAt: write.pendingPlanAt,
      ...(write.clearDowngradeRequest ? { downgradeRequestedAt: null } : {}),
      stripeCustomerId:
        typeof args.subscription.customer === "string"
          ? args.subscription.customer
          : args.subscription.customer.id,
      stripeSubscriptionId: args.subscription.id,
      ...(args.lastEventAt === null ? {} : { lastEventAt: args.lastEventAt }),
      updatedAt: now,
    })
    .where(eq(subscriptions.businessId, args.businessId))
    .returning({
      plan: subscriptions.plan,
      status: subscriptions.status,
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      trialEndsAt: subscriptions.trialEndsAt,
    });
  await syncCampaignsWithAccess(tx, args.businessId, written ?? null, now);
}
