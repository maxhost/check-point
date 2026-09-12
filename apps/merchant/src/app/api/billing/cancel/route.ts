import { NextResponse } from "next/server";
import { withDbTransaction } from "../../../../server/db";
import {
  clearPendingPlan,
  scheduleDowngrade,
  settleToFree,
} from "../../../../server/billing";
import {
  BillingError,
  billingErrorResponse,
  billingStateResponse,
  decideUnderLock,
  requireBillingOwner,
  stripeContext,
} from "../_auth";

/**
 * Spec 0063, D6 — `POST /api/billing/cancel`: bajar de plan. Con los planes de hoy
 * «downgrade» y «cancelar» son LA MISMA operación (D0): `free` no tiene suscripción de
 * Stripe, así que bajar de plan es terminar la suscripción.
 *
 * `cancel` ES IDEMPOTENTE Y ES EL CAMINO DE REPARACIÓN: si ya hay baja programada, vuelve a
 * afirmarla contra Stripe con la MISMA clave y contesta 200.
 *
 * ORDEN DE OPERACIONES, que es lo contrario del reflejo natural:
 *
 *  1. transacción → `lockBusiness` → leer suscripción + contar activos → `decidePlanChange`.
 *     Si bloquea: 409 y nada más (`downgrade_blocked` lleva `archiveCount`).
 *  2. EN LA MISMA TRANSACCIÓN, escribir `pending_plan='free'` y `downgrade_requested_at`.
 *     Commit. Así el tope efectivo cae a 1 en el MISMO commit que verificó el conteo: no
 *     queda ventana para desarchivar entre la verificación y la baja (mutación M5).
 *  3. RECIÉN AHORA, FUERA DEL LOCK, `subscriptions.update(…, cancel_at_period_end: true)`.
 *     La llamada de red nunca ocurre con el lock tomado (la regla de `shared.ts:38-48`).
 *  4. Con la respuesta, `pending_plan_at` en una transacción corta.
 *
 * Si la decisión es `settle_to_free` (D10: `none`, o el `plus` SIN suscripción de A1) se
 * escribe el `SET` local y NO SE LLAMA A STRIPE ni una vez.
 */
export async function POST(request: Request) {
  return downgradeToFree(request);
}

/**
 * `cancel` Y `settle-free` SON LA MISMA OPERACIÓN, y por eso comparten cuerpo. No es una
 * economía de código: D10 dice literalmente que la salida del estado `none` «es la MISMA rama
 * de `decidePlanChange` (`intent: "downgrade"`), no una segunda regla que pueda divergir», y
 * la tabla de contratos de D6 les da EL MISMO conjunto de errores (`downgrade_blocked`,
 * `already_on_plan`, 503). Las dos URLs existen porque la UI tiene dos entradas —el botón de
 * bajar de plan desde `plus` y «Ajustarme y bajar a Free» desde `none`—; qué hacer lo decide
 * `decidePlanChange` con la fila real, nunca la URL. Con dos cuerpos, el día que cambie la
 * regla de bloqueo por locales uno de los dos se queda viejo.
 */
export async function downgradeToFree(request: Request): Promise<NextResponse> {
  const gate = await requireBillingOwner(request);
  if ("response" in gate) return gate.response;
  const businessId = gate.business.id;
  try {
    const now = new Date();
    const planned = await withDbTransaction(async (tx) => {
      const { row, decision } = await decideUnderLock(tx, businessId, {
        kind: "downgrade",
      });
      if (decision.kind === "settle_to_free") {
        await settleToFree(tx, businessId, now);
        return null;
      }
      const { downgradeRequestedAt } = await scheduleDowngrade(tx, businessId, {
        now,
      });
      return {
        // `schedule_downgrade` sólo se decide con `hasLiveSubscription`, que exige el id.
        subscriptionId: row.stripeSubscriptionId as string,
        downgradeRequestedAt,
        // `scheduleDowngrade` conserva la marca con `coalesce`: si lo que volvió NO es el
        // `now` de este request, la baja ya estaba pedida de antes. Ver `confirmAtStripe`.
        createdNow: downgradeRequestedAt.getTime() === now.getTime(),
      };
    });
    if (planned) await confirmAtStripe(businessId, planned);
    return await billingStateResponse(businessId);
  } catch (error) {
    return billingErrorResponse(
      error,
      "No pudimos actualizar tu suscripción. Vuelve a intentarlo.",
    );
  }
}

