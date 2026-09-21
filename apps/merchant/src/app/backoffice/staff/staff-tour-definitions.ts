import type { DriveStep } from "driver.js";
import { STAFF_TOUR_COPY, type StaffTourLocale } from "./staff-tour-locales";

export type StaffHelpTour =
  | "create"
  | "edit-permissions"
  | "regenerate-pin"
  | "disable";

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

const autoAdvanceAnchors = new Set<keyof (typeof STAFF_TOUR_COPY)["es"]>([
  "add",
  "counter",
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
