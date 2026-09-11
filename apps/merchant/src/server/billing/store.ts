import type Stripe from "stripe";
import { eq, sql } from "drizzle-orm";

import { withDbTransaction, type DbTransaction } from "../db";
import { lockBusiness } from "../locations/shared";
import { subscriptions } from "../schema";
import { assessEventApplicability } from "./applicability";
import { planFromSubscription, type SubscriptionRow } from "./derive";
import { DEAD_STRIPE_STATUS } from "./plan-change";
import type { StripeGateway } from "./gateway";

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
 * D6, pasos 2 y 4 de `cancel`. Escribe la INTENCIÓN: «el tope tiene que caer»
 * (`pending_plan`) y «esta baja la pedimos NOSOTROS» (`downgrade_requested_at`).
 *
 * `downgrade_requested_at` se escribe con `coalesce(columna, $now)` — CONSERVA el valor que
 * ya estuviera puesto. No es un detalle: la `idempotencyKey` de D6 es
 * `billing:cancel:${subscriptionId}:${downgradeRequestedAt.toISOString()}`, así que un
 * segundo `cancel` sobre una baja ya programada tiene que reusar la MISMA marca para que
 * Stripe reconozca el reintento (el camino de reparación). Si la sobreescribiéramos con
 * `now()`, cada reintento generaría una clave nueva. Y al revés: `resume` la limpia, así que
 * el `cancel` siguiente sí estrena clave y SÍ llega a Stripe — el ítem del DoD
 * `cancel → resume → cancel`.
 *
 * `pendingPlanAt` se pasa sólo en el paso 4, con la respuesta de Stripe (`cancel_at`) ya en
 * mano; en el paso 2 se omite, y el estado «baja programada SIN fecha» es válido y la UI lo
 * dice (D7).
 */
export async function scheduleDowngrade(
  tx: DbTransaction,
  businessId: string,
  args: { now: Date; pendingPlanAt?: Date | null },
): Promise<{ downgradeRequestedAt: Date }> {
  const [row] = await tx
    .update(subscriptions)
    .set({
      pendingPlan: "free",
      downgradeRequestedAt: sql`coalesce(${subscriptions.downgradeRequestedAt}, ${args.now})`,
      ...(args.pendingPlanAt === undefined
        ? {}
        : { pendingPlanAt: args.pendingPlanAt }),
      updatedAt: args.now,
    })
    .where(eq(subscriptions.businessId, businessId))
    .returning({ downgradeRequestedAt: subscriptions.downgradeRequestedAt });
  // `coalesce` sobre una columna nullable devuelve el tipo nullable: acá no puede ser null
  // porque uno de los dos operandos es `args.now`, pero el tipo no lo sabe.
  return { downgradeRequestedAt: row?.downgradeRequestedAt ?? args.now };
}

/**
 * D6, `resume`: deshace la baja programada. Limpia las tres columnas juntas —
 * `pending_plan` («el tope tiene que caer»), su fecha, y `downgrade_requested_at` («la
 * pedimos nosotros»)— porque dejar la tercera puesta haría que un `deleted` posterior
 * ajeno se clasificara «esperado» y aterrizara en `free` en vez de `none`.
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
 * D10 — la salida del estado «sin suscripción», y la ÚNICA operación de plan que no toca
 * Stripe. El `SET` es el literal de la spec y cada campo es load-bearing:
 *
 * `status='active'` sin limpiar `stripe_subscription_id` (la elección natural, porque en
 * prod los 11 negocios están `active`) deja `hasLiveSubscription = true` → `subscription_live`
 * 409 PARA SIEMPRE: el negocio no puede volver a Plus nunca. Y el guard de pertenencia de
 * D5.h ignoraría el `customer.subscription.created` de la suscripción nueva, así que el
 * owner pagaría y se quedaría en `free`.
 *
 * `stripe_customer_id` SE CONSERVA: es la llave con la que D8 (`reconcileFromStripe`)
 * vuelve a preguntarle a Stripe. Borrarlo deja al negocio sin forma de detectar deriva.
 */
