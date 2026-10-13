import { enabledModuleIds } from "../modules/activation";
import {
  memberPermissions,
  modulePermissionOwner,
} from "../modules/permissions";
import { staffStartPage } from "../modules/start-page";

/**
 * Spec 0218 / ADR 0140 §5 — A DONDE VA UN INTEGRANTE DESPUES DE ENTRAR. Lo calcula el SERVIDOR
 * (`POST /api/merchant/auth/staff` → `staff.landing`) para que pantalla y servidor no diverjan.
 *
 * Decision textual del owner (2026-10-13): «si es una persona con acceso al POS va al pos, si
 * tiene mas accesos entonces va a la pantalla general como el owner pero viendo solo lo que
 * puede ver». Spec 0220 / ADR 0141 §2: generalizada sin nombrar el POS — si sus permisos EFECTIVOS
 * son exactamente el de la pagina de inicio (`startPage`) de un modulo encendido, esa pagina.
 *
 * Cuentan los permisos EFECTIVOS, los que tienen efecto hoy: un permiso de modulo solo con su modulo
 * encendido, los del core siempre. Sin ningun permiso efectivo tambien va al panel general: si se le
 * niega la entrada es un hallazgo abierto del owner (spec 0218), no una decision tomada aca.
 */

export const STAFF_LANDING_PANEL = "/backoffice";

/** Los permisos del integrante que tienen efecto hoy. `stored` es la columna; se normaliza
 * contra el catalogo valido (core + modulos), asi que un valor que ya no existe no cuenta. */
export function effectiveStaffPermissions(
  stored: readonly string[] | null | undefined,
  enabledModules: ReadonlySet<string>,
): string[] {
  return memberPermissions("staff", stored).filter((permission) => {
    const declaredBy = modulePermissionOwner(permission);
    return declaredBy === null || enabledModules.has(declaredBy.id);
  });
}

/** La pagina de inicio del modulo si `effective` es exactamente su permiso; si no, el panel. */
export function staffLanding(
  effective: readonly string[],
  enabledModules: ReadonlySet<string>,
): string {
  return staffStartPage(effective, enabledModules) ?? STAFF_LANDING_PANEL;
}

/** La lectura: los modulos encendidos del negocio. */
export async function readStaffLanding(member: {
  businessId: string;
  permissions: readonly string[] | null;
}): Promise<string> {
  const modules = await enabledModuleIds(member.businessId);
  return staffLanding(
    effectiveStaffPermissions(member.permissions, modules),
    modules,
  );
}
