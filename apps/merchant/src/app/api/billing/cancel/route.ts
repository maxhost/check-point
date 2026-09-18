import { downgradeToFree } from "../_downgrade";

/**
 * Spec 0064, A2 (ADR 0063) — `POST /api/billing/cancel`: bajar de plan, INMEDIATAMENTE. Con
 * los planes de hoy «downgrade» y «cancelar» son LA MISMA operación (D0): `free` no tiene
 * suscripción de Stripe, así que bajar de plan es terminar la suscripción.
 *
 * LA BAJA YA NO SE PROGRAMA. Antes se pedía `update({cancel_at_period_end: true})` y el plan
 * caía al cerrar el periodo; el owner lo cazó en el QA de prod (pagaba Plus y ya sólo podía
 * tener 1 local) y el ADR 0063 lo cambió: se cancela en el acto, sin devolver ni acreditar el
 * tiempo pagado. `subscriptions.cancel` sin params es EXACTAMENTE eso — `prorate` e
 * `invoice_now` son `false` por default (`Subscriptions.d.ts`, stripe@22.5.0).
 *
 * `cancel` SIGUE SIENDO IDEMPOTENTE Y SIGUE SIENDO EL CAMINO DE REPARACIÓN: si el paso 3 o
 * el 4 se cayeron, el `cancel` siguiente reusa la MISMA `idempotencyKey` (la marca se
 * conserva con `coalesce`) y termina el trabajo.
 *
 * ORDEN DE OPERACIONES. ES NORMATIVO Y EL PASO 2 ES LO CONTRARIO DEL REFLEJO (anexo O-4):
 *
 *  1. transacción → `lockBusiness` → leer suscripción + contar activos → `decidePlanChange`.
 *     Si bloquea: 409 y nada más (`downgrade_blocked` lleva `archiveCount`).
 *  2. EN LA MISMA TRANSACCIÓN, escribir `pending_plan='free'` y `downgrade_requested_at`.
 *     Commit. **El reflejo al leer «la baja es inmediata» es borrar este paso, y rompe DOS
 *     cosas medidas:** (a) sin él, un 503 del paso 3 deja la fila en `plus` con la baja quizás
 *     aplicada en Stripe y el `cancel` siguiente sin forma de saber que ya se pidió — se
 *     pierde la idempotencia; (b) sin `downgrade_requested_at` puesto ANTES de llamar a
 *     Stripe, un webhook `deleted` que le gane la carrera al paso 4 ve `plan='plus'` +
 *     `downgradeRequestedAt=null` y aterriza en `none` en vez de `free` (`derive.ts`), que es
 *     el discriminante del ADR 0060 alcanzado por la puerta de atrás.
 *     Y sigue valiendo lo de antes: el tope efectivo cae a 1 en el MISMO commit que verificó
 *     el conteo, así que no queda ventana para desarchivar (mutación M5).
 *  3. RECIÉN AHORA, FUERA DEL LOCK, `subscriptions.cancel`. La llamada de red nunca ocurre
 *     con el lock tomado (la regla de `shared.ts:38-48`).
 *  4. Transacción corta: `settleToFree` — `plan='free'`, `status='active'`,
 *     `stripe_subscription_id=null` y las tres columnas de baja limpias.
 *
 * Si la decisión es `settle_to_free` (D10: `none`, o el `plus` SIN suscripción de A1) se
 * escribe el `SET` local y NO SE LLAMA A STRIPE ni una vez.
 */
export async function POST(request: Request) {
  return downgradeToFree(request);
}
