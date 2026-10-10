import { withDbTransaction } from "@mi-pasaporte/db";
import { lockBusiness } from "../../../../server/locations/shared";
import { clearPendingPlan } from "../../../../server/billing";
import {
  BillingError,
  billingErrorResponse,
  billingStateResponse,
  decideUnderLock,
  requireBillingOwner,
  stripeContext,
} from "../_auth";

/**
 * Spec 0189 §D7 / ADR 0134 §8 — `POST /api/billing/resume`: deshacer una cancelación
 * programada antes de que termine el periodo.
 *
 * ORDEN DE OPERACIONES (el espejo de `cancel`):
 *  1. `lockBusiness` → `decidePlanChange({kind: "resume"})`. Sin suscripción viva o sin
 *     cancelación programada → 409 `nothing_to_resume`.
 *  2. FUERA del lock: `subscriptions.update({cancel_at_period_end: false})`. Si Stripe falla,
 *     503 y la fila sigue con la cancelación (que es lo que Stripe todavía tiene).
 *  3. Transacción corta: limpia `pending_plan`, `pending_plan_at` y `downgrade_requested_at`.
 *     Idempotente frente al webhook paralelo, que deriva `pending_plan=null` de la misma
 *     suscripción.
 *
 * Sin `idempotencyKey`, por el mismo motivo que `cancel`.
 */
export async function POST(request: Request) {
  const gate = await requireBillingOwner(request);
  if ("response" in gate) return gate.response;
  const businessId = gate.business.id;
  try {
    const { gateway } = stripeContext();
    const subscriptionId = await withDbTransaction(async (tx) => {
      const { row } = await decideUnderLock(tx, businessId, { kind: "resume" });
      return row.stripeSubscriptionId as string;
    });
    try {
      await gateway.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });
    } catch (error) {
      console.error(
        "[billing] resume: Stripe no confirmó la reanudación",
        { businessId },
        error,
      );
      throw new BillingError(
        503,
        "stripe_unavailable",
        "No pudimos confirmarlo con Stripe. Vuelve a intentarlo.",
      );
    }
    await withDbTransaction(async (tx) => {
      await lockBusiness(tx, businessId);
      await clearPendingPlan(tx, businessId);
    });
    return await billingStateResponse(businessId);
  } catch (error) {
    return billingErrorResponse(
      error,
      "No pudimos actualizar tu suscripción. Vuelve a intentarlo.",
    );
  }
}
