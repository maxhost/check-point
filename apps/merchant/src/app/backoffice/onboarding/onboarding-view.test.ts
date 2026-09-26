import { describe, expect, it } from "vitest";
import type { OnboardingItem } from "./onboarding-api";
import { onboardingStepState } from "./onboarding-view";

const item = (
  id: string,
  position: number,
  required: boolean,
  done = false,
): OnboardingItem => ({
  id,
  anchor: id,
  position,
  required,
  done,
  title: id,
  body: id,
});

describe("estados visuales del checklist", () => {
  it("el email pendiente es actual y bloquea los pasos posteriores", () => {
    const items = [item("verify-email", 1, true), item("catalog", 2, false)];

    expect(onboardingStepState(items[0], items)).toBe("current");
    expect(onboardingStepState(items[1], items)).toBe("blocked");
  });

  it("un paso hecho siempre queda completado", () => {
    const email = item("verify-email", 1, true, true);
    expect(onboardingStepState(email, [email])).toBe("done");
  });

  it("un tour sin UI publicada queda como próximo después del email", () => {
    const items = [
      item("verify-email", 1, true, true),
      item("program", 2, false),
    ];
    expect(onboardingStepState(items[1], items)).toBe("upcoming");
  });

  it("un tour publicado pasa a ser accionable", () => {
    const items = [
      item("verify-email", 1, true, true),
      item("catalog", 2, false),
    ];
    expect(onboardingStepState(items[1], items, new Set(["catalog"]))).toBe(
      "current",
    );
  });

  it("staff está publicado para el checklist real", () => {
    const items = [
      item("verify-email", 1, true, true),
      item("staff", 2, false),
    ];
    expect(onboardingStepState(items[1], items)).toBe("current");
  });

  it("locales está publicado para el checklist real", () => {
    const items = [
      item("verify-email", 1, true, true),
      item("locations", 2, false),
    ];
    expect(onboardingStepState(items[1], items)).toBe("current");
  });
  it("catálogo está publicado para el checklist real", () => {
    const items = [
      item("verify-email", 1, true, true),
      item("catalog", 2, false),
    ];
    expect(onboardingStepState(items[1], items)).toBe("current");
  });
});
