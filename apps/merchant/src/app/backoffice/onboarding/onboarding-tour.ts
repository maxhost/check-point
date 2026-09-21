"use client";

import { driver, type DriveStep } from "driver.js";
import {
  recordOnboardingTour,
  type OnboardingTourId,
  type OnboardingTourStatus,
} from "./onboarding-api";

export type OnboardingTourOptions = {
  tourId: OnboardingTourId;
  steps: DriveStep[];
  onSaved?: (status: OnboardingTourStatus) => void;
  onSaveError?: () => void;
};

/**
 * Starts a screen-local tour. Selectors and copy belong in the calling screen;
 * only the resulting state crosses the API boundary.
 */
export function startOnboardingTour({
  tourId,
  steps,
  onSaved,
  onSaveError,
}: OnboardingTourOptions) {
  let outcome: OnboardingTourStatus | null = null;

  const save = (status: OnboardingTourStatus) => {
    if (outcome) return;
    outcome = status;
    void recordOnboardingTour(tourId, status)
      .then(() => onSaved?.(status))
      .catch(() => onSaveError?.());
  };

  const tour = driver({
    steps,
    animate: true,
    smoothScroll: true,
    showProgress: true,
    progressText: "{{current}} de {{total}}",
    nextBtnText: "Siguiente",
    prevBtnText: "Anterior",
    doneBtnText: "Listo",
    onDoneClick: () => {
      save("completed");
      tour.destroy();
    },
    onDestroyStarted: () => {
      save("skipped");
      tour.destroy();
    },
  });

  tour.drive();
  return tour;
}
