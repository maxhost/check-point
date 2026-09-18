import { locationLimitForPlan } from "../locations/core";
import { hasLiveSubscription } from "../entitlements/live-subscription";

/**
 * Spec 0063, D4 — CONTRATO. Lo dejó el orquestador antes de despachar; el implementador
 * añade `decidePlanChange` en este mismo archivo y NO cambia los tipos ni el orden de las
 * guardas sin volver la spec a `borrador`.
 *
 * Por qué el intent va DISCRIMINADO y no `target: "plus" | "free"` (bloqueante [R2] de la
 * segunda ronda, encontrado por los dos revisores por separado): con un target plano el
 * cambio de intervalo no se podía expresar, y la tabla de 8 filas no declaraba orden de
 * evaluación — al menos cuatro entradas matcheaban dos filas a la vez (incluida `none` +
 * `free`, que matcheaba `no_subscription` Y `settle_to_free`, o sea que la salida que D10
 * agrega para que `none` no sea un callejón era, leída literal, un 409). Con el intent
 * discriminado cada movimiento tiene sus propias guardas y no hay solapamiento.
 */

/** Motivo estable por el que un cambio de plan no procede. Viaja al cliente como `code`. */
export type BlockCode =
  /** Ya hay una suscripción viva en Stripe: abrir otro Checkout cobraría dos veces. 409 */
  | "subscription_live"
  /** El negocio ya está en el plan que pide. 409 */
  | "already_on_plan"
  /** Hay más locales activos que los del plan destino. Trae `archiveCount`. 409 */
  | "downgrade_blocked"
  /** Hay campañas activas (spec 0065). Trae `deactivateCount`. 409 */
  | "downgrade_blocked_campaigns"
  /** anual → mensual, fuera de alcance por diseño (D9, tarea 55). 409 */
  | "interval_downgrade_unsupported"
  /** Cambio de intervalo sin suscripción viva que cambiar. 409 */
  | "interval_needs_subscription"
  /** Ya está en ese intervalo. 409 */
  | "interval_unchanged";

/**
 * El movimiento que el llamador pide. `upgrade` lleva el intervalo porque el Checkout se
 * abre contra un price concreto; `change_interval` lleva el destino porque la decisión de
 * rechazar `month` es de esta función, no de la ruta.
 */
export type PlanIntent =
  | { kind: "upgrade"; interval: "month" | "year" } // free → plus, por Checkout
  | { kind: "downgrade" } // plus → free (cancelar) | none → free
  | { kind: "change_interval"; to: "month" | "year" };

export type PlanChangeInput = {
  /** `'free' | 'plus' | 'none' | cualquier otro`. No se estrecha: la columna es `text`. */
  currentPlan: string;
  /** En prod hay un `plus` con `interval` NULL (A1) — [R2]. No es un estado imposible. */
  currentInterval: string | null;
  pendingPlan: string | null;
  /** El status CRUDO de Stripe (D5.e). NO el colapsado `active|trialing → active`. */
  status: string;
  stripeSubscriptionId: string | null;
  activeLocations: number;
  /** Campañas en `status = 'active'` (spec 0065, fase D). El bloqueo es DURO, igual que el
   * de locales: el owner las desactiva primero. */
  activeCampaigns: number;
  intent: PlanIntent;
};

export type PlanChangeDecision =
  | { kind: "checkout"; interval: "month" | "year" }
  /** Hay suscripción: se cancela en el acto (spec 0064 A2, orden de operaciones). El nombre
   * quedó de cuando la baja se programaba (ADR 0063 la hizo inmediata) y se CONSERVA: es el
   * discriminante de «hay que hablar con Stripe», que es lo que la ruta necesita saber.
   * Renombrarlo tocaría la matriz, los casos nombrados y las dos rutas sin cambiar ninguna
   * regla. */
  | { kind: "schedule_downgrade" }
  /** No hay suscripción viva: se escribe `free` local, sin tocar Stripe (D10). */
  | { kind: "settle_to_free" }
  | { kind: "change_interval"; to: "year" }
  | {
      kind: "blocked";
      code: BlockCode;
      message: string;
      archiveCount?: number;
      /** Sólo en `downgrade_blocked_campaigns`: cuántas campañas hay que desactivar. */
      deactivateCount?: number;
    };

