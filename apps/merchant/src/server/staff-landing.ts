import { enabledModuleIds } from "../modules/activation";
import {
  memberPermissions,
  modulePermissionOwner,
} from "../modules/permissions";

/**
 * Spec 0218 / ADR 0140 §5 — A DONDE VA UN INTEGRANTE DESPUES DE ENTRAR. Lo calcula el SERVIDOR
 * (`POST /api/merchant/auth/staff` → `staff.landing`) para que pantalla y servidor no diverjan.
 *
 * Decision textual del owner (2026-10-13): «si es una persona con acceso al POS va al pos, si
 * tiene mas accesos entonces va a la pantalla general como el owner pero viendo solo lo que
 * puede ver».
 *
 * Cuentan los permisos EFECTIVOS, los que tienen efecto hoy: `pos` solo con el POS encendido
 * (`core.business.pos_enabled`), un permiso de modulo solo con su modulo encendido, los del core
 * siempre. Sin ningun permiso efectivo tambien va al panel general: si se le niega la entrada es
 * un hallazgo abierto del owner (spec 0218), no una decision tomada aca.
 */

export const STAFF_LANDING_POS = "/backoffice/pos";
export const STAFF_LANDING_PANEL = "/backoffice";

/** Los permisos del integrante que tienen efecto hoy. `stored` es la columna; se normaliza
 * contra el catalogo valido (core + modulos), asi que un valor que ya no existe no cuenta. */
export function effectiveStaffPermissions(
  stored: readonly string[] | null | undefined,
  posEnabled: boolean,
  enabledModules: ReadonlySet<string>,
): string[] {
  return memberPermissions("staff", stored).filter((permission) => {
    if (permission === "pos") return posEnabled === true;
    const declaredBy = modulePermissionOwner(permission);
    return declaredBy === null || enabledModules.has(declaredBy.id);
  });
}

/** Exactamente `{pos}` → el POS; cualquier otro conjunto (tambien el vacio) → el panel. */
export function staffLanding(effective: readonly string[]): string {
  return effective.length === 1 && effective[0] === "pos"
    ? STAFF_LANDING_POS
    : STAFF_LANDING_PANEL;
}

/** La lectura: los modulos encendidos del negocio (`pos_enabled` ya viene en la fila del
 * login, que lo lee en el mismo `innerJoin(businesses)`). */
export async function readStaffLanding(member: {
  businessId: string;
  permissions: readonly string[] | null;
  posEnabled: boolean;
}): Promise<string> {
  const modules = await enabledModuleIds(member.businessId);
  return staffLanding(
    effectiveStaffPermissions(member.permissions, member.posEnabled, modules),
  );
}
