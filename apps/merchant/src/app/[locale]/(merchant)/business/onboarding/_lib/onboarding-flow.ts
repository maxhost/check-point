import type { OnboardingState } from "./contracts";

export function restoredStage(state: OnboardingState): "business" | "panel" {
  return state.authenticated ? "panel" : "business";
}
