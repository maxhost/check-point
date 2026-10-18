import type {
  BackofficeResource,
  BackofficeResourceTicket,
} from "../backoffice-context-state";
import { isBackofficeContextChanged } from "../backoffice-scope-request";
import {
  recordOnboardingTour,
  type OnboardingTourId,
  type OnboardingTourStatus,
} from "./onboarding-api";

type TourContext = {
  captureTicket: (
    resource: BackofficeResource,
  ) => BackofficeResourceTicket | null;
  invalidate: (resources: readonly BackofficeResource[]) => void;
  retire: () => void;
};
/** One explicit intention, captured before RAF/driver start; a retry captures another one. */
export function captureOnboardingTourIntent(
  tourId: OnboardingTourId,
  context: TourContext | null,
) {
  const ticket = context?.captureTicket("checklist");
  if (!ticket || !context) return null;
  const { scopeKey, epoch } = ticket; // Values, never a live ticket/getter retagged after await.
  let used = false;
  const isCurrent = () => {
    const current = context.captureTicket("checklist");
    // A checklist read/focus invalidation must not cancel a user's tour intention.
    return current?.scopeKey === scopeKey && current.epoch === epoch;
  };
  return {
    isCurrent,
    persistProgress: async (status: OnboardingTourStatus): Promise<boolean> => {
      if (used || !isCurrent()) return false;
      used = true;
      context.invalidate(["checklist"]);
      try {
        await recordOnboardingTour(tourId, status, { scopeKey });
        return isCurrent();
      } catch (error) {
        if (!isCurrent()) return false;
        if (isBackofficeContextChanged(error)) {
          context.retire();
          return false;
        }
        throw error;
      }
    },
  };
}
