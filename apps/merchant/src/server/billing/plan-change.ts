import { limitForPlan } from "@mi-pasaporte/domain/server/entitlements/index";
import { hasLiveSubscription } from "@mi-pasaporte/domain/server/entitlements/live-subscription";
import type { BillingInterval, PaidPlan } from "./prices";
import { planLabel } from "./view";

/**
 * Spec 0189 §D6 (ADR 0134 §6-§9) — LAS DECISIONES DE COBRO, como función PURA. Ya no hay plan
 * gratis al que bajar: entran el cambio de plan, cancelar al fin del periodo y reanudar. El
 * intent va DISCRIMINADO ([R2] de la spec 0063): cada movimiento tiene sus propias guardas.
 */

/** Motivo estable por el que un cambio no procede. Viaja al cliente como `code`. Todos 409.
 * Los nombres que ya existían se conservan: la UI de GPT ya los conoce. */
export type BlockCode =
  /** Ya hay una suscripción viva en Stripe: abrir otro Checkout cobraría dos veces. */
  | "subscription_live"
  /** El negocio ya está en el plan que pide. */
  | "already_on_plan"
  /** Hay más locales activos que los del plan destino. Trae `archiveCount`. */
  | "downgrade_blocked"
  /** Hay campañas activas que el plan base no incluye. Trae `deactivateCount`. */
  | "downgrade_blocked_campaigns"
  /** anual → mensual, fuera de alcance por diseño (tarea 55). */
  | "interval_downgrade_unsupported"
  /** Cambio de intervalo sin suscripción viva que cambiar. */
  | "interval_needs_subscription"
  /** Ya está en ese intervalo. */
  | "interval_unchanged"
  /** Cambio de plan sin suscripción viva: primero se contrata (checkout). */
  | "plan_needs_subscription"
  /** Hay una cancelación programada: primero se reanuda. */
  | "cancel_scheduled"
  /** Cancelar sin suscripción viva. */
  | "no_subscription"
  /** Reanudar sin suscripción viva o sin cancelación programada. */
  | "nothing_to_resume";

export type PlanIntent =
  | { kind: "subscribe"; plan: PaidPlan; interval: BillingInterval }
  | { kind: "change_plan"; to: PaidPlan }
  | { kind: "change_interval"; to: BillingInterval }
  | { kind: "cancel" }
  | { kind: "resume" };

export type PlanChangeInput = {
  /** `'trial' | 'base' | 'plus' | 'none' | cualquier otro`. La columna es `text`. */
  currentPlan: string;
  currentInterval: string | null;
  pendingPlan: string | null;
  /** El status CRUDO de Stripe. NO el colapsado. */
  status: string;
  stripeSubscriptionId: string | null;
  trialEndsAt: Date | null;
  now: Date;
  activeLocations: number;
  /** Campañas `active` cuya plantilla no está en `BASE_TEMPLATE_KEYS` (incluidas las propias).
   * Alimenta el bloqueo de bajar a base. */
  activeCampaignsOutsideBase: number;
  intent: PlanIntent;
};

export type PlanChangeDecision =
  | {
      kind: "checkout";
      plan: PaidPlan;
      interval: BillingInterval;
      /** `subscription_data.trial_end` del Checkout, o `null` = cobro en el acto. */
      trialEnd: Date | null;
    }
  | {
      kind: "change_plan";
      to: PaidPlan;
      /** Subir cobra la diferencia ya; bajar rige desde la próxima factura (ADR 0134 §9). */
      proration: "always_invoice" | "none";
    }
  | { kind: "change_interval"; to: "year" }
  | { kind: "schedule_cancel" }
  | { kind: "resume" }
  | {
      kind: "blocked";
      code: BlockCode;
      message: string;
      archiveCount?: number;
      deactivateCount?: number;
    };

/** Viven en el dominio (spec 0072); se re-exportan para los consumidores de este módulo. */
export {
  DEAD_STRIPE_STATUS,
  hasLiveSubscription,
} from "@mi-pasaporte/domain/server/entitlements/live-subscription";

/** `trial_end` de Checkout exige al menos 48 h en el futuro (`Sessions.d.ts:3007`,
 * stripe@22.5.0). Con menos, se cobra en el acto (ADR 0134 §6). */
export const CHECKOUT_TRIAL_MIN_MS = 48 * 60 * 60 * 1000;

/**
 * La fecha de `trial_end` del Checkout: el fin de la prueba si faltan **48 h o más**; si no
 * (o no hay prueba), `null`. Así el primer cobro cae el día 90 cuando se puede (ADR 0134 §6).
 */
export function checkoutTrialEnd(
  trialEndsAt: Date | null,
  now: Date,
): Date | null {
  if (trialEndsAt === null) return null;
  return trialEndsAt.getTime() - now.getTime() >= CHECKOUT_TRIAL_MIN_MS
    ? trialEndsAt
    : null;
}

