import { locationLimitForPlan } from "../locations/core";

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
  /** `resume` sin baja programada. 409 */
  | "nothing_to_resume"
  /** `resume` sobre una suscripción muerta: el camino es `upgrade`. 409 */
  | "subscription_dead"
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
  | { kind: "resume" } // deshacer una baja programada
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
  intent: PlanIntent;
};

export type PlanChangeDecision =
  | { kind: "checkout"; interval: "month" | "year" }
  /** Hay suscripción: se cancela al fin del periodo (D6, orden de operaciones). */
  | { kind: "schedule_downgrade" }
  /** No hay suscripción viva: se escribe `free` local, sin tocar Stripe (D10). */
  | { kind: "settle_to_free" }
  | { kind: "resume" }
  | { kind: "change_interval"; to: "year" }
  | {
      kind: "blocked";
      code: BlockCode;
      message: string;
      archiveCount?: number;
    };

/**
 * Estados de Stripe que prueban que la suscripción está MUERTA.
 *
 * [R2-2] La polaridad es load-bearing y la versión anterior de la spec la tenía al revés.
 * `Subscription.Status` NO tiene ocho valores: la línea termina en `| OtherString`
 * (`Subscriptions.d.ts:473`, verificado — el tipo es abierto a propósito) y el endpoint de
 * prod está pineado en `2020-08-27`. Con una allow-list POSITIVA de vivos, un status
 * desconocido caería en «no vivo» → `checkout` procede → segunda suscripción viva → doble
 * cobro, que es el daño exacto que este guard existe para prevenir. Con la lista de
 * MUERTOS, lo desconocido se trata como vivo: el default seguro para ESTE guard.
 *
 * (Al revés en `planFromSubscription` — ver `derive.ts`: ahí la allow-list positiva es la
 * correcta, porque lo desconocido no debe otorgar `plus`. Dos guards, dos polaridades,
 * cada una con su default seguro. Mutación M13 del plan de pruebas.)
 */
export const DEAD_STRIPE_STATUS: ReadonlySet<string> = new Set([
  "canceled",
  "incomplete_expired",
]);

export function hasLiveSubscription(input: PlanChangeInput): boolean {
  return (
    input.stripeSubscriptionId !== null && !DEAD_STRIPE_STATUS.has(input.status)
  );
}

/**
 * GUARDAS, EN ORDEN. PRIMER MATCH GANA. ES NORMATIVO — el unit
 * (`billing-plan-change.test.ts`) asevera el orden DECLARADO, no el intuitivo, y sin esta
 * lista la matriz de la spec se escribiría adivinando.
 *
 * `intent: "upgrade"`
 *   1. `hasLiveSubscription` → blocked `subscription_live`. Si además hay baja programada,
 *      el camino correcto es `resume` y el mensaje lo dice.
 *   2. `currentPlan === 'plus'` → blocked `already_on_plan`.
 *   3. en otro caso → `{ kind: "checkout", interval }`.
 *      Cubre los 9 `free` de prod: `status='active'`, sin id → no hay suscripción viva.
 *
 * `intent: "downgrade"`
 *   1. `activeLocations > locationLimitForPlan("free")` → blocked `downgrade_blocked` con
 *      `archiveCount = activeLocations - locationLimitForPlan("free")`. VA PRIMERO: es la
 *      condición del owner (ADR 0058 §3/§6) y la que alimenta el modal. El `1` NO se
 *      hardcodea — el tope vive en `locations/core.ts` y en ningún otro lado.
 *   2. `currentPlan === 'free'` → blocked `already_on_plan`.
 *   3. `hasLiveSubscription` → `{ kind: "schedule_downgrade" }`.
 *   4. en otro caso (`none`, o `plus` sin id como A1) → `{ kind: "settle_to_free" }`.
 *      Acá muere el código `no_subscription` de la versión anterior, que era la fila que
 *      contradecía a D10.
 *
 * `intent: "resume"`
 *   1. `pendingPlan === null` → blocked `nothing_to_resume`.
 *   2. `!hasLiveSubscription` → blocked `subscription_dead` (el camino es `upgrade`).
 *   3. en otro caso → `{ kind: "resume" }`.
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
 * `currentPlan === 'free'` → gana `downgrade_blocked` (guarda 1 antes que la 2).
 */
export function decidePlanChange(input: PlanChangeInput): PlanChangeDecision {
  switch (input.intent.kind) {
    case "upgrade":
      return decideUpgrade(input, input.intent.interval);
    case "downgrade":
      return decideDowngrade(input);
    case "resume":
      return decideResume(input);
    case "change_interval":
      return decideChangeInterval(input, input.intent.to);
  }
}

function blocked(
  code: BlockCode,
  message: string,
  archiveCount?: number,
): PlanChangeDecision {
  return archiveCount === undefined
    ? { kind: "blocked", code, message }
    : { kind: "blocked", code, message, archiveCount };
}

function decideUpgrade(
  input: PlanChangeInput,
  interval: "month" | "year",
): PlanChangeDecision {
  if (hasLiveSubscription(input)) {
    return blocked(
      "subscription_live",
      input.pendingPlan !== null
        ? "Tu suscripción sigue activa hasta el final del periodo. Reanúdala en lugar de contratar otra."
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
      archiveCount,
    );
  }
  if (input.currentPlan === "free") {
    return blocked("already_on_plan", "Ya estás en el plan Free.");
  }
  if (hasLiveSubscription(input)) return { kind: "schedule_downgrade" };
  return { kind: "settle_to_free" };
}

function decideResume(input: PlanChangeInput): PlanChangeDecision {
  if (input.pendingPlan === null) {
    return blocked(
      "nothing_to_resume",
      "No hay ninguna baja programada que reanudar.",
    );
  }
  if (!hasLiveSubscription(input)) {
    return blocked(
      "subscription_dead",
      "Tu suscripción ya terminó. Para volver a Plus contrata el plan de nuevo.",
    );
  }
  return { kind: "resume" };
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
