import { describe, expect, it } from "vitest";
import {
  COMPOSER_ENABLED,
  ENABLED_TEMPLATE_KEYS,
  PROXIMITY_PLACEMENT_ENABLED,
  campaignKindEnabled,
} from "@mi-pasaporte/domain/server/marketing/enabled-campaigns";
import { TEMPLATES } from "@mi-pasaporte/domain/server/marketing/templates";

/**
 * Spec 0138 §1 — el módulo que decide lo encendido (ADR 0115). Vive acá y no al lado del
 * módulo porque `packages/domain` no tiene proyecto de vitest: un `.test.ts` ahí no corre.
 */
describe("enabled-campaigns (ADR 0115)", () => {
  it("solo Bienvenida y Venta cruzada están encendidas, en el orden del catálogo", () => {
    expect(ENABLED_TEMPLATE_KEYS).toEqual(["welcome", "cross"]);
    expect(campaignKindEnabled("welcome")).toBe(true);
    expect(campaignKindEnabled("cross")).toBe(true);
  });

  it("las otras seis claves del catálogo están apagadas", () => {
    const off = TEMPLATES.map((t) => t.key).filter(
      (key) => key !== "welcome" && key !== "cross",
    );
    expect(off).toEqual([
      "missed_you",
      "at_risk",
      "win_back",
      "near_reward",
      "unclaimed_reward",
      "valley",
    ]);
    for (const key of off) expect(campaignKindEnabled(key)).toBe(false);
  });

  it("el compositor (`null`) y una clave desconocida están apagados", () => {
    expect(COMPOSER_ENABLED).toBe(false);
    expect(campaignKindEnabled(null)).toBe(false);
    expect(campaignKindEnabled("nope")).toBe(false);
  });

  it("el paso 4 (proximidad) no corre", () => {
    expect(PROXIMITY_PLACEMENT_ENABLED).toBe(false);
  });
});
