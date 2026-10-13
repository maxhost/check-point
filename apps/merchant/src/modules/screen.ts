import type { ComponentType } from "react";
import { ModuleError } from "./errors";
import { requireModule } from "./guard";
import { moduleById } from "./registry";
import { UI_SCREENS } from "./ui-registry";

/**
 * Spec 0216 / ADR 0139 §4 — LA DECISION DEL DESPACHADOR DE PANTALLAS, separada de la pagina para
 * poder probarla sin Next. Devuelve la pantalla de `ui-registry` para `/backoffice/<moduleId>/<path>`
 * o `null` (la pagina contesta `notFound()`):
 *
 * 1. el modulo esta en el registro y declara pantallas;
 * 2. `path` tiene pantalla (`""` = la principal);
 * 3. el modulo esta ENCENDIDO para el negocio de la sesion (`requireModule`);
 * 4. el caller es owner o tiene el permiso de la entrada de menu de ese `path` (si el `path` no
 *    esta en el menu, el primer permiso que declara el modulo).
 *
 * Un error que no es `ModuleError` (la base caida) se propaga: no es un «no existe».
 */

export type ScreenViewer = {
  business: { id: string };
  membership: { role: string; permissions: readonly string[] };
};

export async function moduleScreen(
  viewer: ScreenViewer,
  moduleId: string,
  path: readonly string[],
): Promise<ComponentType | null> {
  const manifest = moduleById(moduleId);
  if (!manifest || !Object.hasOwn(UI_SCREENS, manifest.id)) return null;
  const { screens } = UI_SCREENS[manifest.id];
  const key = path.join("/");
  if (!Object.hasOwn(screens, key)) return null;
  try {
    await requireModule(viewer.business.id, manifest.id);
  } catch (error) {
    if (error instanceof ModuleError) return null;
    throw error;
  }
  const permission =
    manifest.navigation.find((entry) => entry.path === key)?.permission ??
    manifest.permissions[0]?.id ??
    null;
  const allowed =
    viewer.membership.role === "owner" ||
    (permission !== null && viewer.membership.permissions.includes(permission));
  return allowed ? screens[key] : null;
}