export async function settleToFree(
  tx: DbTransaction,
  businessId: string,
  now = new Date(),
): Promise<void> {
  await tx
    .update(subscriptions)
    .set({
      plan: "free",
      status: "active",
      stripeSubscriptionId: null,
      interval: null,
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
  await tx
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
    .where(eq(subscriptions.businessId, args.businessId));
}

export type ReconcileOutcome =
  | { reconciled: true }
  | {
      reconciled: false;
      /** Cada motivo dice UNA cosa distinta, y la fase C los traduce a lo que ve el owner:
       * `no_customer` = la fila no tiene `stripe_customer_id`, así que no hay por dónde
       * preguntar; `no_subscription_row` = el negocio no tiene fila de suscripción (no debería
       * pasar, el unique de D3 y la FK lo hacen improbable, pero prestarle el motivo del
       * customer mandaría a diagnosticar otra cosa); `no_subscriptions` = Stripe contestó una
       * lista VACÍA, que NO alcanza para degradar un plan; `ignored` = el guard de pertenencia
       * o de adopción lo frenó. */
      reason:
        | "no_customer"
        | "no_subscription_row"
        | "no_subscriptions"
        | "ignored";
    };

/**
 * D8 — RECONCILIACIÓN CON STRIPE. `subscription_live` (D4) es la pieza que evita facturar
 * dos veces y se calcula sobre NUESTRA base, cuyo único escritor es el webhook: si el
 * webhook se perdió un evento, la fila queda divergente y `checkout` crea una SEGUNDA
 * suscripción viva → doble cobro. Esto lo detecta al abrir la página.
 *
 * `status: "all"` es normativo: `list` sin `status` «no devuelve las canceladas»
 * (`Subscriptions.d.ts:2661`), o sea que era ciego a la mitad de la deriva. Se elige la
 * NO MUERTA más reciente; si no hay ninguna no muerta, la más reciente.
 *
 * CON LA LISTA VACÍA NO SE ESCRIBE NADA (mutación M16): vacío con `status:"all"` significa
 * «este customer nunca tuvo suscripción», que no alcanza para degradar un plan desde el
 * render de una página.
 *
 * DOS COSAS QUE LA SPEC NO FIJA Y ACÁ SE DECIDEN, declaradas en el handoff como hallazgos:
 *
 *  1. La reconciliación aplica el guard de PERTENENCIA/ADOPCIÓN (el mismo
 *     `assessEventApplicability`, que es lo que pide «el mismo guard»), pero el guard de
 *     ORDEN queda neutralizado por construcción: se le pasa `created = ahora`, así que
 *     nunca puede ser «stale». No hay ningún evento cuyo orden respetar — lo que se lee es
 *     el estado ACTUAL de Stripe.
 *  2. Y por eso tampoco MUEVE `last_event_at`: si lo moviera a `now`, un evento legítimo
 *     que llegara después con un `created` anterior quedaría clasificado `stale_event` y se
 *     perdería. Es [R2-M3] aplicado a este camino.
 */
export async function reconcileFromStripe(
  gw: StripeGateway,
  args: {
    businessId: string;
    stripeCustomerId: string | null;
    priceIds: { monthly: string; yearly: string };
  },
): Promise<ReconcileOutcome> {
  if (args.stripeCustomerId === null) {
    return { reconciled: false, reason: "no_customer" };
  }
  const list = await gw.subscriptions.list({
    customer: args.stripeCustomerId,
    status: "all",
    limit: 10,
  });
  const chosen = pickReconcilable(list.data);
  if (!chosen) return { reconciled: false, reason: "no_subscriptions" };

  return withDbTransaction(async (tx) => {
    await lockBusiness(tx, args.businessId);
    const row = await readSubscription(tx, args.businessId);
    if (!row) return { reconciled: false, reason: "no_subscription_row" };
    const applicability = assessEventApplicability({
      event: { created: Math.floor(Date.now() / 1000) },
      subscription: chosen,
      row,
      priceIds: args.priceIds,
    });
    if (!applicability.apply) return { reconciled: false, reason: "ignored" };
    const write = planFromSubscription({
      // No hay evento: `type` no puede ser `customer.subscription.deleted` porque no hay
      // ningún hecho de terminación que reportar — lo terminal, si lo hay, lo dice el
      // `status` de la suscripción recuperada.
      event: { type: "reconcile", created: Math.floor(Date.now() / 1000) },
      subscription: chosen,
      row,
      priceIds: args.priceIds,
    });
    await applySubscriptionState(tx, {
      businessId: args.businessId,
      subscription: chosen,
      write,
      lastEventAt: null,
    });
    return { reconciled: true };
  });
}

/** La no muerta más reciente; si no hay ninguna no muerta, la más reciente. */
function pickReconcilable(
  data: Stripe.Subscription[],
): Stripe.Subscription | null {
  const byNewest = [...data].sort((a, b) => b.created - a.created);
  const live = byNewest.find(
    (item) => !DEAD_STRIPE_STATUS.has(item.status as string),
  );
  return live ?? byNewest[0] ?? null;
}
