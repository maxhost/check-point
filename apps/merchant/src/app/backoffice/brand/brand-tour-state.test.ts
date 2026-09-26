import { expect, it } from "vitest";
import {
  brandTaskPhases,
  transitionBrandTour,
  type BrandTourSession,
} from "./brand-tour-state";
import {
  BRAND_HELP,
  brandOnboardingStart,
  wantsBrandOnboardingTour,
} from "./brand-tour-definitions";
it("publica cinco pasos y seis tareas con entradas coherentes", () => {
  expect(brandOnboardingStart().steps).toHaveLength(5);
  expect(BRAND_HELP).toHaveLength(6);
  for (const item of BRAND_HELP)
    expect(brandTaskPhases[item.id]).toContain("save");
  expect(wantsBrandOnboardingTour("?tour=onboarding&keep=1")).toBe(true);
  expect(wantsBrandOnboardingTour("?tour=help")).toBe(false);
});
it("logo espera selección y guardado, no un clic", () => {
  const initial: BrandTourSession = {
    instance: 1,
    task: "change-logo",
    phase: "logo",
  };
  expect(transitionBrandTour(initial, { type: "next" })).toEqual(initial);
  const crop = transitionBrandTour(initial, { type: "cropping" })!;
  expect(crop.phase).toBe("crop");
  expect(transitionBrandTour(crop, { type: "cancel-crop" })).toBeNull();
  const preview = transitionBrandTour(crop, { type: "selected" })!;
  const save = transitionBrandTour(preview, { type: "next" })!;
  expect(save.phase).toBe("save");
  expect(transitionBrandTour(save, { type: "next" })).toEqual(save);
  expect(transitionBrandTour(save, { type: "saved" })?.phase).toBe("success");
});
it("quitar espera la acción real y sólo saved termina la guía", () => {
  const initial: BrandTourSession = {
    instance: 2,
    task: "remove-logo",
    phase: "remove",
  };
  expect(transitionBrandTour(initial, { type: "next" })).toEqual(initial);
  expect(transitionBrandTour(initial, { type: "saved" })).toEqual(initial);
  expect(transitionBrandTour(initial, { type: "removed" })?.phase).toBe(
    "preview",
  );
});
