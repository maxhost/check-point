import type { DriveStep } from "driver.js";
import { CATALOG_PHASE_COPY } from "./catalog-tour-locales";
import type { CatalogTourSession } from "./catalog-tour-state";

export const catalogAnchor = (key: string) => `[data-tour="catalog-${key}"]`;
export const CATALOG_TOUR_QUERY_KEY = "tour";
export const CATALOG_ONBOARDING_VALUE = "onboarding";
export const CATALOG_ONBOARDING_TOUR_HREF = `/backoffice/catalog?${CATALOG_TOUR_QUERY_KEY}=${CATALOG_ONBOARDING_VALUE}`;
export function wantsCatalogOnboardingTour(search: string) {
  return (
    new URLSearchParams(search).get(CATALOG_TOUR_QUERY_KEY) ===
    CATALOG_ONBOARDING_VALUE
  );
}
export function catalogOnboardingStart() {
  const copy = [
    [
      "import-entry",
      "Cargá tu menú con IA",
      "Importá un PDF o fotos desde el celular. La IA crea lo que falta; después podés revisar y completar el catálogo.",
    ],
    [
      "products-entry",
      "Creá y gestioná productos",
      "Desde Nuevo producto cargás uno a mano. En Productos podés editar sus datos y, si sos owner, eliminarlo.",
    ],
    [
      "categories-entry",
      "Organizá tu menú",
      "En Categorías podés crear y renombrar grupos. Al eliminar una categoría, sus productos quedan sin categoría.",
    ],
    [
      "help-entry",
      "Aprendé una tarea cuando la necesites",
      "Abrí Ayuda para importar, crear, editar o eliminar con una guía paso a paso.",
    ],
  ];
  return {
    tourId: "catalog" as const,
    showSkipOnFirstStep: true,
    disableActiveInteraction: true,
    steps: copy.map(
      ([key, title, description]): DriveStep => ({
        element: catalogAnchor(key),
        popover: { title, description, side: "bottom", align: "center" },
      }),
    ),
  };
}
export function catalogHelpStep(
  session: CatalogTourSession,
  next: () => void,
  close: () => void,
): DriveStep {
  const { task, phase, entityId } = session;
  const product = task.endsWith("product");
  const keys = {
    entry: task.startsWith("import-") ? "import-entry" : "new-product",
    picker: "import-picker",
    analyze: "import-analyze",
    processing: "import-processing",
    result: "import-result",
    select: product ? "product-management" : "category-list",
    name: product
      ? "product-name"
      : task === "create-category"
        ? "category-name"
        : "category-edit-name",
    category: "product-category",
    prices: "product-prices",
    image: "product-image",
    availability: "product-availability",
    save: product
      ? "product-save"
      : task === "create-category"
        ? "category-create"
        : "category-save",
    confirm: "delete-confirm",
    success: "help-entry",
    refresh: "refresh",
  };
  let element = catalogAnchor(keys[phase]);
  if (phase === "confirm")
    element = `.confirm-dialog:has(${catalogAnchor("delete-confirm")})`;
  if (phase === "save" && product)
    element = `.catalog-editor-actions:has(${catalogAnchor("product-save")})`;
  if (entityId && ["name", "save"].includes(phase) && !product)
    element = `[data-catalog-id="${CSS.escape(entityId)}"] ${element}`;
  if (entityId && phase === "save" && !product)
    element = `[data-catalog-id="${CSS.escape(entityId)}"]`;
  const informational = [
    "name",
    "category",
    "prices",
    "image",
    "availability",
    "success",
  ].includes(phase);
  const [title, description] = CATALOG_PHASE_COPY[phase];
  return {
    element,
    popover: {
      title,
      description,
      side: "bottom",
      align: "center",
      showProgress: false,
      showButtons: informational ? ["next", "close"] : ["close"],
      nextBtnText: phase === "success" ? "Listo" : "Continuar",
      doneBtnText: phase === "success" ? "Listo" : "Continuar",
      onNextClick: phase === "success" ? close : next,
      onDoneClick: phase === "success" ? close : next,
      onCloseClick: close,
      onPopoverRender: (popover) => {
        popover.closeButton.textContent = "Salir de la guía";
        popover.closeButton.setAttribute("aria-label", "Salir de la guía");
        popover.wrapper.classList.add("catalog-tour-popover");
      },
    },
  };
}
