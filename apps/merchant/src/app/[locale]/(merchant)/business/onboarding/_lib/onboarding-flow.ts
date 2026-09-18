import type { OnboardingState } from "./contracts";

export type RestoredStage = "account" | "business" | "program" | "complete";

export function restoredStage(state: OnboardingState): RestoredStage {
  if (!state.authenticated) return "account";
  if (!state.business) return "business";
  if (!state.program) return "program";
  return "complete";
}
