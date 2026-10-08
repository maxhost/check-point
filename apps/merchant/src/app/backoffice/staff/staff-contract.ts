import type { PermissionScope } from "@mi-pasaporte/db/permissions-catalog";

/**
 * LA COPIA DE LOS OCHO PERMISOS PARA LA PANTALLA. **No es una lista propia de ids.**
 *
 * `@mi-pasaporte/db/permissions-catalog` declara el conjunto CERRADO (el mismo que el `CHECK` de la
 * migracion 0041) y dice explicitamente por que no tiene un solo `import`: para que nadie
 * tenga que copiar el arreglo. Esta pantalla es su quinta consumidora, asi que **toma el
 * tipo de alla**: `Record<PermissionScope, …>` hace que un permiso nuevo en el catalogo
 * **NO COMPILE** aca hasta que se le escriba su copy — misma forma y mismo motivo que el
 * `TOUR_COPY` de `server/onboarding/checklist.ts`. Sin esto, agregar un permiso al `CHECK`
 * dejaba una pantalla que no lo ofrece nunca, y sin un solo rojo.
 *
 * El ORDEN es de producto y a proposito NO es el del catalogo (que es alfabetico): primero el
 * recomendado (`counter`), ultimo el peligroso (`staff`). ORACULO DE ESA COBERTURA: el caso
 * «ofrece exactamente los siete permisos del catalogo» de `staff-contract.test.ts`, que
 * compara los dos conjuntos ordenados y por eso no depende de este orden.
 */
const PERMISSION_COPY: Record<
  PermissionScope,
  { label: string; detail: string }
> = {
  counter: {
    label: "Mostrador",
    detail: "Acreditar compras y canjear premios.",
  },
  catalog: {
    label: "Catálogo",
    detail: "Ver, crear y editar productos y categorías.",
  },
  locations: {
    label: "Locales",
    detail: "Ver, crear, editar y activar locales.",
  },
  loyalty: {
    label: "Programa de fidelización",
    detail: "Configurar el programa, sus premios y diseño.",
  },
  marketing: {
    label: "Campañas",
    detail: "Crear, editar, pausar y activar campañas.",
  },
  pos: {
    label: "POS",
    detail: "Abrir, editar, cobrar y anular órdenes de mesa.",
  },
  brand: {
    label: "Marca",
    detail: "Editar la identidad visual del negocio.",
  },
  staff: {
    label: "Administrador",
    detail: "Acceso total a la configuración y al alta de integrantes.",
  },
};

const PERMISSION_ORDER: readonly PermissionScope[] = [
  "counter",
  "catalog",
  "locations",
  "loyalty",
  "marketing",
  "pos",
  "brand",
  "staff",
];

export const PERMISSIONS: readonly {
  id: PermissionScope;
  label: string;
  detail: string;
}[] = PERMISSION_ORDER.map((id) => ({ id, ...PERMISSION_COPY[id] }));

export type Permission = PermissionScope;

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
    "No pudimos leer los datos enviados. Revisa el formulario e intenta otra vez.",
  name_required: "Escribe el nombre del integrante.",
  name_too_long: "El nombre puede tener hasta 80 caracteres.",
  permissions_not_here:
    "El nombre y los permisos se guardan por separado. Vuelve a intentar.",
  permissions_required:
    "Elige al menos un permiso. Si no debe tener acceso, desactiva al integrante.",
  unknown_permission:
    "Hay un permiso que ya no es válido. Recarga la pantalla e intenta otra vez.",
  permission_not_grantable:
    "Solo la persona propietaria puede otorgar o quitar el acceso de Administrador.",
  self_permission_edit:
    "No puedes editar tus propios permisos. Pide ayuda a otra persona con acceso a Equipo.",
  target_is_owner:
    "No puedes modificar desde Equipo el acceso de la persona propietaria.",
  target_is_administrator:
    "Solo la persona propietaria puede regenerar el PIN o dar de baja a un Administrador.",
  target_disabled:
    "Este integrante está dado de baja. Reactívalo y después vuelve a guardar el nombre.",
  handle_taken:
    "Ese identificador se ocupó al mismo tiempo. Intenta guardar nuevamente.",
  staff_not_found: "El integrante ya no está disponible. Actualiza el listado.",
  invalid_status: "El estado solicitado no es válido. Recarga la pantalla.",
  invalid_target: "El integrante no es válido. Recarga la pantalla.",
  unauthorized: "Tu sesión venció. Vuelve a ingresar.",
  not_member:
    "Tu usuario ya no tiene acceso activo. Vuelve a ingresar o contacta a la persona propietaria.",
  missing_permission:
    "Ya no tienes permiso para gestionar el equipo. Vuelve al inicio.",
  email_not_verified: "Verifica tu email antes de gestionar el equipo.",
  business_suspended:
    "La cuenta está suspendida. La persona propietaria puede consultar el motivo desde el inicio.",
  business_closed: "La cuenta del negocio está cerrada y no admite cambios.",
  staff_create_failed:
    "No pudimos crear al integrante. No se guardó el alta; intenta otra vez.",
  staff_unavailable:
    "El equipo no está disponible en este momento. Intenta nuevamente.",
};

export function errorCopy(payload: ApiFailure | null, fallback: string) {
  return (
    (payload?.code && ERROR_COPY[payload.code]) || payload?.error || fallback
  );
}
