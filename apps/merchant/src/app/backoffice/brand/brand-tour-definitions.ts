import type { DriveStep } from "driver.js";
import type {
  BrandPhase,
  BrandTask,
  BrandTourSession,
} from "./brand-tour-state";

export const BRAND_TOUR_QUERY_KEY = "tour";
export const BRAND_ONBOARDING_VALUE = "onboarding";
export const BRAND_ONBOARDING_TOUR_HREF = `/backoffice/brand?${BRAND_TOUR_QUERY_KEY}=${BRAND_ONBOARDING_VALUE}`;
export const wantsBrandOnboardingTour = (search: string) =>
  new URLSearchParams(search).get(BRAND_TOUR_QUERY_KEY) ===
  BRAND_ONBOARDING_VALUE;
export const brandAnchor = (key: string) => `[data-tour="brand-${key}"]`;
export const BRAND_HELP: { id: BrandTask; title: string; body: string }[] = [
  {
    id: "change-name",
    title: "Cambiar el nombre",
    body: "Edita el nombre con el que te ven tus clientes.",
  },
  {
    id: "change-logo",
    title: "Cargar o cambiar el logo",
    body: "Elige una imagen, ajusta su encuadre y guárdala.",
  },
  {
    id: "remove-logo",
    title: "Quitar el logo",
    body: "Usa el nombre o las iniciales de tu negocio.",
  },
  {
    id: "change-colors",
    title: "Ajustar los colores",
    body: "Define tu paleta y revisa la vista previa.",
  },
  {
    id: "change-timezone",
    title: "Cambiar la zona horaria",
    body: "Revisa cómo se interpretan fechas y horarios.",
  },
  {
    id: "change-currency",
    title: "Cambiar la moneda",
    body: "Elige la moneda en la que se muestran los precios.",
  },
];
export function brandOnboardingStart() {
  const steps = [
    [
      "identity-logo",
      "Da identidad a tu negocio",
      "Elige el nombre y un logo que tus clientes reconozcan. Puedes continuar sin logo.",
    ],
    [
      "colors",
      "Usa los colores de tu marca",
      "Ajusta primario, complementario y acento. La vista previa muestra el borrador antes de guardarlo.",
    ],
    [
      "regional",
      "Revisa horarios y moneda",
      "La zona horaria define fechas y horarios; la moneda se usa para mostrar los precios del catálogo.",
    ],
    [
      "save",
      "Aplica tus cambios cuando estén listos",
      "Guardar marca aplica todo el borrador. Elegir o quitar un logo todavía no guarda esos cambios.",
    ],
    [
      "help",
      "Encuentra una guía cuando la necesites",
      "Ayuda te acompaña para cambiar tu marca. Desde Crear afiche puedes preparar un afiche con QR para sumar clientes.",
    ],
  ];
  return {
    tourId: "brand" as const,
    showSkipOnFirstStep: true,
    disableActiveInteraction: true,
    steps: steps.map(
      ([key, title, description]): DriveStep => ({
        element: brandAnchor(key),
        popover: { title, description, side: "bottom", align: "center" },
      }),
    ),
  };
}
const COPY: Record<BrandPhase, [string, string]> = {
  name: [
    "Completa el nombre",
    "Usa un nombre claro, de hasta 120 caracteres. Puedes continuar sin cambiarlo.",
  ],
  logo: [
    "Elige tu logo",
    "Elige un archivo o usa Tomar foto si está disponible. Una imagen cuadrada y clara ayuda a reconocer tu negocio. Elegirla todavía no guarda la marca.",
  ],
  crop: [
    "Ajusta el encuadre",
    "Mueve la imagen y ajusta el zoom. Pulsa Usar para llevar el recorte al borrador. Cancelar vuelve al editor sin guardar.",
  ],
  remove: [
    "Quita el logo del borrador",
    "Pulsa Quitar. El cambio se aplicará al guardar; se mostrará el nombre o las iniciales según la experiencia.",
  ],
  primary: [
    "Elige el color primario",
    "Usa el selector o un código hexadecimal como #123ABC. Puedes conservar el color actual.",
  ],
  complementary: [
    "Elige el color complementario",
    "Elige un tono que acompañe al primario. Puedes conservar el actual.",
  ],
  accent: [
    "Elige el color de acento",
    "Completa tu paleta con un tercer tono. Puedes conservar el actual.",
  ],
  timezone: [
    "Elige la zona horaria",
    "Define las fechas y horarios de programas y campañas. Puedes conservar la actual.",
  ],
  currency: [
    "Elige la moneda",
    "Cambia la moneda mostrada en los precios. No convierte los importes existentes. Puedes conservar la actual.",
  ],
  preview: [
    "Revisa la vista previa",
    "Estos son tus cambios en el borrador. Todavía no se guardaron.",
  ],
  save: [
    "Guarda la marca",
    "Se guardarán todos los cambios pendientes de la marca, incluidos los de otras secciones. Pulsa Guardar marca y espera la confirmación.",
  ],
  success: [
    "Marca guardada",
    "La API confirmó tus cambios. Puedes volver a Ayuda cuando necesites otra guía.",
  ],
};
export function brandHelpStep(
  session: BrandTourSession,
  next: () => void,
  close: () => void,
): DriveStep {
  const { phase } = session;
  const manual = !["logo", "crop", "remove", "save"].includes(phase);
  const [title, description] = COPY[phase];
  return {
    element:
      phase === "crop"
        ? ".image-cropper"
        : brandAnchor(phase === "success" ? "help" : phase),
    popover: {
      title,
      description,
      side: "bottom",
      align: "center",
      showProgress: false,
      showButtons: manual ? ["next", "close"] : ["close"],
      nextBtnText: phase === "success" ? "Listo" : "Continuar",
      doneBtnText: phase === "success" ? "Listo" : "Continuar",
      onNextClick: phase === "success" ? close : next,
      onDoneClick: phase === "success" ? close : next,
      onCloseClick: close,
      onPopoverRender: (popover) => {
        popover.closeButton.textContent = "Salir de la guía";
        popover.closeButton.setAttribute("aria-label", "Salir de la guía");
        popover.wrapper.classList.add("brand-tour-popover");
      },
    },
  };
}
