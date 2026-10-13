import { enabledModuleIds } from "../modules/activation";
import { modulePermissionOwner } from "../modules/permissions";
import { StaffError } from "./staff-error";

/**
 * Spec 0216 / ADR 0139 §5 — **el permiso de un modulo solo se DA con el modulo encendido**: con el
 * modulo apagado, otorgarlo es `422 module_disabled_permission`. Vale para todo modulo del registro
 * (desde la spec 0220 tambien `pos`, que antes tenia su `pos_disabled` propio) y para el alta y el
 * `PATCH`.
 *
 * `alreadyHas` es la lista ACTUAL del target: conservar un permiso que ya tenia no es darlo.
 * Apagar un modulo no borra el permiso de quien lo tiene (queda sin efecto: el despachador corta
 * con `module_disabled`), asi que reenviar el conjunto completo de alguien no falla por eso. Solo
 * consulta la base cuando la lista nueva trae un permiso de modulo que el target no tenia.
 *
 * Archivo propio: `staff-permissions.ts` esta en el limite del hook `file-size`.
 */
export const MODULE_DISABLED_PERMISSION = "module_disabled_permission";

export async function assertModulePermissionsGrantable(
  businessId: string,
  permissions: readonly string[],
  alreadyHas: readonly string[] | null | undefined = [],
): Promise<void> {
  const granted = permissions
    .filter((permission) => !(alreadyHas ?? []).includes(permission))
    .map(modulePermissionOwner)
    .filter((manifest) => manifest !== null);
  if (granted.length === 0) return;
  const enabled = await enabledModuleIds(businessId);
  const disabled = granted.find((manifest) => !enabled.has(manifest.id));
  if (disabled) {
    throw new StaffError(
      422,
      `Activa el módulo ${disabled.name} antes de dar este permiso.`,
      MODULE_DISABLED_PERMISSION,
    );
  }
}
