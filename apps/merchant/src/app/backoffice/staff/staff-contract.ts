import type { PermissionScope } from "../../../server/permissions-catalog";

/**
 * LA COPIA DE LOS SIETE PERMISOS PARA LA PANTALLA. **No es una lista propia de ids.**
 *
 * `server/permissions-catalog.ts` declara el conjunto CERRADO (el mismo que el `CHECK` de la
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
  target_is_administrator:
    "Sólo el owner puede regenerar el PIN o dar de baja a un Administrador.",
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
