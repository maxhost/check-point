import type { DriveStep } from "driver.js";
import type { LoyaltyVm } from "./use-loyalty-program";
import type {
  LoyaltyEditorSignal,
  LoyaltyTourSession,
} from "./loyalty-tour-state";
import { outcomeFor } from "./loyalty-tour-state";
import { STEP_COPY, loyaltyAnchor } from "./loyalty-tour-definitions";
export function loyaltyHelpStep(
  current: LoyaltyVm,
  session: LoyaltyTourSession,
  editor: LoyaltyEditorSignal | null,
  accrual: boolean,
  next: () => void,
  close: () => void,
): DriveStep | null {
  const outcome = outcomeFor(session, current.writeOutcome);
  let key: string | null = null;
  let title = "Tu guía";
  let description = "Usá los controles del formulario para continuar.";
  let manual = false;
  let success = false;
  const refreshed =
    outcome === "confirmed+refreshed" ||
    (outcome === "confirmed+refreshFailed" &&
      !current.refreshFailed &&
      !current.loading);
  if (refreshed) {
    key = "result";
    success = true;
    title =
      session.task === "close" ? "Cierre confirmado" : "Guardado confirmado";
    description =
      session.task === "close"
        ? "El cierre quedó programado. Revisá las fechas."
        : session.task === "create"
          ? "El programa quedó activado."
          : "El programa quedó actualizado.";
  } else if (outcome === "confirmed+refreshFailed") {
    key = "refresh";
    title = "Vista pendiente";
    description =
      "El cambio está confirmado, pero falta actualizar la vista. Pulsá Actualizar vista; no hace falta guardar otra vez.";
  } else if (session.task === "close") {
    key = current.confirmClose
      ? "close-confirm"
      : current.closing
        ? "close-form"
        : "close-action";
    title = current.confirmClose ? "Confirmación de cierre" : "Cierre";
    description = current.saving
      ? "Estamos confirmando el cierre. Esperá el resultado."
      : current.confirmClose
        ? "Confirmar programa el cierre y bloquea la edición. Cancelar vuelve al formulario sin programarlo."
        : "Elegí el fin de acumulación y una fecha posterior de canje en la zona horaria del negocio. Después revisá la confirmación.";
    if (current.saving) key = null;
  } else if (current.editing || !current.program) {
    const step = editor?.step ?? (current.program ? "basics" : "modality");
    key = step === "rewards" ? "rewards-edit" : step;
    [title, description] = STEP_COPY[step];
    if (step === "terms" && session.task !== "policies") {
      manual = !accrual;
      if (accrual) {
        key = "accrual";
        [title, description] = STEP_COPY.accrual;
      }
    }
    if (session.task === "policies" && step === "rewards") {
      key = "redemption-policy";
      title = "Canje sin saldo";
      description =
        "Decidí si el mostrador puede entregar un premio sin saldo suficiente. Si lo permitís, el saldo queda en 0 y la entrega queda registrada. Pulsá Continuar para revisar todos los cambios.";
    }
    if (current.stamp.pending) {
      key = null;
      title = "Ajustá el sello";
      description =
        "Terminá o cancelá el recorte. La imagen sigue en el borrador y todavía no se guarda.";
    }
    if (current.saving || current.stamp.isAnalyzing) {
      manual = false;
      description =
        "Esperá a que termine la operación. Tu borrador se conserva.";
    }
  } else {
    key = "edit-action";
    title = "Editar un programa";
    description =
      "Pulsá Editar programa para trabajar sobre el borrador existente.";
  }
  if (key && !document.querySelector(loyaltyAnchor(key))) return null;
  const step: DriveStep = {
    element: key ? loyaltyAnchor(key) : undefined,
    popover: {
      title,
      description,
      side: "bottom",
      align: "center",
      popoverClass: "loyalty-tour-popover",
      showButtons: manual || success ? ["next", "close"] : ["close"],
      nextBtnText: success ? "Listo" : "Ver acumulación",
      doneBtnText: success ? "Listo" : "Ver acumulación",
      onNextClick: success ? () => close() : () => next(),
      onDoneClick: success ? () => close() : () => next(),
      onCloseClick: () => close(),
      onPopoverRender: (popover) => {
        // Keep guide controls inside the active dialog focus and accessibility scope.
        const dialog = document.querySelector<HTMLElement>(
          '[data-tour="loyalty-close-confirm"], .image-cropper',
        );
        (dialog ?? document.body).appendChild(popover.wrapper);
        popover.closeButton.textContent = "Salir de la guía";
        popover.closeButton.setAttribute("aria-label", "Salir de la guía");
      },
    },
  };

  return step;
}
