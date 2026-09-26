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
    body: "Editá el nombre con el que te ven tus clientes.",
  },
  {
    id: "change-logo",
    title: "Cargar o cambiar el logo",
    body: "Elegí una imagen, ajustá su encuadre y guardala.",
  },
  {
    id: "remove-logo",
    title: "Quitar el logo",
    body: "Usá el nombre o las iniciales de tu negocio.",
  },
  {
    id: "change-colors",
    title: "Ajustar los colores",
    body: "Definí tu paleta y revisá la vista previa.",
  },
  {
    id: "change-timezone",
    title: "Cambiar la zona horaria",
    body: "Revisá cómo se interpretan fechas y horarios.",
  },
  {
    id: "change-currency",
    title: "Cambiar la moneda",
    body: "Elegí la moneda en la que se muestran los precios.",
  },
];
export function brandOnboardingStart() {
  const steps = [
    [
      "identity-logo",
      "Dale identidad a tu negocio",
      "Elegí el nombre y un logo que tus clientes reconozcan. Podés continuar sin logo.",
    ],
    [
      "colors",
      "Usá los colores de tu marca",
      "Ajustá primario, complementario y acento. La vista previa muestra el borrador antes de guardarlo.",
    ],
    [
      "regional",
      "Revisá horarios y moneda",
      "La zona horaria define fechas y horarios; la moneda se usa para mostrar los precios del catálogo.",
    ],
    [
      "save",
      "Aplicá tus cambios cuando estén listos",
      "Guardar marca aplica todo el borrador. Elegir o quitar un logo todavía no guarda esos cambios.",
    ],
    [
      "help",
      "Encontrá una guía cuando la necesites",
      "Ayuda te acompaña para cambiar tu marca. Desde Crear afiche podés preparar un afiche con QR para sumar clientes.",
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
    "Completá el nombre",
    "Usá un nombre claro, de hasta 120 caracteres. Podés continuar sin cambiarlo.",
  ],
  logo: [
    "Elegí tu logo",
    "Elegí un archivo o usá Tomar foto si está disponible. Una imagen cuadrada y clara ayuda a reconocer tu negocio. Elegirla todavía no guarda la marca.",
  ],
  crop: [
    "Ajustá el encuadre",
    "Mové la imagen y ajustá el zoom. Pulsá Usar para llevar el recorte al borrador. Cancelar vuelve al editor sin guardar.",
  ],
  remove: [
    "Quitá el logo del borrador",
    "Pulsá Quitar. El cambio se aplicará al guardar; se mostrará el nombre o las iniciales según la experiencia.",
  ],
  primary: [
    "Elegí el color primario",
    "Usá el selector o un código hexadecimal como #123ABC. Podés conservar el color actual.",
  ],
  complementary: [
    "Elegí el color complementario",
    "Elegí un tono que acompañe al primario. Podés conservar el actual.",
  ],
  accent: [
    "Elegí el color de acento",
    "Completá tu paleta con un tercer tono. Podés conservar el actual.",
  ],
  timezone: [
    "Elegí la zona horaria",
    "Define las fechas y horarios de programas y campañas. Podés conservar la actual.",
  ],
  currency: [
    "Elegí la moneda",
    "Cambia la moneda mostrada en los precios. No convierte los importes existentes. Podés conservar la actual.",
  ],
  preview: [
    "Revisá la vista previa",
    "Estos son tus cambios en el borrador. Todavía no se guardaron.",
  ],
  save: [
    "Guardá la marca",
    "Se guardarán todos los cambios pendientes de la marca, incluidos los de otras secciones. Pulsá Guardar marca y esperá la confirmación.",
  ],
  success: [
    "Marca guardada",
    "La API confirmó tus cambios. Podés volver a Ayuda cuando necesites otra guía.",
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
