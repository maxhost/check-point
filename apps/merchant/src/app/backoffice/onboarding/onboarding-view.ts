import { STAFF_ONBOARDING_TOUR_HREF } from "../staff/staff-tour-definitions";
import { LOCATIONS_ONBOARDING_TOUR_HREF } from "../locations/locations-tour-definitions";
import type { OnboardingItem } from "./onboarding-api";
import { CATALOG_ONBOARDING_TOUR_HREF } from "../catalog/catalog-tour-definitions";
import { BRAND_ONBOARDING_TOUR_HREF } from "../brand/brand-tour-definitions";

export type OnboardingStepState = "done" | "blocked" | "current" | "upcoming";

/**
 * A donde manda el boton «Empezar» de cada item que YA tiene pantalla. Es un mapa y no un
 * `if` por anchor: el `if` hardcodeado (`item.anchor === "staff"`) fue lo que hubo que tocar
 * para entrar el segundo item, y el tercero lo volveria a pedir.
 *
 * **`AVAILABLE_ONBOARDING_ANCHORS` se DERIVA de acá** mas `verify-email`, que es el unico que
 * no navega (manda el mail). Dos listas se desincronizan: un anchor «disponible» sin destino
 * pinta un boton que no lleva a ningun lado.
 */
export const ONBOARDING_TOUR_HREFS: Readonly<Record<string, string>> = {
  locations: LOCATIONS_ONBOARDING_TOUR_HREF,
  staff: STAFF_ONBOARDING_TOUR_HREF,
  catalog: CATALOG_ONBOARDING_TOUR_HREF,
  brand: BRAND_ONBOARDING_TOUR_HREF,
};

export const AVAILABLE_ONBOARDING_ANCHORS: ReadonlySet<string> = new Set([
  "verify-email",
  ...Object.keys(ONBOARDING_TOUR_HREFS),
]);

export function onboardingStepState(
  item: OnboardingItem,
  items: OnboardingItem[],
  availableAnchors: ReadonlySet<string> = AVAILABLE_ONBOARDING_ANCHORS,
): OnboardingStepState {
  if (item.done) return "done";
  const blockingItem = items.find(
    (candidate) =>
      candidate.required &&
      !candidate.done &&
      candidate.position < item.position,
  );
  if (blockingItem) return "blocked";
  return availableAnchors.has(item.anchor) ? "current" : "upcoming";
}
