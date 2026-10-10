import { describe, expect, it } from "vitest";
import {
  campaignAllowedFor,
  type CampaignPlanRow,
} from "@mi-pasaporte/domain/server/marketing/plan-gate";

/**
 * Spec 0189 §Plan de pruebas, T4 — `campaignAllowedFor` POR PLANTILLA sobre el plan EFECTIVO:
 * `welcome`/`cross`/`valley`/`null` (propia)/otra × `trial`/`base`/`plus`/`none` vencido. El
 * oráculo es la tabla: se escribe la salida esperada de cada fila, no una regla re-derivada.
 * ORÁCULO DE M4: la columna `base` de `cross`.
 *
 * Lo que NO está acá: que el 402 salga por HTTP y que el plan se lea AL ACTIVAR (los dos
 * tienen su oráculo en `marketing-campaign-actions.neon.integration.test.ts`).
 */

const NOW = new Date("2026-10-10T12:00:00.000Z");
const FUTURE = new Date(NOW.getTime() + 86_400_000);
const PAST = new Date(NOW.getTime() - 86_400_000);

const ROWS: Record<string, CampaignPlanRow> = {
  trial: {
    plan: "trial",
    status: "active",
    stripeSubscriptionId: null,
    trialEndsAt: FUTURE,
  },
  base: {
    plan: "base",
    status: "active",
    stripeSubscriptionId: "sub_base",
    trialEndsAt: PAST,
  },
  plus: {
    plan: "plus",
    status: "active",
    stripeSubscriptionId: "sub_plus",
    trialEndsAt: PAST,
  },
  // Una suscripción que murió (plan `none`) con la prueba vencida: BLOQUEADO.
  none: {
    plan: "none",
    status: "canceled",
    stripeSubscriptionId: "sub_muerta",
    trialEndsAt: PAST,
  },
};

/** plantilla → [trial, base, plus, none vencido]. */
const TABLE: Array<[string | null, [boolean, boolean, boolean, boolean]]> = [
  ["welcome", [true, true, true, false]],
  ["cross", [true, true, true, false]],
  ["valley", [true, false, true, false]],
  [null, [true, false, true, false]],
  ["win_back", [true, false, true, false]],
  ["at_risk", [true, false, true, false]],
];

describe("campaignAllowedFor — por plantilla y por plan efectivo (T4)", () => {
  it.each(TABLE)("plantilla %s", (template, expected) => {
    (["trial", "base", "plus", "none"] as const).forEach((plan, i) => {
      expect(
        campaignAllowedFor(ROWS[plan], template, NOW),
        `${String(template)} × ${plan}`,
      ).toBe(expected[i]);
    });
  });

  it("sin fila de suscripción no hay ninguna campaña (fail-closed)", () => {
    for (const [template] of TABLE) {
      expect(campaignAllowedFor(null, template, NOW)).toBe(false);
    }
  });

  it("un `plus` cuya prueba vigente sobrevive a una suscripción muerta sigue con todo", () => {
    const row: CampaignPlanRow = {
      plan: "plus",
      status: "canceled",
      stripeSubscriptionId: "sub_muerta",
      trialEndsAt: FUTURE,
    };
    expect(campaignAllowedFor(row, "win_back", NOW)).toBe(true);
  });

  it("el reloj importa: la misma prueba deja de valer al vencer", () => {
    expect(campaignAllowedFor(ROWS.trial, "welcome", FUTURE)).toBe(false);
  });
});
