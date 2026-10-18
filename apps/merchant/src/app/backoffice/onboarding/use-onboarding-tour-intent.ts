"use client";
import { useCallback } from "react";
import { useOptionalBackofficeContext } from "../backoffice-context";
import type { OnboardingTourId } from "./onboarding-api";
import { captureOnboardingTourIntent } from "./onboarding-tour-persistence";

/** Missing/retired context cannot start a persistent intention; local help still works. */
export function useOnboardingTourIntent() {
  const context = useOptionalBackofficeContext();
  const captureTicket = context?.captureTicket;
  const invalidate = context?.invalidate;
  const retire = context?.retire;
  return useCallback(
    (tourId: OnboardingTourId) =>
      captureOnboardingTourIntent(
        tourId,
        captureTicket && invalidate && retire
          ? { captureTicket, invalidate, retire }
          : null,
      ),
    [captureTicket, invalidate, retire],
  );
}
