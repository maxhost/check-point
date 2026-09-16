import { describe, expect, it } from "vitest";
import {
  buildCampaignResults,
  estimateEffect,
  MIN_HOLDOUT_FOR_ESTIMATE,
  WINDOW_PURCHASES_TITLE,
  type ResultsFacts,
  type WindowFacts,
} from "./results";

const window = (over: Partial<WindowFacts> = {}): WindowFacts => ({
  placedN: 100,
  placedPurchases: 40,
  holdoutN: 50,
  holdoutPurchases: 10,
  ...over,
});

const facts = (over: Partial<ResultsFacts> = {}): ResultsFacts => ({
  audience: null,
  turns: { queued: 1, active: 2, done: 3, cancelled: 4, held: 7 },
  window: window(),
  coupon: { label: "2x1", cap: 50, redeemed: 3, incurredCost: "9.00" },
  byLocation: [],
  passReach: { inPass: 4, members: 10 },
  ...over,
});

/**
 * The gate of the effect estimate (spec 0065). This is where the DoD item «la estimación
 * está oculta con `B < 30` y muestra el valor correcto con `B ≥ 30`» is closed: the rule
 * is arithmetic over four counts, so a pure table says exactly what a seeded database
 * would, and says it for the boundary — which no realistic fixture reaches.
 *
 * ALCANCE DECLARADO: that the four counts arrive from the right rows is
 * `marketing-results.neon.integration.test.ts`; that the screen HIDES the line is the
 * render test of phase B3. This file pins neither.
 */
describe("estimateEffect — the holdout gate", () => {
  it(`stays unavailable one holdout below the floor (${MIN_HOLDOUT_FOR_ESTIMATE})`, () => {
    expect(
      estimateEffect(window({ holdoutN: MIN_HOLDOUT_FOR_ESTIMATE - 1 })),
    ).toEqual({
      quality: "no_disponible",
      holdoutN: MIN_HOLDOUT_FOR_ESTIMATE - 1,
      needed: MIN_HOLDOUT_FOR_ESTIMATE,
    });
  });

  it("appears exactly AT the floor, never one turn later", () => {
    // 40/100 − 10/50 = 0.2 → 0.2 × 100. The boundary is the whole point: «≥ 30» and
    // «> 30» read the same in prose and differ by one campaign's worth of waiting.
    const result = estimateEffect(
      window({ holdoutN: MIN_HOLDOUT_FOR_ESTIMATE, holdoutPurchases: 6 }),
    );
    expect(result.quality).toBe("estimada");
    expect(result).toEqual({ quality: "estimada", extraCustomers: 20 });
  });

  it("a placed group that bought LESS than the control reports a negative effect", () => {
    // 10/100 − 20/50 = −0.3 → −30. Clamping this to zero would hide the only case in
    // which the owner should turn the campaign off. It is ALSO the case that measured
    // the IEEE noise: unrounded this expression returns −30.000000000000004.
    expect(
      estimateEffect(
        window({ placedPurchases: 10, holdoutPurchases: 20, holdoutN: 50 }),
      ),
    ).toEqual({ quality: "estimada", extraCustomers: -30 });
  });

  it("no placed turns is 0 extra customers, never NaN", () => {
    // `0/0` would poison the number all the way to the screen as «NaN clientes».
    const result = estimateEffect(window({ placedN: 0, placedPurchases: 0 }));
    expect(result).toEqual({ quality: "estimada", extraCustomers: -0 });
    // −0 and 0 are `Object.is`-distinct but `toEqual`-equal; what matters is that no
    // division by zero leaked through.
    expect(
      Number.isNaN((result as { extraCustomers: number }).extraCustomers),
    ).toBe(false);
  });
});

describe("buildCampaignResults — every block carries its quality (ADR 0021)", () => {
  it("the purchases title never claims causation", () => {
    expect(WINDOW_PURCHASES_TITLE).toBe("Compraron durante su ventana");
    expect(buildCampaignResults(facts()).windowPurchases.title).toBe(
      WINDOW_PURCHASES_TITLE,
    );
  });

  it("the coupon money is `estimado_configurado`, the counts are `observada`", () => {
    const built = buildCampaignResults(facts());
    expect(built.coupon.quality).toBe("estimado_configurado");
    expect(built.audience.quality).toBe("observada");
    expect(built.turns.quality).toBe("observada");
    expect(built.windowPurchases.quality).toBe("observada");
    expect(built.byLocation.quality).toBe("observada");
    expect(built.passReach.quality).toBe("observada");
  });

  it("`held` turns and the holdouts of the rate are DIFFERENT numbers", () => {
    // 7 withheld turns exist; only the 50 already `done` can be part of a rate. A build
    // that reused one for the other would look right on every fixture where the campaign
    // has already finished, and be wrong on every live one.
    const built = buildCampaignResults(facts());
    expect(built.turns.held).toBe(7);
    expect(built.windowPurchases.held.of).toBe(50);
  });

  it("no tick yet is a null photo, not a row of zeros", () => {
    // Zeros would read as «nadie calificó»; null is «todavía no se midió».
    expect(buildCampaignResults(facts()).audience.photo).toBeNull();
  });
});
