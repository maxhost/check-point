import type { DriveStep } from "driver.js";
import type { LoyaltyVm } from "./use-loyalty-program";
import type { StepId } from "./program-form-state";
import type { LoyaltyTask } from "./loyalty-tour-state";
export const LOYALTY_TOUR_QUERY_KEY = "tour";
export const LOYALTY_ONBOARDING_VALUE = "onboarding";
export const LOYALTY_ONBOARDING_TOUR_HREF = `/backoffice/loyalty?${LOYALTY_TOUR_QUERY_KEY}=${LOYALTY_ONBOARDING_VALUE}`;
export const wantsLoyaltyOnboardingTour = (search: string) =>
  new URLSearchParams(search).get(LOYALTY_TOUR_QUERY_KEY) ===
  LOYALTY_ONBOARDING_VALUE;
export const loyaltyAnchor = (key: string) => `[data-tour="loyalty-${key}"]`;
export const LOYALTY_HELP: { id: LoyaltyTask; title: string }[] = [
  { id: "create", title: "Crear un programa" },
  { id: "edit", title: "Editar un programa" },
  { id: "close", title: "Programar el cierre" },
  { id: "policies", title: "Editar políticas" },
];
export function helpUnavailable(
  task: LoyaltyTask,
  vm: Pick<LoyaltyVm, "program" | "isClosing" | "isOwner">,
) {
  if (task === "close" && !vm.isOwner)
    return "Sólo el propietario puede programar el cierre";
  if (task === "create") return vm.program ? "Ya hay un programa activo" : null;
  return !vm.program
    ? "Primero creá un programa"
    : vm.isClosing
      ? "No se puede editar durante el cierre"
      : null;
}
export function loyaltyOrientation(vm: LoyaltyVm): DriveStep[] {
  const editor = vm.editing || !vm.program;
  const rows: [string | null, string, string][] = [
    [
      editor ? (vm.program ? "editor-step" : "modality") : "program",
      "Tu programa de fidelización",
      editor
        ? vm.program
          ? "Estás trabajando en un borrador. Los cambios se aplican cuando revisás y guardás el programa."
          : "Elegí sellos para completar una tarjeta o puntos para asignar un costo a cada premio."
        : "Acá ves si tu programa es de sellos o puntos y si está activo o en cierre.",
    ],
    [
      editor ? "editor-progress" : "rules",
      "Cómo se ganan beneficios",
      editor
        ? "Este indicador muestra los pasos. Vas a definir cómo se acumulan los beneficios dentro del formulario."
        : "Revisá cómo acumulan tus clientes y qué objetivo deben alcanzar.",
    ],
    [
      editor ? null : "rewards-view",
      "Qué reciben tus clientes",
      editor
        ? vm.canReadCatalog
          ? "Más adelante configurás los premios; podés usar un producto del catálogo, un premio libre o un descuento."
          : "Más adelante configurás premios libres o descuentos. Los productos guardados se conservan."
        : "Estos son tus premios. En un programa de puntos, cada premio muestra su costo.",
    ],
    [
      editor ? null : vm.isClosing ? "closing-dates" : "terms-view",
      "Términos y gestión",
      editor
        ? "Revisá los términos y todos los cambios antes de activar o guardar."
        : vm.isClosing
          ? "Estas fechas indican hasta cuándo se acumula y se canjea. Durante el cierre no se puede editar el programa."
          : `Acá consultás los términos y podés editar el programa.${vm.isOwner ? " También podés programar su cierre." : ""}`,
    ],
    [
      "help",
      "Ayuda cuando la necesites",
      "Desde Ayuda podés volver a este recorrido o abrir una guía para crear, editar, programar el cierre o editar políticas, según el estado del programa y tus permisos.",
    ],
  ];
  return rows.map(([key, title, description]) => ({
    element: key
      ? loyaltyAnchor(
          key === "modality" && !document.querySelector(loyaltyAnchor(key))
            ? "editor-step"
            : key,
        )
      : undefined,
    popover: {
      title,
      description,
      side: "bottom",
      align: "center",
      popoverClass: "loyalty-orientation-popover",
    },
  }));
}
export const STEP_COPY: Record<StepId | "accrual", [string, string]> = {
  modality: [
    "Modalidad",
    "Elegí Sellos o Puntos y pulsá Continuar para configurar tu programa.",
  ],
  units: [
    "Unidades",
    "Elegí cómo se llama una unidad y cómo se nombran varias.",
  ],
  basics: [
    "Sello y objetivo",
    "Poné el nombre del sello y cuántos necesita el cliente para completar la tarjeta.",
  ],
  design: [
    "Diseño",
    "Personalizá la tarjeta. La imagen es opcional; si abrís el recorte, terminá o cancelá antes de continuar.",
  ],
  terms: [
    "Términos",
    "Escribí tus términos. Las plantillas son opcionales y se añaden al texto actual.",
  ],
  accrual: [
    "Acumulación",
    "Definí cómo se ganan beneficios. Elegí valores válidos y pulsá Continuar.",
  ],
  rewards: [
    "Premios",
    "Elegí el premio; en Puntos, definí el costo de cada uno. Continuar conserva tu borrador.",
  ],
  review: [
    "Revisión",
    "Se guardarán todos los cambios pendientes del programa. Revisalos y pulsá Activar programa o Guardar cambios cuando estés listo.",
  ],
};
