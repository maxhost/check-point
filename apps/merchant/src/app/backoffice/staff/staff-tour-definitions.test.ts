import { describe, expect, it } from "vitest";
import {
  FIRST_STAFF_PERMISSION_ANCHOR,
  staffTourSteps,
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
    expect(create[2]?.advanceOnClick).toBe(true);
    expect(create[3]?.advanceOnClick).toBe(true);
    expect(staffTourSteps("onboarding")[0]?.advanceOnClick).toBe(false);
  });
});
