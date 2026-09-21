import type { OnboardingItem } from "./onboarding-api";

export type OnboardingStepState = "done" | "blocked" | "current" | "upcoming";

export const AVAILABLE_ONBOARDING_ANCHORS: ReadonlySet<string> = new Set([
  "verify-email",
  "staff",
]);

export function onboardingStepState(
  item: OnboardingItem,
  items: OnboardingItem[],
  availableAnchors: ReadonlySet<string> = AVAILABLE_ONBOARDING_ANCHORS,
): OnboardingStepState {
  if (item.done) return "done";
  const blockingItem = items.find(
    (candidate) =>
      candidate.required &&
      !candidate.done &&
      candidate.position < item.position,
  );
  if (blockingItem) return "blocked";
  return availableAnchors.has(item.anchor) ? "current" : "upcoming";
}
