"use client";

import {
  driver,
  type AllowedButtons,
  type DriveStep,
  type Popover,
  type Driver,
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
  onSaveError?: (status: OnboardingTourStatus) => void;
  persist?: boolean;
  showSkipOnFirstStep?: boolean;
  onClosed?: () => void;
  showProgress?: boolean;
  allowKeyboardControl?: boolean;
  disableActiveInteraction?: boolean;
};

export const ONBOARDING_TOUR_STARTED_EVENT =
  "checkpass:onboarding-tour-started";
export const ONBOARDING_TOUR_ENDED_EVENT = "checkpass:onboarding-tour-ended";
const cleanupTours = new WeakMap<Driver, () => void>();

/** Technical disposal must not record a user choosing to skip. */
export function disposeOnboardingTour(tour: Driver) {
  cleanupTours.get(tour)?.();
}

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
  onClosed,
  showProgress = true,
  allowKeyboardControl = true,
  disableActiveInteraction = false,
}: OnboardingTourOptions) {
  let outcome: OnboardingTourStatus | null = null;
  let disposing = false;
  let closed = false;
  const timers = new Set<number>();
  const frames = new Set<number>();
  const ended = () => {
    if (closed) return;
    closed = true;
    if (typeof window !== "undefined")
      window.dispatchEvent(new Event(ONBOARDING_TOUR_ENDED_EVENT));
    onClosed?.();
  };

  const save = (status: OnboardingTourStatus) => {
    if (outcome) return;
    outcome = status;
    if (!persist) {
      onSaved?.(status);
      return;
    }
    void recordOnboardingTour(tourId, status)
      .then(() => {
        onSaved?.(status);
        if (typeof window !== "undefined")
          window.dispatchEvent(new Event(ONBOARDING_TOUR_ENDED_EVENT));
      })
      .catch(() => onSaveError?.(status));
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
    animate:
      typeof window === "undefined" ||
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    smoothScroll: false,
    disableActiveInteraction,
    allowKeyboardControl,
    skipMissingElement: false,
    waitForElement: 60_000,
    showProgress,
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
      frames.add(
        requestAnimationFrame(() => {
          if (tour.isActive()) tour.refresh();
        }),
      );
      timers.add(
        window.setTimeout(
          () => {
            if (tour.isActive()) tour.refresh();
          },
          reduceMotion ? 0 : 350,
        ),
      );
    },
    onDoneClick: () => {
      removeTourEventListeners();
      save("completed");
      ended();
      tour.destroy();
    },
    onDestroyStarted: () => {
      removeTourEventListeners();
      if (!disposing) save("skipped");
      ended();
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
    timers.forEach((timer) => window.clearTimeout(timer));
    frames.forEach((frame) => window.cancelAnimationFrame(frame));
  }

  if (typeof window !== "undefined") {
    window.addEventListener(TOUR_REFRESH_EVENT, refreshTour);
    window.addEventListener(TOUR_ADVANCE_EVENT, advanceTour);
  }

  cleanupTours.set(tour, () => {
    disposing = true;
    removeTourEventListeners();
    ended();
    if (tour.isActive()) tour.destroy();
    cleanupTours.delete(tour);
  });
  tour.drive();
  return tour;
}
