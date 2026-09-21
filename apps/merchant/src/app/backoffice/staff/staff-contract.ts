export const PERMISSIONS = [
  {
    id: "counter",
    label: "Mostrador",
    detail: "Acreditar compras y canjear premios.",
  },
  {
    id: "catalog",
    label: "Catálogo",
    detail: "Ver, crear y editar productos y categorías.",
  },
  {
    id: "locations",
    label: "Locales",
    detail: "Ver, crear, editar y activar locales.",
  },
  {
    id: "loyalty",
    label: "Programa de fidelización",
    detail: "Configurar el programa, sus premios y diseño.",
  },
  {
    id: "marketing",
    label: "Campañas",
    detail: "Crear, editar, pausar y activar campañas.",
  },
  {
    id: "brand",
    label: "Marca",
    detail: "Editar la identidad visual del negocio.",
  },
  {
    id: "staff",
    label: "Administrador",
    detail: "Acceso total a la configuración y al alta de integrantes.",
  },
] as const;

export type Permission = (typeof PERMISSIONS)[number]["id"];

export type StaffMember = {
  userId: string;
  name: string;
  identifier: string;
  role: string;
  status: "active" | "disabled";
  permissions: string[];
  createdAt: string;
};

export type ApiFailure = { code?: string; error?: string };

const ERROR_COPY: Record<string, string> = {
  invalid_body:
    "No pudimos leer los datos enviados. Revisá el formulario e intentá otra vez.",
  name_required: "Escribí el nombre del integrante.",
  name_too_long: "El nombre puede tener hasta 80 caracteres.",
  permissions_not_here:
    "El nombre y los permisos se guardan por separado. Volvé a intentar.",
  permissions_required:
    "Elegí al menos un permiso. Si no debe tener acceso, desactivá al integrante.",
  unknown_permission:
    "Hay un permiso que ya no es válido. Recargá la pantalla e intentá otra vez.",
  permission_not_grantable:
    "Sólo el owner puede otorgar o quitar el acceso de Administrador.",
  self_permission_edit:
    "No podés editar tus propios permisos. Pedile a otra persona con acceso a Staff.",
  target_is_owner: "La membresía del owner no se puede modificar desde Staff.",
  target_disabled:
    "Este integrante está dado de baja. Reactivalo y después volvé a guardar el nombre.",
  handle_taken:
    "Ese identificador se ocupó al mismo tiempo. Intentá guardar nuevamente.",
  staff_not_found: "El integrante ya no está disponible. Actualizá el listado.",
  invalid_status: "El estado solicitado no es válido. Recargá la pantalla.",
  invalid_target: "El integrante no es válido. Recargá la pantalla.",
  unauthorized: "Tu sesión venció. Volvé a ingresar.",
  not_member:
    "Tu usuario ya no tiene una membresía activa. Volvé a ingresar o contactá al owner.",
  missing_permission:
    "Ya no tenés permiso para gestionar Staff. Volvé al inicio.",
  email_not_verified: "Verificá tu email antes de gestionar el equipo.",
  business_suspended:
    "La cuenta está suspendida. El owner puede consultar el motivo desde el inicio.",
  business_closed: "La cuenta del negocio está cerrada y no admite cambios.",
  staff_create_failed:
    "No pudimos crear al integrante. No se guardó el alta; intentá otra vez.",
  staff_unavailable:
    "El equipo no está disponible en este momento. Intentá nuevamente.",
};

export function errorCopy(payload: ApiFailure | null, fallback: string) {
  return (
    (payload?.code && ERROR_COPY[payload.code]) || payload?.error || fallback
  );
}
