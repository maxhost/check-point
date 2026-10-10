import { describe, expect, it } from "vitest";
import {
  decidePlanChange,
  type PlanChangeDecision,
  type PlanChangeInput,
  type PlanIntent,
} from "./billing";

/**
 * Spec 0189 §D6 / T5 — la decisión de cobro, con la lista ORDENADA de guardas del contrato
 * (`billing/plan-change.ts`) como única fuente de verdad. Se asevera el orden DECLARADO.
 *
 * Honestidad sobre el oráculo: la MATRIZ de abajo no puede llevar su salida escrita a mano
 * caso por caso, así que su oráculo es una TRANSCRIPCIÓN independiente de las guardas
 * declaradas — misma regla, escrita de nuevo y sin importar nada de la implementación (ni
 * `hasLiveSubscription`, ni el catálogo: los topes 1/3 y las 48 h son literales a propósito).
 * Lo que la matriz compra es COBERTURA y detección de solapamientos; lo que pinnea cada regla
 * en concreto son los casos nombrados de `billing-plan-change-rows.test.ts`.
 */

const NOW = new Date("2026-10-10T12:00:00.000Z");
const H48 = 48 * 3_600_000;

const PLANS = ["trial", "base", "plus", "none"];
const INTERVALS: Array<string | null> = [null, "month", "year"];
/** `""` no es una cancelación programada ([R1-N8]). */
const PENDING: Array<string | null> = [null, "none", ""];
/** Los 8 status conocidos + uno inventado: `Subscription.Status` termina en `OtherString`. */
const STATUSES = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "canceled",
  "paused",
  "future_status",
];
const SUB_IDS: Array<string | null> = [null, "sub_x"];
/** 1 cabe en todo; 3 no cabe en base; 4 no cabe en ninguno. */
const ACTIVE_LOCATIONS = [1, 3, 4];
const OUTSIDE_BASE = [0, 1];
/** Sin prueba, vencida, a 48 h − 1 ms y a 48 h exactas. */
const TRIAL_ENDS: Array<Date | null> = [
  null,
  new Date(NOW.getTime() - 1),
  new Date(NOW.getTime() + H48 - 1),
  new Date(NOW.getTime() + H48),
];
const INTENTS: PlanIntent[] = [
  { kind: "subscribe", plan: "base", interval: "month" },
  { kind: "subscribe", plan: "base", interval: "year" },
  { kind: "subscribe", plan: "plus", interval: "month" },
  { kind: "subscribe", plan: "plus", interval: "year" },
  { kind: "change_plan", to: "base" },
  { kind: "change_plan", to: "plus" },
  { kind: "change_interval", to: "year" },
  { kind: "change_interval", to: "month" },
  { kind: "cancel" },
  { kind: "resume" },
];

/** Transcripción independiente de las guardas. NO importa nada del módulo bajo prueba. */
const DEAD = ["canceled", "incomplete_expired"];
const LIMIT: Record<string, number> = { base: 1, plus: 3 };

type Outcome = {
  kind: string;
  code?: string;
  archiveCount?: number;
  deactivateCount?: number;
  plan?: string;
  interval?: string;
  trialEnd?: string | null;
  to?: string;
  proration?: string;
};

function fit(input: PlanChangeInput, plan: string): Outcome | null {
  if (input.activeLocations > LIMIT[plan]) {
    return {
      kind: "blocked",
      code: "downgrade_blocked",
      archiveCount: input.activeLocations - LIMIT[plan],
    };
  }
  if (plan === "base" && input.activeCampaignsOutsideBase > 0) {
    return {
      kind: "blocked",
      code: "downgrade_blocked_campaigns",
      deactivateCount: input.activeCampaignsOutsideBase,
    };
  }
  return null;
}

function expectedOutcome(input: PlanChangeInput): Outcome {
  const live =
    input.stripeSubscriptionId !== null && !DEAD.includes(input.status);
  const scheduled = input.pendingPlan !== null && input.pendingPlan !== "";
  const intent = input.intent;
  switch (intent.kind) {
    case "subscribe": {
      if (live) return { kind: "blocked", code: "subscription_live" };
      const blocked = fit(input, intent.plan);
      if (blocked) return blocked;
      const end = input.trialEndsAt;
      const trialEnd =
        end !== null && end.getTime() - input.now.getTime() >= H48
          ? end.toISOString()
          : null;
      return {
        kind: "checkout",
        plan: intent.plan,
        interval: intent.interval,
        trialEnd,
      };
    }
    case "change_plan": {
      if (!live) return { kind: "blocked", code: "plan_needs_subscription" };
      if (scheduled) return { kind: "blocked", code: "cancel_scheduled" };
      if (input.currentPlan === intent.to)
        return { kind: "blocked", code: "already_on_plan" };
      if (intent.to === "base") {
        const blocked = fit(input, "base");
        if (blocked) return blocked;
      }
      return {
        kind: "change_plan",
        to: intent.to,
        proration: intent.to === "plus" ? "always_invoice" : "none",
      };
    }
    case "change_interval":
      if (intent.to === "month")
        return { kind: "blocked", code: "interval_downgrade_unsupported" };
      if (!live)
        return { kind: "blocked", code: "interval_needs_subscription" };
      if (input.currentInterval === intent.to)
        return { kind: "blocked", code: "interval_unchanged" };
      return { kind: "change_interval", to: "year" };
    case "cancel":
      if (!live) return { kind: "blocked", code: "no_subscription" };
      if (scheduled) return { kind: "blocked", code: "cancel_scheduled" };
      return { kind: "schedule_cancel" };
    case "resume":
      if (!live || !scheduled)
        return { kind: "blocked", code: "nothing_to_resume" };
      return { kind: "resume" };
  }
}

