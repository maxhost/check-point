import { describe, expect, it } from "vitest";
import {
  FIRST_STAFF_PERMISSION_ANCHOR,
  STAFF_ONBOARDING_TOUR_HREF,
  staffHelpStart,
  staffOnboardingStart,
  staffTourSteps,
  wantsStaffOnboardingTour,
} from "./staff-tour-definitions";

describe("tours de Staff", () => {
  it("mantiene el onboarding corto y separado de las ayudas operativas", () => {
    expect(staffTourSteps("onboarding")).toHaveLength(2);
    expect(staffTourSteps("onboarding").map((step) => step.element)).toEqual([
      '[data-tour="staff-add"]',
      '[data-tour="staff-members"]',
    ]);
    expect(staffTourSteps("edit-permissions")).toHaveLength(4);
  });
  it("enseña Mostrador como primer permiso", () => {
    expect(FIRST_STAFF_PERMISSION_ANCHOR).toBe(
      '[data-tour="staff-permission-counter"]',
    );
    expect(staffTourSteps("create")[2]?.element).toBe(
      FIRST_STAFF_PERMISSION_ANCHOR,
    );
  });

  it("avanza al pulsar acciones reales, pero no al escribir ni en la orientación", () => {
    const create = staffTourSteps("create");
    expect(create[0]?.advanceOnClick).toBe(true);
    expect(create[1]?.advanceOnClick).toBe(false);
    expect(create[3]?.advanceOnClick).toBe(true);
    expect(staffTourSteps("onboarding")[0]?.advanceOnClick).toBe(false);
  });

  /**
   * ORACULO DE LA ENMIENDA §11 (el defecto que cazo el revisor de la 0088).
   *
   * El switch de Mostrador nace ENCENDIDO en el alta, asi que si este paso autoavanzara al
   * pulsarlo, seguir el tour al pie de la letra APAGA el unico permiso puesto y el alta se
   * corta. El paso es informativo: avanza con «Siguiente».
   */
  it("no autoavanza en el paso de Mostrador: pulsarlo lo APAGARIA", () => {
    expect(staffTourSteps("create")[2]?.element).toBe(
      FIRST_STAFF_PERMISSION_ANCHOR,
    );
    expect(staffTourSteps("create")[2]?.advanceOnClick).toBe(false);
  });

  /**
   * ORACULOS DE LOS HALLAZGOS H2-bis (el `persist` de las ayudas) Y H3-bis (el arranque por
   * query) DE LA REVISION DE LA 0088. Los dos vivian en el `.tsx` y la revision midio que
   * romperlos no ponia rojo a nadie.
   */
  it("ninguna ayuda persiste progreso del onboarding", () => {
    for (const id of [
      "create",
      "edit-permissions",
      "regenerate-pin",
      "disable",
    ] as const) {
      expect(staffHelpStart(id).persist).toBe(false);
    }
  });

  it("la orientación sí persiste y ofrece saltar desde el primer paso", () => {
    const start = staffOnboardingStart();
    expect(start.persist).toBeUndefined();
    expect(start.showSkipOnFirstStep).toBe(true);
    expect(start.tourId).toBe("staff");
  });

  it("el href que empuja el checklist es el que esta pantalla parsea", () => {
    const { search } = new URL(STAFF_ONBOARDING_TOUR_HREF, "http://local");
    expect(wantsStaffOnboardingTour(search)).toBe(true);
  });

  it("no arranca con otra query, ni sin query", () => {
    expect(wantsStaffOnboardingTour("")).toBe(false);
    expect(wantsStaffOnboardingTour("?tour=create")).toBe(false);
    expect(wantsStaffOnboardingTour("?otro=onboarding")).toBe(false);
  });
});
