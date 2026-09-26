export type CatalogHelpTour =
  | "import-pdf"
  | "import-photos"
  | "create-category"
  | "create-product"
  | "edit-product"
  | "edit-category"
  | "delete-product"
  | "delete-category";
export type CatalogPhase =
  | "entry"
  | "picker"
  | "analyze"
  | "processing"
  | "result"
  | "select"
  | "name"
  | "category"
  | "prices"
  | "image"
  | "availability"
  | "save"
  | "confirm"
  | "refresh"
  | "success";
export type CatalogTourSession = {
  instance: number;
  task: CatalogHelpTour;
  phase: CatalogPhase;
  entityId?: string;
  multipleLocations: boolean;
};
export type CatalogTourEvent =
  | { type: "next" }
  | { type: "opened" }
  | { type: "selected"; id: string }
  | { type: "saved"; id?: string; task?: CatalogHelpTour }
  | { type: "refresh"; task?: CatalogHelpTour }
  | { type: "import"; phase: "picker" | "analyze" | "processing" | "result" };

export function initialCatalogPhase(task: CatalogHelpTour): CatalogPhase {
  if (task === "create-category") return "name";
  if (task.startsWith("edit-") || task.startsWith("delete-")) return "select";
  return "entry";
}

export function transitionCatalogTour(
  state: CatalogTourSession,
  event: CatalogTourEvent,
): CatalogTourSession {
  const withPhase = (phase: CatalogPhase) => ({ ...state, phase });
  if (
    (event.type === "saved" || event.type === "refresh") &&
    event.task &&
    event.task !== state.task
  )
    return state;
  if (event.type === "import") {
    if (!state.task.startsWith("import-")) return state;
    // A picker cannot rewind an analysis/result from a delayed opening response.
    if (
      ["processing", "result"].includes(state.phase) &&
      ["picker", "analyze"].includes(event.phase)
    )
      return state;
    return state.phase === event.phase ? state : withPhase(event.phase);
  }
  if (event.type === "selected" && state.phase === "select") {
    return {
      ...state,
      entityId: event.id,
      phase: state.task.startsWith("delete-") ? "confirm" : "name",
    };
  }
  if (event.type === "opened" && state.phase === "entry")
    return withPhase(state.task.startsWith("import-") ? "picker" : "name");
  if (
    event.type === "refresh" &&
    [
      "name",
      "category",
      "prices",
      "image",
      "availability",
      "save",
      "confirm",
    ].includes(state.phase)
  )
    return withPhase("refresh");
  if (
    event.type === "saved" &&
    [
      "name",
      "category",
      "prices",
      "image",
      "availability",
      "save",
      "confirm",
      "refresh",
    ].includes(state.phase)
  ) {
    if (state.entityId && state.entityId !== event.id) return state;
    return withPhase("success");
  }
  if (event.type !== "next") return state;
  if (state.task.endsWith("category") && state.phase === "name")
    return withPhase("save");
  const phases: CatalogPhase[] = [
    "name",
    "category",
    "prices",
    "image",
    ...(state.multipleLocations ? ["availability" as const] : []),
    "save",
  ];
  const index = phases.indexOf(state.phase);
  return index >= 0 && index < phases.length - 1
    ? withPhase(phases[index + 1])
    : state;
}

export function catalogHelpDisabled(
  task: CatalogHelpTour,
  facts: {
    products: number;
    categories: number;
    canDelete: boolean;
    importing: boolean;
  },
): string | null {
  if (task.startsWith("delete-") && !facts.canDelete)
    return "Solo el owner puede eliminar.";
  if (task.startsWith("create-") && facts.importing)
    return "Esperá a que termine la importación para crear a mano.";
  if (["edit-product", "delete-product"].includes(task) && !facts.products)
    return "Primero creá o importá un producto.";
  if (["edit-category", "delete-category"].includes(task) && !facts.categories)
    return "Primero creá o importá una categoría.";
  return null;
}
