import { describe, expect, it } from "vitest";
import {
  ANALYTICS_POLICY,
  createAnalyticsPolicy,
  policyText,
  policyWindows,
  validatePolicy,
  ANALYTICS_RULE_DEFINITIONS,
} from "@mi-pasaporte/domain/analytics/policy/index";
import type { AnalyticsPolicyConfig } from "@mi-pasaporte/domain/analytics/policy/index";
const copy = (): AnalyticsPolicyConfig => structuredClone(ANALYTICS_POLICY);
describe("versioned analytics policy foundation", () => {
  it("validates one immutable complete snapshot and keeps card11 parked", () => {
    expect(() =>
      validatePolicy(ANALYTICS_POLICY, ANALYTICS_RULE_DEFINITIONS),
    ).not.toThrow();
    expect(Object.isFrozen(ANALYTICS_POLICY)).toBe(true);
    expect(Object.isFrozen(ANALYTICS_POLICY.rules[0].parameters)).toBe(true);
    expect(ANALYTICS_POLICY.rules.find((r) => r.id === "11")).toMatchObject({
      enabled: false,
      category: "marketing",
    });
    expect(ANALYTICS_POLICY.categories.informational).toEqual([
      "seen",
      "ignore",
    ]);
    expect(ANALYTICS_POLICY.snooze.noveltyOnDue).toBe("reset");
  });
  it("versions the entire configuration deterministically without changing its input", () => {
    const config = copy();
    expect(createAnalyticsPolicy(config).version).toBe(
      ANALYTICS_POLICY.version,
    );
    const old = createAnalyticsPolicy(config).version;
    expect(createAnalyticsPolicy(config).version).toBe(old);
    config.weights.minimum *= 2;
    expect(createAnalyticsPolicy(config).version).not.toBe(old);
    expect(Object.isFrozen(config)).toBe(false);
    const action = copy();
    action.rules.find((r) => r.id === "8")!.actionKey = "edit_product_price";
    expect(() => createAnalyticsPolicy(action)).not.toThrow();
    expect(createAnalyticsPolicy(action).version).not.toBe(
      ANALYTICS_POLICY.version,
    );
  });
  it("derives SQL requirements from enabled rules rather than a copied 28-day bound", () => {
    const config = copy();
    (
      config.rules.find((r) => r.id === "8")!.parameters as Record<
        string,
        number
      >
    ).consumptionDays = 70;
    expect(policyWindows(createAnalyticsPolicy(config)).recentDays).toBe(70);
    config.rules.find((r) => r.id === "8")!.enabled = false;
    expect(
      policyWindows(createAnalyticsPolicy(config)).recentDays,
    ).toBeLessThan(70);
  });
  it("rejects invalid values/references/category decisions and accidental Marketing activation atomically", () => {
    const invalid: ((c: AnalyticsPolicyConfig) => void)[] = [
      (c) => {
        c.lifetime.days = Infinity;
      },
      (c) => {
        c.weights.maximumCards = NaN;
      },
      (c) => {
        c.weights.noveltyDecay = -1;
      },
      (c) => {
        Object.assign(c.categories, { informational: ["snooze"] });
      },
      (c) => {
        c.rules.find((r) => r.id === "11")!.enabled = true;
      },
      (c) => {
        c.rules[0].actionKey = "not_registered";
      },
      (c) => {
        c.rules[0].handler = "not_registered" as never;
      },
      (c) => {
        (
          c.rules.find((r) => r.id === "8")!.parameters as Record<
            string,
            number
          >
        ).criticalDays = 100;
      },
    ];
    for (const change of invalid) {
      const config = copy();
      change(config);
      expect(() => createAnalyticsPolicy(config)).toThrow("Política inválida");
    }
    expect(ANALYTICS_POLICY.lifetime.days).toBe(90);
  });
  it("renders only declared text fields and reports missing fields", () => {
    expect(
      policyText(ANALYTICS_POLICY, "periodDay", { from: "2026-10-17" }),
    ).toContain("2026-10-17");
    expect(() => policyText(ANALYTICS_POLICY, "periodDay")).toThrow(
      "Falta el campo",
    );
    expect(() => policyText(ANALYTICS_POLICY, "not_registered")).toThrow(
      "Texto no registrado",
    );
  });
});
