import { NextResponse } from "next/server";
import { withDbTransaction } from "../../../server/db";
import {
  clearPendingPlan,
  scheduleDowngrade,
  settleToFree,
} from "../../../server/billing";
import {
  BillingError,
  billingErrorResponse,
  billingStateResponse,
  decideUnderLock,
  requireBillingOwner,
  stripeContext,
} from "./_auth";

/**
 * EL CUERPO COMPARTIDO DE `cancel` Y `settle-free`. Vive en un modulo `_`, no en
 * `cancel/route.ts`, porque **un Route Handler de Next solo puede exportar handlers**: con
 * `downgradeToFree` exportado desde la ruta, `.next/types` genera un chequeo que falla
 * (`TS2344: Property 'downgradeToFree' is incompatible with index signature`) y deja el
 * typecheck en rojo apenas alguien corre un `next build` local. La CI no lo veia porque
 * corre `typecheck` ANTES que `build`, sobre un checkout donde `.next/types` no existe
 * todavia (`.github/workflows/ci.yml:32` vs `:65`).
 *
 * Mismo criterio que `_auth.ts`, que ya vive en este directorio por la misma razon.
 */
/**
 * `cancel` Y `settle-free` SON LA MISMA OPERACIÓN, y por eso comparten cuerpo. No es una
 * economía de código: D10 dice literalmente que la salida del estado `none` «es la MISMA rama
 * de `decidePlanChange` (`intent: "downgrade"`), no una segunda regla que pueda divergir», y
 * la tabla de contratos de D6 les da EL MISMO conjunto de errores (`downgrade_blocked`,
 * `already_on_plan`, 503). Las dos URLs existen porque la UI tiene dos entradas —el botón de
 * bajar de plan desde `plus` y «Ajustarme y bajar a Free» desde `none`—; qué hacer lo decide
 * `decidePlanChange` con la fila real, nunca la URL. Con dos cuerpos, el día que cambie la
 * regla de bloqueo por locales uno de los dos se queda viejo.
 *
 * EL `catch` REGISTRA LA CAUSA (pedido explícito de la spec 0064: hoy un 503 no dejaba rastro
 * ni en los logs del server). Sólo lo que NO es `BillingError`: un 409 `downgrade_blocked` es
 * el producto funcionando, no un fallo, y loguearlo sería ruido que tapa el fallo real. El
 * 503 de Stripe lo loguea `confirmAtStripe`, que es el único que tiene el error de Stripe.
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
    if (!(error instanceof BillingError)) {
      console.error(
        "[billing] cancel: fallo inesperado",
        { businessId },
        error,
      );
    }
    return billingErrorResponse(
      error,
      "No pudimos actualizar tu suscripción. Vuelve a intentarlo.",
    );
  }
}

/**
 * Pasos 3 y 4. La `idempotencyKey` lleva el `downgrade_requested_at` ([R1-Derivado-2]): con
 * una clave FIJA —el patrón que `checkout` usa y esta spec denuncia— dos bajas separadas del
 * mismo negocio dentro de 24 h harían que Stripe devolviera la respuesta CACHEADA sin aplicar
 * nada. Como `settleToFree` limpia la marca en el paso 4, la cancelación siguiente estrena
 * clave; y un REINTENTO del mismo pedido reusa la misma, que es el camino de reparación.
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
 * reparación —donde la baja ya estaba pedida y quizás ya aplicada en Stripe— un revert
 * borraría una baja legítima y devolvería el tope a 3 con la cancelación viva en Stripe:
 * exactamente el daño que [R1-B3] existe para impedir, alcanzado por el otro camino. Y con la
 * baja inmediata gana un segundo motivo: limpiar `downgrade_requested_at` sobre una
 * suscripción YA cancelada en Stripe haría que el `deleted` aterrizara en `none` (ADR 0060).
 *
 * QUÉ SE LOGUEA: el error de Stripe y el `businessId`, y NADA MÁS. Ni el cuerpo del request
 * ni la clave de Stripe ni el id de la suscripción — con el `businessId` se llega a la fila,
 * que es de donde sale todo lo demás sin escribirlo en un log.
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
  try {
    // SIN `prorate` NI `invoice_now`: los dos son `false` por default y eso es literalmente
    // lo que el owner pidió («sin reembolso, no devolvemos plata»). Pasarlos explícitos sería
    // igual de correcto, pero escribir `prorate: false` invita a que alguien lo ponga en
    // `true` creyendo que es más prolijo.
    await gateway.subscriptions.cancel(planned.subscriptionId, undefined, {
      idempotencyKey: `billing:cancel:${planned.subscriptionId}:${planned.downgradeRequestedAt.toISOString()}`,
    });
  } catch (error) {
    console.error(
      "[billing] cancel: Stripe no confirmó la baja",
      { businessId },
      error,
    );
    if (planned.createdNow && isDeterministicRejection(error)) {
      await withDbTransaction((tx) => clearPendingPlan(tx, businessId));
    }
    throw new BillingError(
      503,
      "stripe_unavailable",
      "No pudimos confirmarlo con Stripe. Vuelve a intentarlo.",
    );
  }
  // Paso 4. La suscripción ya NO existe en Stripe, así que la fila no puede conservar su id:
  // `settleToFree` lo pone en `null`, y eso es lo que hace que un `customer.subscription.deleted`
  // tardío caiga en `not_adoptable` y no ensucie la fila (`applicability.ts`, regla 2).
  await withDbTransaction((tx) => settleToFree(tx, businessId));
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