/** Todo menos el `message`: el texto es presentación, el `code` es el contrato. */
function outcomeOf(decision: PlanChangeDecision): Outcome {
  const out: Outcome = { kind: decision.kind };
  if (decision.kind === "blocked") {
    out.code = decision.code;
    if (decision.archiveCount !== undefined)
      out.archiveCount = decision.archiveCount;
    if (decision.deactivateCount !== undefined)
      out.deactivateCount = decision.deactivateCount;
  }
  if (decision.kind === "checkout") {
    out.plan = decision.plan;
    out.interval = decision.interval;
    out.trialEnd =
      decision.trialEnd === null ? null : decision.trialEnd.toISOString();
  }
  if (decision.kind === "change_plan") {
    out.to = decision.to;
    out.proration = decision.proration;
  }
  if (decision.kind === "change_interval") out.to = decision.to;
  return out;
}

function everyInput(): PlanChangeInput[] {
  const all: PlanChangeInput[] = [];
  for (const currentPlan of PLANS)
    for (const currentInterval of INTERVALS)
      for (const pendingPlan of PENDING)
        for (const status of STATUSES)
          for (const stripeSubscriptionId of SUB_IDS)
            for (const activeLocations of ACTIVE_LOCATIONS)
              for (const activeCampaignsOutsideBase of OUTSIDE_BASE)
                for (const trialEndsAt of TRIAL_ENDS)
                  for (const intent of INTENTS)
                    all.push({
                      currentPlan,
                      currentInterval,
                      pendingPlan,
                      status,
                      stripeSubscriptionId,
                      trialEndsAt,
                      now: NOW,
                      activeLocations,
                      activeCampaignsOutsideBase,
                      intent,
                    });
  return all;
}

describe("decidePlanChange — matriz completa del dominio (spec 0189 §D6)", () => {
  const inputs = everyInput();

  it("cubre el dominio entero, sin un caso de menos", () => {
    // 4·3·3·9·2·3·2·4·10: un barrido vacío o recortado no puede quedar verde.
    expect(inputs).toHaveLength(155520);
  });

  it("cada punto del dominio cae en la guarda declarada", () => {
    const mismatches = inputs
      .map((input) => ({
        input,
        actual: outcomeOf(decidePlanChange(input)),
        expected: expectedOutcome(input),
      }))
      .filter(
        ({ actual, expected }) =>
          JSON.stringify(actual) !== JSON.stringify(expected),
      );
    expect(mismatches.slice(0, 5)).toEqual([]);
  });

  it("ninguna salida queda sin ejercer (la matriz no es degenerada)", () => {
    const decisions = inputs.map(decidePlanChange);
    expect([...new Set(decisions.map((d) => d.kind as string))].sort()).toEqual(
      [
        "blocked",
        "change_interval",
        "change_plan",
        "checkout",
        "resume",
        "schedule_cancel",
      ],
    );
    const codes = new Set(
      decisions
        .filter((d) => d.kind === "blocked")
        .map((d) => (d as { code: string }).code),
    );
    expect([...codes].sort()).toEqual([
      "already_on_plan",
      "cancel_scheduled",
      "downgrade_blocked",
      "downgrade_blocked_campaigns",
      "interval_downgrade_unsupported",
      "interval_needs_subscription",
      "interval_unchanged",
      "no_subscription",
      "nothing_to_resume",
      "plan_needs_subscription",
      "subscription_live",
    ]);
    // Las dos ramas de `trialEnd` del checkout se ejercen.
    const trialEnds = decisions
      .filter((d) => d.kind === "checkout")
      .map((d) => (d as { trialEnd: Date | null }).trialEnd === null);
    expect(new Set(trialEnds)).toEqual(new Set([true, false]));
  });

  it("todo bloqueo trae un mensaje para el owner", () => {
    const empty = inputs
      .map(decidePlanChange)
      .filter((d) => d.kind === "blocked" && d.message.trim() === "");
    expect(empty).toEqual([]);
  });
});
