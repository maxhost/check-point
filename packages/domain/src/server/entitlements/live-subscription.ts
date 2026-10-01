/**
 * Spec 0072 — «¿hay una suscripcion VIVA?», la decision PURA sobre una fila de
 * `core.subscription`. Vivia en `billing/plan-change.ts`, que la sigue re-exportando para
 * que ni sus llamadores ni sus tests cambien.
 *
 * **POR QUE SE MUDO ACA, y no es cosmetica.** El catalogo de entitlements declara
 * `requiresLiveSubscription` por entrada (ADR 0073 §2), asi que `can()` necesita esta
 * decision. Importarla de `billing/plan-change` cerraba un CICLO real —
 * `entitlements/index` → `billing/plan-change` → `locations/core` → `entitlements` — y el
 * ciclo no era teorico: `FALLBACK_LOCATION_LIMIT` lee el catalogo en la inicializacion del
 * modulo, asi que la carga moria con «Cannot read properties of undefined (reading
 * 'locations.max')» en 8 archivos de test (medido antes de mover esto).
 *
 * Este modulo es **una hoja a proposito**: no importa nada. Es lo que lo hace seguro para
 * la pieza de mas abajo del stack. No agregarle imports de dominio.
 *
 * (El repo ya se quemo con un ciclo antes — ver el docblock de `marketing/plan-gate.ts`,
 * donde `CampaignError` NO se lanza desde el modulo del gate por el mismo motivo.)
 */

/** Lo minimo de la fila con lo que se decide. Estructural y no un `Pick<PlanChangeInput>`:
 * depender del tipo de billing volveria a atar esta hoja al dominio. `PlanChangeInput` y
 * `CampaignPlanRow` encajan las dos. */
export type LiveSubscriptionInput = {
  /** El status CRUDO de Stripe, no el colapsado. */
  status: string;
  stripeSubscriptionId: string | null;
};

/**
 * Estados de Stripe que prueban que la suscripción está MUERTA.
 *
 * [R2-2] La polaridad es load-bearing y la versión anterior de la spec 0063 la tenía al
 * revés. `Subscription.Status` NO tiene ocho valores: la línea termina en `| OtherString`
 * (`Subscriptions.d.ts:473`, verificado — el tipo es abierto a propósito) y el endpoint de
 * prod está pineado en `2020-08-27`. Con una allow-list POSITIVA de vivos, un status
 * desconocido caería en «no vivo» → `checkout` procede → segunda suscripción viva → doble
 * cobro, que es el daño exacto que este guard existe para prevenir. Con la lista de
 * MUERTOS, lo desconocido se trata como vivo: el default seguro para ESTE guard.
 *
 * (Al revés en `planFromSubscription` — ver `derive.ts`: ahí la allow-list positiva es la
 * correcta, porque lo desconocido no debe otorgar `plus`. Dos guards, dos polaridades,
 * cada una con su default seguro. Mutación M13 del plan de pruebas de la 0063.)
 */
export const DEAD_STRIPE_STATUS: ReadonlySet<string> = new Set([
  "canceled",
  "incomplete_expired",
]);

export function hasLiveSubscription(input: LiveSubscriptionInput): boolean {
  return (
    input.stripeSubscriptionId !== null && !DEAD_STRIPE_STATUS.has(input.status)
  );
}
