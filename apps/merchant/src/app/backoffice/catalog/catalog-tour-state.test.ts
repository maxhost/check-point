import { describe, expect, it } from "vitest";
import { CATALOG_HELP } from "./catalog-tour-locales";
import {
  catalogHelpDisabled,
  initialCatalogPhase,
  transitionCatalogTour,
  type CatalogTourSession,
} from "./catalog-tour-state";
import {
  catalogOnboardingStart,
  wantsCatalogOnboardingTour,
  CATALOG_ONBOARDING_TOUR_HREF,
} from "./catalog-tour-definitions";

const state = (
  overrides: Partial<CatalogTourSession> = {},
): CatalogTourSession => ({
  instance: 1,
  task: "edit-product",
  phase: "select",
  multipleLocations: false,
  ...overrides,
});
describe("recorridos de catálogo", () => {
  it("publica exactamente cuatro pasos informativos y ocho tareas", () => {
    const start = catalogOnboardingStart();
    expect(start.steps).toHaveLength(4);
    expect(start.disableActiveInteraction).toBe(true);
    expect(start.showSkipOnFirstStep).toBe(true);
    expect(start.steps.every((step) => !step.advanceOnClick)).toBe(true);
    expect(new Set(CATALOG_HELP.map((item) => item.id)).size).toBe(8);
    expect(
      wantsCatalogOnboardingTour(
        new URL(CATALOG_ONBOARDING_TOUR_HREF, "https://checkpass.club").search,
      ),
    ).toBe(true);
    expect(wantsCatalogOnboardingTour("?tour=create")).toBe(false);
  });
  it("selecciona la entidad elegida y no acepta éxito de otra entidad", () => {
    const selected = transitionCatalogTour(state(), {
      type: "selected",
      id: "second",
    });
    expect(selected.entityId).toBe("second");
    const saving = { ...selected, phase: "save" as const };
    expect(transitionCatalogTour(saving, { type: "saved", id: "first" })).toBe(
      saving,
    );
    expect(
      transitionCatalogTour(saving, { type: "saved", id: "second" }).phase,
    ).toBe("success");
  });
  it("Siguiente no salta una escritura ni confirma un borrado", () => {
    for (const phase of ["save", "confirm", "processing", "select"] as const) {
      const current = state({ phase });
      expect(transitionCatalogTour(current, { type: "next" })).toBe(current);
    }
    const deleting = transitionCatalogTour(state({ task: "delete-category" }), {
      type: "selected",
      id: "chosen",
    });
    expect(deleting.phase).toBe("confirm");
  });
  it("recupera la lectura tras guardar sin volver a guardar", () => {
    const saving = state({ phase: "save", entityId: "second" });
    const reading = transitionCatalogTour(saving, { type: "refresh" });
    expect(reading.phase).toBe("refresh");
    expect(transitionCatalogTour(reading, { type: "next" })).toBe(reading);
    expect(
      transitionCatalogTour(reading, { type: "saved", id: "second" }).phase,
    ).toBe("success");
  });
  it("el PDF puede pasar directo a resultado y un picker tardío no lo rebobina", () => {
    const current = state({ task: "import-pdf", phase: "entry" });
    const done = transitionCatalogTour(current, {
      type: "import",
      phase: "result",
    });
    expect(done.phase).toBe("result");
    expect(
      transitionCatalogTour(done, { type: "import", phase: "picker" }),
    ).toBe(done);
  });
  it("respeta datos, importación y owner al ofrecer ayudas", () => {
    const facts = {
      products: 0,
      categories: 0,
      canDelete: false,
      importing: true,
    };
    expect(catalogHelpDisabled("delete-product", facts)).toMatch(/owner/);
    expect(catalogHelpDisabled("edit-product", facts)).toMatch(/producto/);
    expect(catalogHelpDisabled("edit-category", facts)).toMatch(/categoría/);
    expect(catalogHelpDisabled("create-product", facts)).toMatch(/importación/);
    expect(catalogHelpDisabled("create-category", facts)).toMatch(
      /importación/,
    );
    expect(catalogHelpDisabled("import-photos", facts)).toBeNull();
    expect(initialCatalogPhase("create-category")).toBe("name");
  });
  it("guardar desde el teclado puede terminar antes del paso Guardar sin confundir una categoría inline", () => {
    const product = state({ task: "create-product", phase: "category" });
    expect(
      transitionCatalogTour(product, {
        type: "saved",
        id: "new-category",
        task: "create-category",
      }),
    ).toBe(product);
    expect(
      transitionCatalogTour(product, {
        type: "saved",
        id: "new-product",
        task: "create-product",
      }).phase,
    ).toBe("success");
  });
});