/**
 * `DEAD_STRIPE_STATUS` y `hasLiveSubscription` se MUDARON a
 * `server/entitlements/live-subscription.ts` (spec 0072) y se re-exportan desde acá: son la
 * misma decisión que el catálogo de entitlements necesita para `requiresLiveSubscription`,
 * y dejarlas en este archivo cerraba un ciclo de imports que mataba la carga de 8 suites
 * (el motivo completo está escrito en el módulo nuevo).
 *
 * Se re-exportan y no se reescriben los imports de `applicability.ts`, `reconcile.ts`,
 * `view.ts` y `billing/index.ts` porque esta spec es una unificación, no un renombre: el
 * `DEAD_STRIPE_STATUS` que esos módulos consumen sigue siendo el mismo objeto.
 */
export {
  DEAD_STRIPE_STATUS,
  hasLiveSubscription,
} from "../entitlements/live-subscription";

/**
 * GUARDAS, EN ORDEN. PRIMER MATCH GANA. ES NORMATIVO — el unit
 * (`billing-plan-change.test.ts`) asevera el orden DECLARADO, no el intuitivo, y sin esta
 * lista la matriz de la spec se escribiría adivinando.
 *
 * `intent: "upgrade"`
 *   1. `hasLiveSubscription` → blocked `subscription_live`. Si además hay baja programada
 *      —que desde la spec 0064 sólo puede venir del dashboard de Stripe, porque nuestro flujo
 *      ya no la crea— el mensaje lo dice y NO ofrece reanudar: esa operación no existe.
 *   2. `currentPlan === 'plus'` → blocked `already_on_plan`.
 *   3. en otro caso → `{ kind: "checkout", interval }`.
 *      Cubre los 9 `free` de prod: `status='active'`, sin id → no hay suscripción viva.
 *
 * `intent: "downgrade"`
 *   1. `activeLocations > locationLimitForPlan("free")` → blocked `downgrade_blocked` con
 *      `archiveCount = activeLocations - locationLimitForPlan("free")`. VA PRIMERO: es la
 *      condición del owner (ADR 0058 §3/§6) y la que alimenta el modal. El `1` NO se
 *      hardcodea — el tope vive en `locations/core.ts` y en ningún otro lado.
 *   2. `activeCampaigns > 0` → blocked `downgrade_blocked_campaigns` con
 *      `deactivateCount = activeCampaigns` (spec 0065, fase D). VA SEGUNDA, entre la de
 *      locales y `already_on_plan`, y el orden lo fija la spec: la condición del owner es
 *      la de locales y es la que ya alimentaba el modal.
 *      CONSECUENCIA ACEPTADA Y DECLARADA EN LA SPEC: un negocio que viola las DOS
 *      condiciones recibe primero el bloqueo de locales y, tras archivar, el de campañas.
 *      Son dos vueltas. Mostrar las dos juntas exigiría que `PlanChangeDecision` llevara
 *      los dos contadores; se deja como posible mejora y NO entra.
 *   3. `currentPlan === 'free'` → blocked `already_on_plan`.
 *   4. `hasLiveSubscription` → `{ kind: "schedule_downgrade" }`.
 *   5. en otro caso (`none`, o `plus` sin id como A1) → `{ kind: "settle_to_free" }`.
 *      Acá muere el código `no_subscription` de la versión anterior, que era la fila que
 *      contradecía a D10.
 *
 * `intent: "change_interval"`
 *   1. `to === "month"` → blocked `interval_downgrade_unsupported` (D9, tarea 55).
 *   2. `!hasLiveSubscription` → blocked `interval_needs_subscription`.
 *   3. `currentInterval === to` → blocked `interval_unchanged`.
 *   4. en otro caso (incluye `currentInterval === null`, el caso de A1) →
 *      `{ kind: "change_interval", to: "year" }`. Se permite con intervalo desconocido
 *      porque el real lo sabe Stripe y el `retrieve` de D9 lo confirma.
 *
 * Todos los `BlockCode` responden 409. El `payment_failed` de D9 (402) y los de
 * configuración (503) NO salen de acá: los produce la ruta.
 *
 * Precedencia que el unit asevera explícitamente: `downgrade` con 2 activos Y
 * `currentPlan === 'free'` → gana `downgrade_blocked` (guarda 1 antes que la 3); con 2
 * activos Y 1 campaña activa → gana `downgrade_blocked` (guarda 1 antes que la 2).
 */