/**
 * GUARDAS, EN ORDEN. PRIMER MATCH GANA. ES NORMATIVO (spec 0189 §D6) y el unit
 * (`billing-plan-change.test.ts`) asevera el orden declarado.
 *
 * `subscribe {plan, interval}` (checkout):
 *   1. suscripción viva → `subscription_live`.
 *   2. `activeLocations > limitForPlan(plan)` → `downgrade_blocked` + `archiveCount`.
 *   3. `plan === "base"` y `activeCampaignsOutsideBase > 0` → `downgrade_blocked_campaigns`.
 *   4. → `checkout {plan, interval, trialEnd: checkoutTrialEnd(trialEndsAt, now)}`.
 *
 * `change_plan {to}`:
 *   1. sin suscripción viva → `plan_needs_subscription`.
 *   2. cancelación programada → `cancel_scheduled`.
 *   3. `currentPlan === to` → `already_on_plan`.
 *   4. `to === "base"` con locales o campañas de más → mismos bloqueos y orden que subscribe.
 *   5. → `change_plan {to, proration}`: `always_invoice` al subir a plus, `none` al bajar.
 *
 * `change_interval {to}` (igual que la spec 0063 D9):
 *   1. `to === "month"` → `interval_downgrade_unsupported`.
 *   2. sin suscripción viva → `interval_needs_subscription`.
 *   3. `currentInterval === to` → `interval_unchanged`.
 *   4. → `change_interval {to: "year"}`.
 *
 * `cancel`: sin suscripción viva → `no_subscription`; ya programada → `cancel_scheduled`;
 *   → `schedule_cancel`.
 *
 * `resume`: sin suscripción viva o sin cancelación programada → `nothing_to_resume`;
 *   → `resume`.
 *
 * Un `pendingPlan` VACÍO no es una cancelación programada ([R1-N8] de la spec 0063).
 */
export function decidePlanChange(input: PlanChangeInput): PlanChangeDecision {
  switch (input.intent.kind) {
    case "subscribe":
      return decideSubscribe(input, input.intent.plan, input.intent.interval);
    case "change_plan":
      return decideChangePlan(input, input.intent.to);
    case "change_interval":
      return decideChangeInterval(input, input.intent.to);
    case "cancel":
      return decideCancel(input);
    case "resume":
      return decideResume(input);
  }
}

function blocked(
  code: BlockCode,
  message: string,
  extra?: { archiveCount: number } | { deactivateCount: number },
): PlanChangeDecision {
  return { kind: "blocked", code, message, ...extra };
}

function cancelScheduled(input: PlanChangeInput): boolean {
  return typeof input.pendingPlan === "string" && input.pendingPlan !== "";
}

/** Los dos bloqueos de llegar a un plan: locales primero (la condición del owner, ADR 0058
 * §3/§6), campañas después. `null` = el negocio cabe en el plan. */
function fitBlock(
  input: PlanChangeInput,
  plan: PaidPlan,
): PlanChangeDecision | null {
  const limit = limitForPlan(plan, "locations.max");
  const label = planLabel(plan);
  if (input.activeLocations > limit) {
    const archiveCount = input.activeLocations - limit;
    return blocked(
      "downgrade_blocked",
      `El plan ${label} admite ${limit} ${limit === 1 ? "local activo" : "locales activos"}; hoy tienes ${input.activeLocations}. Archiva ${archiveCount}.`,
      { archiveCount },
    );
  }
  const extra = input.activeCampaignsOutsideBase;
  if (plan === "base" && extra > 0) {
    return blocked(
      "downgrade_blocked_campaigns",
      `El plan ${label} solo incluye Bienvenida y Venta cruzada; hoy tienes ${extra} ${extra === 1 ? "campaña activa" : "campañas activas"} fuera de eso. Desactiva ${extra}.`,
      { deactivateCount: extra },
    );
  }
  return null;
}

function decideSubscribe(
  input: PlanChangeInput,
  plan: PaidPlan,
  interval: BillingInterval,
): PlanChangeDecision {
  if (hasLiveSubscription(input)) {
    return blocked(
      "subscription_live",
      cancelScheduled(input)
        ? "Tu suscripción sigue activa hasta el final del periodo: reanúdala en vez de contratar otra."
        : "Ya tienes una suscripción activa.",
    );
  }
  const fit = fitBlock(input, plan);
  if (fit) return fit;
  return {
    kind: "checkout",
    plan,
    interval,
    trialEnd: checkoutTrialEnd(input.trialEndsAt, input.now),
  };
}

function decideChangePlan(
  input: PlanChangeInput,
  to: PaidPlan,
): PlanChangeDecision {
  if (!hasLiveSubscription(input)) {
    return blocked(
      "plan_needs_subscription",
      "No hay una suscripción activa que cambiar: elige un plan primero.",
    );
  }
  if (cancelScheduled(input)) {
    return blocked(
      "cancel_scheduled",
      "Reanuda tu suscripción para cambiar de plan.",
    );
  }
  if (input.currentPlan === to) {
    return blocked("already_on_plan", `Ya estás en el plan ${planLabel(to)}.`);
  }
  if (to === "base") {
    const fit = fitBlock(input, to);
    if (fit) return fit;
  }
  return {
    kind: "change_plan",
    to,
    proration: to === "plus" ? "always_invoice" : "none",
  };
}

function decideChangeInterval(
  input: PlanChangeInput,
  to: BillingInterval,
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

function decideCancel(input: PlanChangeInput): PlanChangeDecision {
  if (!hasLiveSubscription(input)) {
    return blocked(
      "no_subscription",
      "No hay una suscripción activa que cancelar.",
    );
  }
  if (cancelScheduled(input)) {
    return blocked(
      "cancel_scheduled",
      "Tu suscripción ya termina al final del periodo.",
    );
  }
  return { kind: "schedule_cancel" };
}

function decideResume(input: PlanChangeInput): PlanChangeDecision {
  if (!hasLiveSubscription(input) || !cancelScheduled(input)) {
    return blocked(
      "nothing_to_resume",
      "No hay una cancelación programada que reanudar.",
    );
  }
  return { kind: "resume" };
}
