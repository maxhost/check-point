"use client";

import {
  driver,
  type AllowedButtons,
  type DriveStep,
  type Popover,
} from "driver.js";
import {
  recordOnboardingTour,
  type OnboardingTourId,
  type OnboardingTourStatus,
} from "./onboarding-api";
import {
  TOUR_ADVANCE_EVENT,
  TOUR_REFRESH_EVENT,
  type TourAdvanceDetail,
} from "../../components/tour-events";

export type OnboardingTourOptions = {
  tourId: OnboardingTourId;
  steps: DriveStep[];
  onSaved?: (status: OnboardingTourStatus) => void;
  onSaveError?: () => void;
  persist?: boolean;
  showSkipOnFirstStep?: boolean;
};

export const ONBOARDING_TOUR_STARTED_EVENT =
  "checkpass:onboarding-tour-started";

/**
 * Starts a screen-local tour. Selectors and copy belong in the calling screen;
 * only the resulting state crosses the API boundary.
 */
export function startOnboardingTour({
  tourId,
  steps,
  onSaved,
  onSaveError,
  persist = true,
  showSkipOnFirstStep = false,
}: OnboardingTourOptions) {
  let outcome: OnboardingTourStatus | null = null;

  const save = (status: OnboardingTourStatus) => {
    if (outcome) return;
    outcome = status;
    if (!persist) {
      onSaved?.(status);
      return;
    }
    void recordOnboardingTour(tourId, status)
      .then(() => onSaved?.(status))
      .catch(() => onSaveError?.());
  };

  const tourSteps: DriveStep[] = showSkipOnFirstStep
    ? steps.map((step, index) =>
        index === 0
          ? {
              ...step,
              popover: {
                ...step.popover,
                showButtons: ["next", "close"] as AllowedButtons[],
                onPopoverRender: ((popover, options) => {
                  popover.closeButton.textContent = "Saltar";
                  popover.closeButton.setAttribute("aria-label", "Saltar tour");
                  popover.wrapper.classList.add("driver-popover-has-skip");
                  step.popover?.onPopoverRender?.(popover, options);
                }) satisfies NonNullable<Popover["onPopoverRender"]>,
              },
            }
          : step,
      )
    : steps;

  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(ONBOARDING_TOUR_STARTED_EVENT));
  const tour = driver({
    steps: tourSteps,
    animate: true,
    smoothScroll: true,
    disableActiveInteraction: false,
    skipMissingElement: false,
    waitForElement: 60_000,
    showProgress: true,
    progressText: "{{current}} de {{total}}",
    nextBtnText: "Siguiente",
    prevBtnText: "Anterior",
    doneBtnText: "Listo",
    onHighlighted: (element) => {
      if (!element) return;
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      element.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "center",
        inline: "nearest",
      });
      requestAnimationFrame(() => {
        if (tour.isActive()) tour.refresh();
      });
      window.setTimeout(
        () => {
          if (tour.isActive()) tour.refresh();
        },
        reduceMotion ? 0 : 350,
      );
    },
    onDoneClick: () => {
      removeTourEventListeners();
      save("completed");
      tour.destroy();
    },
    onDestroyStarted: () => {
      removeTourEventListeners();
      save("skipped");
      tour.destroy();
    },
  });

  const refreshTour = () => {
    if (tour.isActive()) tour.refresh();
  };
  const advanceTour = (event: Event) => {
    const requestedElement = (event as CustomEvent<TourAdvanceDetail>).detail
      ?.element;
    if (
      requestedElement &&
      tour.isActive() &&
      tour.getActiveStep()?.element === requestedElement
    ) {
      tour.moveNext();
    }
  };
  function removeTourEventListeners() {
    if (typeof window === "undefined") return;
    window.removeEventListener(TOUR_REFRESH_EVENT, refreshTour);
    window.removeEventListener(TOUR_ADVANCE_EVENT, advanceTour);
  }

  if (typeof window !== "undefined") {
    window.addEventListener(TOUR_REFRESH_EVENT, refreshTour);
    window.addEventListener(TOUR_ADVANCE_EVENT, advanceTour);
  }

  tour.drive();
  return tour;
}
