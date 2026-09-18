import { describe, expect, it } from "vitest";

import {
  ENTITLEMENTS,
  KNOWN_PLANS,
  PAID_PLANS,
  can,
  limitOf,
  type EntitlementContext,
} from "./entitlements";

/**
 * Spec 0072 §D2 — LA CAPA DE ENTITLEMENTS.
 *
 * Las expectativas se transcriben a mano (`1`, `3`, `true`, `false`) y NO se derivan del
 * catálogo: un test que leyera `ENTITLEMENTS["locations.max"].byPlan.free` para aseverar
 * el tope de `free` pasaría con CUALQUIER valor, que es exactamente la copia muerta que la
 * mutación M7 existe para descartar.
 */

/** La fila de `core.subscription` de un negocio con suscripción VIVA en ese plan. */
function live(
  plan: string,
  pendingPlan: string | null = null,
): EntitlementContext {
  return {
    plan,
    pendingPlan,
    status: "active",
    stripeSubscriptionId: "sub_live",
  };
}

describe("entitlements — limitOf sobre `locations.max`", () => {
  it("lee el tope declarado de cada plan conocido", () => {
    expect(limitOf({ plan: "free" }, "locations.max")).toBe(1);
    expect(limitOf({ plan: "plus" }, "locations.max")).toBe(3);
    expect(limitOf({ plan: "none" }, "locations.max")).toBe(1);
  });

  it("un `pending_plan` VACÍO no es una baja programada ([R1-N8])", () => {
    expect(limitOf({ plan: "plus", pendingPlan: "" }, "locations.max")).toBe(3);
    expect(limitOf({ plan: "plus", pendingPlan: null }, "locations.max")).toBe(
      3,
    );
    expect(
      limitOf({ plan: "plus", pendingPlan: undefined }, "locations.max"),
    ).toBe(3);
  });

  it("con baja programada el tope efectivo es el MENOR de los dos", () => {
    expect(
      limitOf({ plan: "plus", pendingPlan: "free" }, "locations.max"),
    ).toBe(1);
    // Y un upgrade programado NO sube el tope antes de que el pago esté confirmado.
    expect(
      limitOf({ plan: "free", pendingPlan: "plus" }, "locations.max"),
    ).toBe(1);
  });

  it("un plan DESCONOCIDO cae al fallback, vigente o pendiente", () => {
    expect(limitOf({ plan: "enterprise" }, "locations.max")).toBe(1);
    expect(limitOf({ plan: null }, "locations.max")).toBe(1);
    expect(
      limitOf({ plan: "plus", pendingPlan: "enterprise" }, "locations.max"),
    ).toBe(1);
  });

  it("NO exige suscripción viva: un `plus` forma A1 conserva sus 3 locales", () => {
    // La asimetría del ADR 0073 §2, medida: misma fila que abajo pierde las campañas.
    expect(
      limitOf(
        {
          plan: "plus",
          pendingPlan: null,
          status: "active",
          stripeSubscriptionId: null,
        },
        "locations.max",
      ),
    ).toBe(3);
  });
});

describe("entitlements — can sobre `campaigns.enabled`", () => {
  it("sólo `plus` con suscripción viva compone campañas", () => {
    expect(can(live("plus"), "campaigns.enabled")).toBe(true);
    expect(can(live("free"), "campaigns.enabled")).toBe(false);
    expect(can(live("none"), "campaigns.enabled")).toBe(false);
    expect(can(live("enterprise"), "campaigns.enabled")).toBe(false);
  });

  it("una baja programada apaga las campañas; un `pending_plan` vacío no", () => {
    expect(can(live("plus", "free"), "campaigns.enabled")).toBe(false);
    expect(can(live("plus", ""), "campaigns.enabled")).toBe(true);
    expect(can(live("plus", "plus"), "campaigns.enabled")).toBe(true);
  });

  it("sin suscripción viva no hay campañas (forma A1 y suscripción muerta)", () => {
    expect(
      can(
        {
          plan: "plus",
          pendingPlan: null,
          status: "active",
          stripeSubscriptionId: null,
        },
        "campaigns.enabled",
      ),
    ).toBe(false);
    expect(
      can(
        {
          plan: "plus",
          pendingPlan: null,
          status: "canceled",
          stripeSubscriptionId: "sub_dead",
        },
        "campaigns.enabled",
      ),
    ).toBe(false);
    // Fail-closed: un contexto SIN los campos de suscripción no otorga la bandera.
    expect(can({ plan: "plus" }, "campaigns.enabled")).toBe(false);
  });
});

describe("entitlements — el catálogo declara TODOS los planes conocidos (§D2.3)", () => {
  it("cada entrada tiene fila explícita para cada plan, del tipo de su `kind`", () => {
    // Piso de barrido: si el catálogo o la lista de planes se vacían, esto se pone rojo
    // antes que los `hasOwnProperty` de abajo (que sobre un objeto vacío no corren nunca).
    const keys = Object.keys(ENTITLEMENTS);
    expect(keys.length).toBeGreaterThanOrEqual(2);
    expect(KNOWN_PLANS.length).toBeGreaterThanOrEqual(3);

    for (const [key, def] of Object.entries(ENTITLEMENTS)) {
      const byPlan: Record<string, unknown> = def.byPlan;
      for (const plan of KNOWN_PLANS) {
        expect(
          Object.prototype.hasOwnProperty.call(byPlan, plan),
          `${key} no declara el plan ${plan}`,
        ).toBe(true);
        expect(typeof byPlan[plan], `${key}.${plan}`).toBe(
          def.kind === "limit" ? "number" : "boolean",
        );
      }
      expect(typeof def.fallback, `${key}.fallback`).toBe(
        def.kind === "limit" ? "number" : "boolean",
      );
    }
  });

  it("los planes pagos salen del catálogo y `plus` es el único", () => {
    expect(PAID_PLANS.has("plus")).toBe(true);
    expect(PAID_PLANS.has("free")).toBe(false);
    expect(PAID_PLANS.has("none")).toBe(false);
  });
});
