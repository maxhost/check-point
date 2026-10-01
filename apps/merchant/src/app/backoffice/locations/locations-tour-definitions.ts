import type { DriveStep } from "driver.js";

export type LocationsHelpTour = "limit" | "create" | "edit" | "archive";
type LocationsTourStart = {
  tourId: "locations";
  steps: DriveStep[];
  persist?: boolean;
  showSkipOnFirstStep?: boolean;
};

const selectors = {
  limit: '[data-tour="locations-limit"]',
  add: '[data-tour="locations-add"]',
  list: '[data-tour="locations-list"]',
  edit: '[data-tour="location-edit"]',
  archive: '[data-tour="location-archive"]',
  name: '[data-tour="location-name"]',
  address: '[data-tour="location-address"]',
  manualAddress: '[data-tour="location-manual-address"]',
  save: '[data-tour="location-save"]',
  saveEdit: '[data-tour="location-save"]',
  archiveConfirm: '[data-tour="location-archive-confirm"]',
} as const;

const copy = {
  limit: [
    "Cantidad de locales en tu plan",
    "La cantidad de locales activos depende de tu plan. Este indicador muestra tu límite actual.",
  ],
  add: [
    "Añade un local",
    "Abre el formulario para registrar una nueva sucursal.",
  ],
  list: [
    "Gestiona tus locales",
    "Aquí puedes editar sus datos, archivarlos o reactivar los que ya no operaban.",
  ],
  edit: [
    "Elige el local",
    "Toca Editar en el local cuyos datos quieres actualizar.",
  ],
  archive: [
    "Elige el local",
    "Toca Archivar. La baja es reversible y conserva el historial.",
  ],
  name: [
    "Añade un nombre al local",
    "Usa un nombre corto que tu equipo pueda reconocer fácilmente.",
  ],
  address: [
    "Busca la dirección de tu local",
    "Escribe al menos tres letras y selecciona la dirección correcta en el listado.",
  ],
  manualAddress: [
    "¿No encontraste la dirección?",
    "Puedes escribirla manualmente en este campo.",
  ],
  save: [
    "Crea el local",
    "Confirma los datos para crear el local. El servidor volverá a revisar la dirección elegida.",
  ],
  saveEdit: [
    "Guarda los cambios",
    "Confirma para actualizar el local. El servidor volverá a revisar la dirección si la modificaste.",
  ],
  archiveConfirm: [
    "Confirma el archivo",
    "El local dejará de operar. Si es el último local activo, el sistema protegerá al negocio y no permitirá archivarlo.",
  ],
} as const;

const tourKeys: Record<
  LocationsHelpTour | "onboarding",
  Array<keyof typeof copy>
> = {
  limit: ["limit"],
  create: ["add", "name", "address", "manualAddress", "save"],
  edit: ["edit", "name", "address", "manualAddress", "saveEdit"],
  archive: ["archive", "archiveConfirm"],
  onboarding: ["limit", "add", "name", "address", "manualAddress", "save"],
};

const autoAdvance = new Set<keyof typeof copy>([
  "add",
  "edit",
  "archive",
  "save",
  "saveEdit",
  "archiveConfirm",
]);

export function locationsTourSteps(
  tour: LocationsHelpTour | "onboarding",
): DriveStep[] {
  return tourKeys[tour].map((key) => ({
    element: selectors[key],
    advanceOnClick: autoAdvance.has(key),
    popover: {
      title: copy[key][0],
      description: copy[key][1],
      side: key === "address" ? "top" : "bottom",
      align: "center",
    },
  }));
}

export const LOCATIONS_ONBOARDING_TOUR_HREF =
  "/backoffice/locations?tour=onboarding";

export function wantsLocationsOnboardingTour(search: string): boolean {
  return new URLSearchParams(search).get("tour") === "onboarding";
}

export function locationsHelpStart(id: LocationsHelpTour): LocationsTourStart {
  return {
    tourId: "locations" as const,
    steps: locationsTourSteps(id),
    persist: false,
  };
}

export function locationsOnboardingStart(canAdd: boolean): LocationsTourStart {
  return {
    tourId: "locations" as const,
    steps: canAdd
      ? locationsTourSteps("onboarding")
      : locationsTourSteps("onboarding").slice(0, 1),
    showSkipOnFirstStep: true,
  };
}