export function decidePlanChange(input: PlanChangeInput): PlanChangeDecision {
  switch (input.intent.kind) {
    case "upgrade":
      return decideUpgrade(input, input.intent.interval);
    case "downgrade":
      return decideDowngrade(input);
    case "change_interval":
      return decideChangeInterval(input, input.intent.to);
  }
}

/** El `extra` es el contador que el modal necesita, y va DISCRIMINADO: `archiveCount`
 * pertenece a `downgrade_blocked` y `deactivateCount` a `downgrade_blocked_campaigns`.
 * Un bloqueo sin contador no lleva ninguna de las dos claves (el `...undefined` no agrega
 * nada), que es lo que deja al resto de los códigos exactamente como estaban. */
function blocked(
  code: BlockCode,
  message: string,
  extra?: { archiveCount: number } | { deactivateCount: number },
): PlanChangeDecision {
  return { kind: "blocked", code, message, ...extra };
}

function decideUpgrade(
  input: PlanChangeInput,
  interval: "month" | "year",
): PlanChangeDecision {
  if (hasLiveSubscription(input)) {
    return blocked(
      "subscription_live",
      input.pendingPlan !== null
        ? "Tu suscripción sigue activa hasta el final del periodo. Cuando termine podrás contratar el plan otra vez."
        : "Ya tienes una suscripción activa.",
    );
  }
  if (input.currentPlan === "plus") {
    return blocked("already_on_plan", "Ya estás en el plan Plus.");
  }
  return { kind: "checkout", interval };
}

function decideDowngrade(input: PlanChangeInput): PlanChangeDecision {
  const freeLimit = locationLimitForPlan("free");
  if (input.activeLocations > freeLimit) {
    const archiveCount = input.activeLocations - freeLimit;
    return blocked(
      "downgrade_blocked",
      `Para volver a Free necesitas ${freeLimit} local activo; hoy tienes ${input.activeLocations}. Archiva ${archiveCount}.`,
      { archiveCount },
    );
  }
  if (input.activeCampaigns > 0) {
    return blocked(
      "downgrade_blocked_campaigns",
      `Para volver a Free no puedes tener campañas activas; hoy tienes ${input.activeCampaigns}. Desactiva ${input.activeCampaigns}.`,
      { deactivateCount: input.activeCampaigns },
    );
  }
  if (input.currentPlan === "free") {
    return blocked("already_on_plan", "Ya estás en el plan Free.");
  }
  if (hasLiveSubscription(input)) return { kind: "schedule_downgrade" };
  return { kind: "settle_to_free" };
}

function decideChangeInterval(
  input: PlanChangeInput,
  to: "month" | "year",
): PlanChangeDecision {
  if (to === "month") {
    return blocked(
      "interval_downgrade_unsupported",
      "Por ahora no podemos pasar de anual a mensual.",
    );
  }
  if (!hasLiveSubscription(input)) {
    return blocked(
      "interval_needs_subscription",
      "No hay una suscripción activa a la que cambiarle el intervalo.",
    );
  }
  if (input.currentInterval === to) {
    return blocked("interval_unchanged", "Ya estás en el plan anual.");
  }
  return { kind: "change_interval", to: "year" };
}
