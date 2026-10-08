/**
 * El panel «Guía de inicio» se puede CERRAR (no solo minimizar) y se reabre desde «Ayuda» en el
 * menú (owner, 2026-10-08: en mobile el panel minimizado tapaba parte de la UI).
 *
 * Que esté cerrado es una preferencia de ESTE navegador, no un dato del negocio: vive en
 * `localStorage` y no en la API. Si el storage no está disponible (navegación privada, bloqueado)
 * el panel se muestra igual y cerrarlo dura hasta recargar.
 */
export const ONBOARDING_CHECKLIST_OPEN_EVENT =
  "checkpass:onboarding-checklist-open";

const CLOSED_KEY = "checkpass:onboarding-checklist-closed";

export function isOnboardingChecklistClosed(): boolean {
  try {
    return window.localStorage.getItem(CLOSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setOnboardingChecklistClosed(closed: boolean): void {
  try {
    if (closed) window.localStorage.setItem(CLOSED_KEY, "1");
    else window.localStorage.removeItem(CLOSED_KEY);
  } catch {
    // Sin storage: el cierre vale solo para esta carga de la página.
  }
}

/** Lo dispara «Ayuda» en el menú; lo escucha `OnboardingChecklist`. */
export function openOnboardingChecklist(): void {
  setOnboardingChecklistClosed(false);
  window.dispatchEvent(new Event(ONBOARDING_CHECKLIST_OPEN_EVENT));
}
