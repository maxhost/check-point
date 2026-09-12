import { withDbTransaction } from "../../../../server/db";
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
 * Spec 0063, D6 — `POST /api/billing/resume`: deshacer una baja programada.
 *
 * LA RUTA EXISTE POR DECISIÓN DEL ORQUESTADOR (§Decisiones del orquestador, n.º 1), no del
 * owner: sin ella quien cancela y se arrepiente queda ATRAPADO, porque `subscription_live` le
 * impide abrir un Checkout nuevo y no tiene forma de deshacer hasta que termine el periodo.
 *
 * ES EL ESPEJO DE `cancel` CON EL ORDEN INVERTIDO —primero Stripe, después limpiar la fila—
 * y el motivo es cuál de los dos estados es el conservador: acá lo es «seguir capado en 1».
 * Si la llamada a Stripe falla, la fila queda con la baja programada y el tope en 1; el owner
 * reintenta. Al revés (limpiar primero) un fallo de red dejaría el tope de vuelta en 3 con la
 * cancelación viva en Stripe → `free` con 3 locales activos al cerrar el periodo, que es el
 * estado que la spec entera existe para prohibir.
 *
 * Por eso acá no hay ninguna política de revert que escribir: NO HAY NADA ESCRITO QUE
 * REVERTIR cuando Stripe falla. Es la misma política que la de `cancel` ([R1-B6] pedía que
 * estuviera dicha), alcanzada por el orden en vez de por una rama.
 *
 * LO QUE ESTE ORDEN DEJA ABIERTO, declarado en vez de presentado como seguro (lo señaló el
 * revisor independiente de la fase D1): entre el 200 de Stripe y el `clearPendingPlan` hay una
 * ventana. Si el proceso muere ahí, la fila queda con `downgrade_requested_at` PUESTO y Stripe
 * SIN cancelación — y el webhook no lo limpia en un `updated`, porque `clearDowngradeRequest`
 * sólo es `true` en la rama terminal de D5.f (`derive.ts:222`). Con esa marca colgada, una baja
 * AJENA posterior (el botón del dashboard) se clasificaría «esperada» y aterrizaría en `free`
 * en vez de `none` — justo el discriminante del ADR 0060. Se ACEPTA por tres motivos: la
 * ventana es de milisegundos y sin red en el medio; un reintento del propio `resume` la repara
 * (es idempotente); y el estado intermedio es el CONSERVADOR (tope en 1). Cerrarla exigiría un
 * outbox o una escritura previa de intención, que es otra spec. **Si esta ventana se toca,
 * el renglón a re-mirar es `clearDowngradeRequest` en `derive.ts`.**
 *
 * La `idempotencyKey` lleva el `pending_plan_at`: dos `resume` del mismo pedido reusan la
 * clave, y un `cancel → resume → cancel → resume` estrena una nueva porque la fecha cambió.
 */
export async function POST(request: Request) {
  const gate = await requireBillingOwner(request);
  if ("response" in gate) return gate.response;
  const businessId = gate.business.id;
  try {
    const { gateway } = stripeContext();
    const target = await withDbTransaction(async (tx) => {
      const { row } = await decideUnderLock(tx, businessId, { kind: "resume" });
      return {
        // `resume` sólo se decide con `hasLiveSubscription`, que exige el id.
        subscriptionId: row.stripeSubscriptionId as string,
        pendingPlanAt: row.pendingPlanAt,
      };
    });
    try {
      await gateway.subscriptions.update(
        target.subscriptionId,
        {
          cancel_at_period_end: false,
          // `cancel_at` es INDEPENDIENTE de `cancel_at_period_end` (`Subscriptions.d.ts:129`)
          // y se puede setear desde el dashboard; limpiarlo es lo que hace que «reanudar»
          // reanude de verdad. `Emptyable<…>` admite `null` (`shared.d.ts:152`).
          cancel_at: null,
        },
        {
          idempotencyKey: `billing:resume:${target.subscriptionId}:${
            target.pendingPlanAt === null
              ? "none"
              : target.pendingPlanAt.toISOString()
          }`,
        },
      );
    } catch {
      throw new BillingError(
        503,
        "stripe_unavailable",
        "No pudimos confirmarlo con Stripe. Vuelve a intentarlo.",
      );
    }
    // Las TRES columnas juntas: dejar `downgrade_requested_at` puesto haría que un `deleted`
    // posterior AJENO se clasificara «esperado» y aterrizara en `free` en vez de `none`.
    await withDbTransaction((tx) => clearPendingPlan(tx, businessId));
    return await billingStateResponse(businessId);
  } catch (error) {
    return billingErrorResponse(
      error,
      "No pudimos reanudar tu suscripción. Vuelve a intentarlo.",
    );
  }
}
