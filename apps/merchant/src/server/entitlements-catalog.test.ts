import { describe, expect, it } from "vitest";

import {
  BASE_TEMPLATE_KEYS,
  ENTITLEMENTS,
  KNOWN_PLANS,
  PAID_PLANS,
  can,
  effectivePlan,
  flagForPlan,
  limitForPlan,
  limitOf,
  type EntitlementContext,
} from "@mi-pasaporte/domain/server/entitlements/index";

/**
 * Spec 0189 §D2 / T3 — EL CATÁLOGO DE PLANES Y EL PLAN EFECTIVO.
 *
 * Las expectativas se transcriben a mano (`1`, `3`, `true`, `false`) y NO se derivan del
 * catálogo: un test que leyera `ENTITLEMENTS[...].byPlan.base` para aseverar el tope del base
 * pasaría con CUALQUIER valor.
 */

const NOW = new Date("2026-10-10T12:00:00.000Z");
const FUTURE = new Date(NOW.getTime() + 86_400_000);
const PAST = new Date(NOW.getTime() - 86_400_000);

/** La tabla de §D2, fila por fila: clave → [trial, base, plus, none, fallback]. */
const TABLE: Array<[string, [unknown, unknown, unknown, unknown, unknown]]> = [
  ["locations.max", [3, 1, 3, 1, 1]],
  ["campaigns.enabled", [true, false, true, false, false]],
  ["campaigns.welcome", [true, true, true, false, false]],
  ["campaigns.cross", [true, true, true, false, false]],
  ["catalog.imports.analyses", [100, 100, 100, 100, 100]],
  ["catalog.imports.attempts", [100, 100, 100, 100, 100]],
];

const PLANS = ["trial", "base", "plus", "none"] as const;

function valueOf(key: string, plan: string | null): unknown {
  const def = ENTITLEMENTS[key as keyof typeof ENTITLEMENTS];
  return def.kind === "limit"
    ? limitForPlan(plan, key as "locations.max")
    : flagForPlan(plan, key as "campaigns.enabled");
}

describe("catálogo — cada plan × cada clave de la tabla de §D2", () => {
  it.each(TABLE)("%s", (key, expected) => {
    PLANS.forEach((plan, i) => {
      expect(valueOf(key, plan), `${key} × ${plan}`).toBe(expected[i]);
    });
    // Un plan DESCONOCIDO y un plan nulo caen al `fallback`.
    expect(valueOf(key, "enterprise"), `${key} × desconocido`).toBe(
      expected[4],
    );
    expect(valueOf(key, null), `${key} × null`).toBe(expected[4]);
  });

  it("la tabla cubre TODAS las claves del catálogo y todos los planes conocidos", () => {
    expect(Object.keys(ENTITLEMENTS).sort()).toEqual(
      TABLE.map(([key]) => key).sort(),
    );
    expect([...KNOWN_PLANS]).toEqual([...PLANS]);
  });

  it("los planes pagos son `base` y `plus`", () => {
    expect([...PAID_PLANS].sort()).toEqual(["base", "plus"]);
  });

  it("las plantillas del base salen del catálogo: Bienvenida y Venta cruzada", () => {
    expect([...BASE_TEMPLATE_KEYS].sort()).toEqual(["cross", "welcome"]);
  });
});

function ctx(over: Partial<EntitlementContext>): EntitlementContext {
  return {
    plan: "trial",
    status: "active",
    stripeSubscriptionId: null,
    trialEndsAt: FUTURE,
    now: NOW,
    ...over,
  };
}

describe("effectivePlan — el acceso decide el plan efectivo", () => {
  it("`subscribed` → el plan pago de la fila", () => {
    const sub = { stripeSubscriptionId: "sub_1", trialEndsAt: PAST };
    expect(effectivePlan(ctx({ ...sub, plan: "base" }))).toBe("base");
    expect(effectivePlan(ctx({ ...sub, plan: "plus" }))).toBe("plus");
    // past_due/unpaid con id cuentan como vivas (PARQUEADO #54).
    expect(
      effectivePlan(ctx({ ...sub, plan: "plus", status: "past_due" })),
    ).toBe("plus");
  });

  it("`subscribed` sobre un plan que no es pago → fallback (`null`)", () => {
    const sub = { stripeSubscriptionId: "sub_1", trialEndsAt: PAST };
    expect(effectivePlan(ctx({ ...sub, plan: "trial" }))).toBeNull();
    expect(effectivePlan(ctx({ ...sub, plan: "none" }))).toBeNull();
    expect(limitOf(ctx({ ...sub, plan: "trial" }), "locations.max")).toBe(1);
  });

  it("`trial` → `trial`, sea cual sea el plan escrito", () => {
    expect(effectivePlan(ctx({ plan: "trial" }))).toBe("trial");
    expect(effectivePlan(ctx({ plan: "none" }))).toBe("trial");
    // Una suscripción MUERTA con la prueba vigente sigue en prueba.
    expect(
      effectivePlan(
        ctx({
          plan: "plus",
          status: "canceled",
          stripeSubscriptionId: "sub_x",
        }),
      ),
    ).toBe("trial");
    expect(can(ctx({ plan: "none" }), "campaigns.enabled")).toBe(true);
    expect(limitOf(ctx({ plan: "none" }), "locations.max")).toBe(3);
  });

  it("`blocked` → `none`: sin suscripción viva y con la prueba vencida, o sin fila", () => {
    expect(effectivePlan(ctx({ trialEndsAt: PAST }))).toBe("none");
    expect(effectivePlan(ctx({ trialEndsAt: null }))).toBe("none");
    expect(effectivePlan(ctx({ plan: "plus", trialEndsAt: PAST }))).toBe(
      "none",
    );
    expect(effectivePlan(null)).toBe("none");
    expect(can(null, "campaigns.welcome")).toBe(false);
    expect(can(ctx({ trialEndsAt: PAST }), "campaigns.cross")).toBe(false);
    expect(limitOf(null, "locations.max")).toBe(1);
  });

  it("`pending_plan='none'` (cancelación programada) NO baja ningún valor", () => {
    const row = {
      ...ctx({
        plan: "plus",
        stripeSubscriptionId: "sub_1",
        trialEndsAt: PAST,
      }),
      pendingPlan: "none",
    };
    expect(limitOf(row, "locations.max")).toBe(3);
    expect(can(row, "campaigns.enabled")).toBe(true);
    expect(can(row, "campaigns.welcome")).toBe(true);
    expect(can(row, "campaigns.cross")).toBe(true);
  });
});
