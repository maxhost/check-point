import { describe, expect, it } from "vitest";
import {
  decidePlanChange,
  type PlanChangeDecision,
  type PlanChangeInput,
  type PlanIntent,
} from "./billing";

/**
 * Spec 0063, D4 — la decisión de si un cambio de plan procede, con la lista ORDENADA de
 * guardas del contrato (`billing/plan-change.ts`) como única fuente de verdad. Se asevera
 * el orden DECLARADO, no el intuitivo.
 *
 * Honestidad sobre el oráculo, porque importa para leer este archivo: la MATRIZ de abajo
 * (5832 casos) no puede llevar su salida escrita a mano caso por caso, así que su oráculo
 * es una TRANSCRIPCIÓN independiente de las guardas declaradas — misma regla, escrita de
 * nuevo y sin importar nada de la implementación (ni `hasLiveSubscription`, ni
 * `locationLimitForPlan`: el `1` del tope de free es un literal acá a propósito). Lo que
 * la matriz compra es COBERTURA (ningún punto del dominio sin aserción) y detección de
 * solapamientos; lo que pinnea cada regla en concreto son los casos nombrados de
 * `billing-plan-change-rows.test.ts`, con su salida literal, y las mutaciones M11/M12/M13.
 */

const PLANS = ["free", "plus", "none"];
const INTERVALS: Array<string | null> = [null, "month", "year"];
const PENDING: Array<string | null> = [null, "free"];
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
const ACTIVE_LOCATIONS = [1, 2, 3];
/** Spec 0065, fase D: 0 = no bloquea, 1 = el borde, 3 = plural. */
const ACTIVE_CAMPAIGNS = [0, 1, 3];
const INTENTS: PlanIntent[] = [
  { kind: "upgrade", interval: "month" },
  { kind: "upgrade", interval: "year" },
  { kind: "downgrade" },
  { kind: "change_interval", to: "year" },
  { kind: "change_interval", to: "month" },
];

/** Transcripción independiente de las guardas. NO importa nada del módulo bajo prueba. */
const DEAD = ["canceled", "incomplete_expired"];
/** El tope de free, literal: si `PLAN_LOCATION_LIMITS.free` cambia, esto se pone rojo. */
const FREE_LIMIT = 1;

type Outcome = {
  kind: string;
  code?: string;
  archiveCount?: number;
  deactivateCount?: number;
  interval?: string;
  to?: string;
};

function expectedOutcome(input: PlanChangeInput): Outcome {
  const live =
    input.stripeSubscriptionId !== null && !DEAD.includes(input.status);
  const intent = input.intent;
  if (intent.kind === "upgrade") {
    if (live) return { kind: "blocked", code: "subscription_live" };
    if (input.currentPlan === "plus")
      return { kind: "blocked", code: "already_on_plan" };
    return { kind: "checkout", interval: intent.interval };
  }
  if (intent.kind === "downgrade") {
    if (input.activeLocations > FREE_LIMIT) {
      return {
        kind: "blocked",
        code: "downgrade_blocked",
        archiveCount: input.activeLocations - FREE_LIMIT,
      };
    }
    if (input.activeCampaigns > 0) {
      return {
        kind: "blocked",
        code: "downgrade_blocked_campaigns",
        deactivateCount: input.activeCampaigns,
      };
    }
    if (input.currentPlan === "free")
      return { kind: "blocked", code: "already_on_plan" };
    return live ? { kind: "schedule_downgrade" } : { kind: "settle_to_free" };
  }
  if (intent.to === "month")
    return { kind: "blocked", code: "interval_downgrade_unsupported" };
  if (!live) return { kind: "blocked", code: "interval_needs_subscription" };
  if (input.currentInterval === intent.to)
    return { kind: "blocked", code: "interval_unchanged" };
  return { kind: "change_interval", to: "year" };
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
  if (decision.kind === "checkout") out.interval = decision.interval;
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
              for (const activeCampaigns of ACTIVE_CAMPAIGNS)
                for (const intent of INTENTS)
                  all.push({
                    currentPlan,
                    currentInterval,
                    pendingPlan,
                    status,
                    stripeSubscriptionId,
                    activeLocations,
                    activeCampaigns,
                    intent,
                  });
  return all;
}

describe("decidePlanChange — matriz completa del dominio (spec 0063, D4)", () => {
  const inputs = everyInput();

  it("cubre el dominio entero, sin un caso de menos", () => {
    // Piso de casos: un barrido vacío o recortado no puede quedar verde.
    expect(inputs).toHaveLength(
      PLANS.length *
        INTERVALS.length *
        PENDING.length *
        STATUSES.length *
        SUB_IDS.length *
        ACTIVE_LOCATIONS.length *
        ACTIVE_CAMPAIGNS.length *
        INTENTS.length,
    );
    // 14580 = los 4860 de la spec 0063 (5832 menos los 972 del intent `resume`, que dejó de
    // existir — spec 0064 §4) por los 3 valores de `activeCampaigns` de la spec 0065.
    expect(inputs).toHaveLength(14580);
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
    expect(mismatches).toEqual([]);
  });

  it("ninguna salida queda sin ejercer (la matriz no es degenerada)", () => {
    const kinds = new Set(
      inputs.map((input) => decidePlanChange(input).kind as string),
    );
    expect([...kinds].sort()).toEqual([
      "blocked",
      "change_interval",
      "checkout",
      "schedule_downgrade",
      "settle_to_free",
    ]);
    const codes = new Set(
      inputs
        .map((input) => decidePlanChange(input))
        .filter((d) => d.kind === "blocked")
        .map((d) => (d as { code: string }).code),
    );
    expect([...codes].sort()).toEqual([
      "already_on_plan",
      "downgrade_blocked",
      "downgrade_blocked_campaigns",
      "interval_downgrade_unsupported",
      "interval_needs_subscription",
      "interval_unchanged",
      "subscription_live",
    ]);
  });

  it("todo bloqueo trae un mensaje para el owner", () => {
    const empty = inputs
      .map(decidePlanChange)
      .filter((d) => d.kind === "blocked" && d.message.trim() === "");
    expect(empty).toEqual([]);
  });
});
