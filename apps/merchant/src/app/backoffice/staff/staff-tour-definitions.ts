import type { DriveStep } from "driver.js";
import { STAFF_TOUR_COPY, type StaffTourLocale } from "./staff-tour-locales";

export type StaffHelpTour =
  "create" | "edit-permissions" | "regenerate-pin" | "disable";

const anchors = {
  create: ["add", "name", "counter", "create", "copy", "closeCredentials"],
  "edit-permissions": ["manageEdit", "editName", "editPermissions", "saveEdit"],
  "regenerate-pin": [
    "managePin",
    "pin",
    "pinConfirm",
    "copy",
    "closeCredentials",
  ],
  disable: ["manageDisable", "disable", "disableConfirm"],
} as const;

const selectors: Record<string, string> = {
  add: '[data-tour="staff-add"]',
  manage: '[data-tour="staff-members"]',
  name: '[data-tour="staff-name"]',
  counter: '[data-tour="staff-permission-counter"]',
  create: '[data-tour="staff-create"]',
  copy: '[data-tour="staff-credentials-copy"]',
  closeCredentials: '[data-tour="staff-credentials-done"]',
  managePin: '[data-tour="staff-member-manage"]',
  manageEdit: '[data-tour="staff-member-manage"]',
  editName: '[data-tour="staff-edit-name"]',
  editPermissions: '[data-tour="staff-edit-permissions"]',
  saveEdit: '[data-tour="staff-edit-save"]',
  pin: '[data-tour="staff-pin"]',
  pinConfirm: '[data-tour="staff-pin-confirm"]',
  manageDisable: '[data-tour="staff-member-manage"]',
  disable: '[data-tour="staff-status"]',
  disableConfirm: '[data-tour="staff-status-confirm"]',
};

/**
 * Los pasos que avanzan al PULSAR su control, porque el control es una accion inequivoca.
 *
 * El paso de permisos es informativo: usa «Siguiente» para que el tour no cambie
 * la selección recomendada ni obligue a otorgar un acceso.
 */
const autoAdvanceAnchors = new Set<keyof (typeof STAFF_TOUR_COPY)["es"]>([
  "add",
  "create",
  "copy",
  "closeCredentials",
  "manageEdit",
  "editPermissions",
  "saveEdit",
  "managePin",
  "pin",
  "pinConfirm",
  "manageDisable",
  "disable",
  "disableConfirm",
]);

export function staffTourSteps(
  tour: StaffHelpTour | "onboarding",
  locale: StaffTourLocale = "es",
): DriveStep[] {
  const copy = STAFF_TOUR_COPY[locale];
  const keys: Array<keyof typeof copy> =
    tour === "onboarding" ? ["add", "manage"] : [...anchors[tour]];
  return keys.map((key) => ({
    element: selectors[key],
    advanceOnClick: tour !== "onboarding" && autoAdvanceAnchors.has(key),
    popover: {
      title: copy[key][0],
      description: copy[key][1],
      side: "bottom",
      align: "center",
    },
  }));
}

export const FIRST_STAFF_PERMISSION_ANCHOR = selectors.counter;

/**
 * EL CABLEADO DEL ARRANQUE, EN UNA SOLA FUENTE — enmienda §11 de la spec 0088.
 *
 * El checklist empuja una URL y esta pantalla la lee. Estaban escritos en dos lados
 * (`onboarding-checklist.tsx` y `staff-tour-controller.tsx`), o sea que cambiar uno dejaba el
 * boton «Empezar» navegando a una pantalla que no arranca ningun tour — **sin poner rojo a
 * nadie**: la revision independiente lo midio rompiendo el query param y los 1.526 tests
 * siguieron en verde. Con el `href` derivado de las mismas dos constantes que lo parsean, la
 * desincronizacion deja de ser posible por construccion.
 */
export const STAFF_TOUR_QUERY_KEY = "tour";
export const STAFF_ONBOARDING_TOUR_VALUE = "onboarding";
export const STAFF_ONBOARDING_TOUR_HREF = `/backoffice/staff?${STAFF_TOUR_QUERY_KEY}=${STAFF_ONBOARDING_TOUR_VALUE}`;

/** Si esta query pide el tour de orientacion. Cualquier otro valor —o ninguno— no arranca nada. */
export function wantsStaffOnboardingTour(search: string): boolean {
  return (
    new URLSearchParams(search).get(STAFF_TOUR_QUERY_KEY) ===
    STAFF_ONBOARDING_TOUR_VALUE
  );
}

export type StaffTourStart = {
  tourId: "staff";
  steps: DriveStep[];
  persist?: boolean;
  showSkipOnFirstStep?: boolean;
};

/**
 * El arranque de una AYUDA. **`persist: false` es la decision, y vive aca y no en el
 * componente**: es lo unico que impide que abrir «Ayuda» marque el item del onboarding como
 * hecho sin que el merchant haya visto la orientacion. En el `.tsx` no tenia oraculo (medido).
 * ORACULO: el caso «ninguna ayuda persiste progreso» de `staff-tour-definitions.test.ts`.
 */
export function staffHelpStart(id: StaffHelpTour): StaffTourStart {
  return { tourId: "staff", steps: staffTourSteps(id), persist: false };
}

/** El arranque del ONBOARDING: persiste (el default de `startOnboardingTour`) y ofrece saltar
 * desde el primer paso, que es lo que el owner pidio para no encerrar a nadie en el tour. */
export function staffOnboardingStart(): StaffTourStart {
  return {
    tourId: "staff",
    steps: staffTourSteps("onboarding"),
    showSkipOnFirstStep: true,
  };
}
