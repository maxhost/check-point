import { describe, expect, it } from "vitest";
import type { OnboardingState } from "./contracts";
import { restoredStage } from "./onboarding-flow";

describe("restoredStage", () => {
  it.each<[OnboardingState, string]>([
    [{ authenticated: false }, "account"],
    [
      {
        authenticated: true,
        business: null,
        program: null,
        stampImage: false,
      },
      "business",
    ],
    [
      {
        authenticated: true,
        business: { id: "business-1", name: "Café Sur", slug: "cafe-sur" },
        program: null,
        stampImage: false,
      },
      "program",
    ],
    [
      {
        authenticated: true,
        business: { id: "business-1", name: "Café Sur", slug: "cafe-sur" },
        program: { id: "program-1", kind: "stamps" },
        stampImage: false,
      },
      "complete",
    ],
  ])("deriva %s sin recrear recursos", (state, expected) => {
    expect(restoredStage(state)).toBe(expected);
  });
});
