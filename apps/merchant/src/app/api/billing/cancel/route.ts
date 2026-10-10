import { withDbTransaction } from "@mi-pasaporte/db";
import { lockBusiness } from "../../../../server/locations/shared";
import { pendingPlanFor } from "../../../../server/billing/derive-rules";
import { scheduleCancel } from "../../../../server/billing";
import {
  BillingError,
  billingErrorResponse,
  billingStateResponse,
  decideUnderLock,
  requireBillingOwner,
  stripeContext,
} from "../_auth";

/**
 * Spec 0189 §D7 / ADR 0134 §8 — `POST /api/billing/cancel`: cancelar AL FIN DEL PERIODO
 * PAGADO. Revierte la baja inmediata del ADR 0063: su motivo («pagaba Plus y ya solo podía
 * tener 1 local») desapareció con el plan gratis — mientras paga, el negocio conserva lo que
 * pagó, y se puede reanudar (`/api/billing/resume`) antes de que termine.
 *
 * ORDEN DE OPERACIONES:
 *  1. transacción → `lockBusiness` → `decidePlanChange({kind: "cancel"})`. Sin suscripción
 *     viva → 409 `no_subscription`; ya programada → 409 `cancel_scheduled`.
 *  2. FUERA del lock: `subscriptions.update({cancel_at_period_end: true})`. Si Stripe falla,
 *     503 y NO se escribió nada local (la fila sigue diciendo la verdad: sin cancelación).
 *  3. Transacción corta: `pending_plan='none'` + `pending_plan_at` derivados de la RESPUESTA
 *     de Stripe (`pendingPlanFor`, la misma regla que el webhook) + `downgrade_requested_at`
 *     (auditoría). Es idempotente frente al `customer.subscription.updated` que llega en
 *     paralelo: los dos escriben lo mismo, de la misma suscripción.
 *
 * Sin `idempotencyKey`: el efecto (`cancel_at_period_end: true`) ya es idempotente, y una
 * clave fija haría que `cancel → resume → cancel` dentro de 24 h devolviera la respuesta
 * CACHEADA del primer `cancel` sin aplicar el tercero.
 */
export async function POST(request: Request) {
  const gate = await requireBillingOwner(request);
  if ("response" in gate) return gate.response;
  const businessId = gate.business.id;
  try {
    const { gateway } = stripeContext();
    const subscriptionId = await withDbTransaction(async (tx) => {
      const { row } = await decideUnderLock(tx, businessId, { kind: "cancel" });
      // `schedule_cancel` sólo se decide con `hasLiveSubscription`, que exige el id.
      return row.stripeSubscriptionId as string;
    });
    let updated;
    try {
      updated = await gateway.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    } catch (error) {
      console.error(
        "[billing] cancel: Stripe no confirmó la cancelación",
        { businessId },
        error,
      );
      throw new BillingError(
        503,
        "stripe_unavailable",
        "No pudimos confirmarlo con Stripe. Vuelve a intentarlo.",
      );
    }
    const now = new Date();
    const pending = pendingPlanFor(updated);
    await withDbTransaction(async (tx) => {
      await lockBusiness(tx, businessId);
      await scheduleCancel(tx, businessId, {
        now,
        pendingPlan: pending.pendingPlan,
        pendingPlanAt: pending.pendingPlanAt,
      });
    });
    return await billingStateResponse(businessId);
  } catch (error) {
    return billingErrorResponse(
      error,
      "No pudimos actualizar tu suscripción. Vuelve a intentarlo.",
    );
  }
}
