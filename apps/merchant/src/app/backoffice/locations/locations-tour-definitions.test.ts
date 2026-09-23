import { describe, expect, it } from "vitest";
import {
  LOCATIONS_ONBOARDING_TOUR_HREF,
  locationsHelpStart,
  locationsOnboardingStart,
  locationsTourSteps,
  wantsLocationsOnboardingTour,
} from "./locations-tour-definitions";

describe("tours de Locales", () => {
  it("ofrece las cuatro ayudas sin persistir onboarding", () => {
    for (const id of ["limit", "create", "edit", "archive"] as const) {
      expect(locationsHelpStart(id).persist).toBe(false);
      expect(locationsTourSteps(id).length).toBeGreaterThan(0);
    }
  });

  it("el alta abre el modal antes de enseñar sus campos", () => {
    expect(locationsTourSteps("create").map((step) => step.element)).toEqual([
      '[data-tour="locations-add"]',
      '[data-tour="location-name"]',
      '[data-tour="location-address"]',
      '[data-tour="location-manual-address"]',
      '[data-tour="location-save"]',
    ]);
    expect(locationsTourSteps("create")[0]?.advanceOnClick).toBe(true);
    expect(locationsTourSteps("create")[3]?.advanceOnClick).toBe(false);
    expect(locationsTourSteps("create")[4]?.advanceOnClick).toBe(true);
  });

  it("la edición enseña la alternativa manual antes de guardar", () => {
    expect(locationsTourSteps("edit").map((step) => step.element)).toEqual([
      '[data-tour="location-edit"]',
      '[data-tour="location-name"]',
      '[data-tour="location-address"]',
      '[data-tour="location-manual-address"]',
      '[data-tour="location-save"]',
    ]);
    expect(locationsTourSteps("edit")[3]?.advanceOnClick).toBe(false);
    expect(locationsTourSteps("edit")[4]?.advanceOnClick).toBe(true);
    expect(locationsTourSteps("edit")[4]?.popover?.title).toBe(
      "Guardá los cambios",
    );
  });

  it("el onboarding recorre el alta completa en seis pasos", () => {
    expect(
      locationsOnboardingStart(true).steps.map((step) => step.element),
    ).toEqual([
      '[data-tour="locations-limit"]',
      '[data-tour="locations-add"]',
      '[data-tour="location-name"]',
      '[data-tour="location-address"]',
      '[data-tour="location-manual-address"]',
      '[data-tour="location-save"]',
    ]);
  });

  it("los botones de acción adelantan automáticamente", () => {
    const steps = locationsOnboardingStart(true).steps;
    expect(steps[1]?.advanceOnClick).toBe(true);
    expect(steps[5]?.advanceOnClick).toBe(true);
    expect(steps[2]?.advanceOnClick).toBe(false);
    expect(steps[3]?.advanceOnClick).toBe(false);
    expect(steps[4]?.advanceOnClick).toBe(false);
  });

  it("si no hay cupo explica el límite sin apuntar a controles ausentes", () => {
    expect(
      locationsOnboardingStart(false).steps.map((step) => step.element),
    ).toEqual(['[data-tour="locations-limit"]']);
  });

  it("el onboarding persiste y comparte su URL con el checklist", () => {
    const start = locationsOnboardingStart(true);
    expect(start.tourId).toBe("locations");
    expect(start.showSkipOnFirstStep).toBe(true);
    expect(start.persist).toBeUndefined();
    expect(
      wantsLocationsOnboardingTour(
        new URL(LOCATIONS_ONBOARDING_TOUR_HREF, "http://local").search,
      ),
    ).toBe(true);
  });
});