/**
 * Pasos 3 y 4. La `idempotencyKey` lleva el `downgrade_requested_at` ([R1-Derivado-2]): con
 * una clave FIJA —el patrón que `checkout` usa y esta spec denuncia— `cancel → resume →
 * cancel` dentro de 24 h haría que Stripe devolviera la respuesta CACHEADA sin aplicar nada:
 * la DB diciendo `pending_plan='free'`, el tope en 1 y la baja sin ocurrir jamás. Como
 * `resume` limpia la marca, la cancelación siguiente estrena clave; y un REINTENTO del mismo
 * pedido reusa la misma, que es justamente el camino de reparación.
 *
 * SI EL PASO 3 FALLA NO SE REVIERTE [R1-B3]: un timeout o un 502 no distinguen «Stripe no lo
 * recibió» de «lo aplicó y se perdió la respuesta», y revertir en el segundo caso deja a
 * Stripe con la baja y a la DB sin ella → tope de vuelta en 3 → `free` con 3 activos. Se
 * contesta 503 y el estado QUEDA PUESTO (capado en 1, conservador). Sólo se revierte ante un
 * error DETERMINISTA que pruebe que no se aplicó (`StripeInvalidRequestError` / 4xx
 * `invalid_request_error`), nunca ante `StripeConnectionError` ni un timeout.
 *
 * DECISIÓN DEL IMPLEMENTADOR, declarada — no la dijo el owner ni la fija la spec: el revert
 * corre SÓLO si esta petición fue la que CREÓ el estado (`createdNow`). Sobre un reintento de
 * reparación —donde la baja ya estaba pedida y confirmada en Stripe— un revert borraría una
 * baja legítima y devolvería el tope a 3 con la cancelación viva en Stripe: exactamente el
 * daño que [R1-B3] existe para impedir, alcanzado por el otro camino.
 */
async function confirmAtStripe(
  businessId: string,
  planned: {
    subscriptionId: string;
    downgradeRequestedAt: Date;
    createdNow: boolean;
  },
): Promise<void> {
  const { gateway } = stripeContext();
  let updated;
  try {
    updated = await gateway.subscriptions.update(
      planned.subscriptionId,
      { cancel_at_period_end: true },
      {
        idempotencyKey: `billing:cancel:${planned.subscriptionId}:${planned.downgradeRequestedAt.toISOString()}`,
      },
    );
  } catch (error) {
    if (planned.createdNow && isDeterministicRejection(error)) {
      await withDbTransaction((tx) => clearPendingPlan(tx, businessId));
    }
    throw new BillingError(
      503,
      "stripe_unavailable",
      "No pudimos confirmarlo con Stripe. Vuelve a intentarlo.",
    );
  }
  await withDbTransaction((tx) =>
    scheduleDowngrade(tx, businessId, {
      now: new Date(),
      // De `cancel_at` y de ningún otro lado: `items.data[0]` viene truncado y sin orden
      // contractual (D5.f). «Baja programada SIN fecha» es un estado VÁLIDO —garantizado
      // entre el 200 y este paso— y la UI lo dice (D7).
      pendingPlanAt:
        typeof updated.cancel_at === "number"
          ? new Date(updated.cancel_at * 1000)
          : null,
    }),
  );
}

/**
 * ¿Este error PRUEBA que Stripe no aplicó nada? Sólo los deterministas: un
 * `StripeInvalidRequestError` (o cualquier 4xx `invalid_request_error`) significa que Stripe
 * rechazó el pedido. Un `StripeConnectionError` o un timeout NO prueban nada.
 *
 * Se mira `type`/`statusCode` y no `instanceof`: los errores del SDK son construibles
 * (`Stripe.errors.*`, `cjs/Error.d.ts`) pero un `instanceof` contra la clase importada acá se
 * rompe si el que lo construyó cargó otra copia del módulo.
 */
function isDeterministicRejection(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    type?: unknown;
    rawType?: unknown;
    statusCode?: unknown;
  };
  if (candidate.type === "StripeConnectionError") return false;
  if (candidate.type === "StripeInvalidRequestError") return true;
  // `rawType` es el `type` que mandó la API; sobrevive a un bundler que renombre clases.
  if (candidate.rawType === "invalid_request_error") return true;
  return (
    typeof candidate.statusCode === "number" &&
    candidate.statusCode >= 400 &&
    candidate.statusCode < 500
  );
}
