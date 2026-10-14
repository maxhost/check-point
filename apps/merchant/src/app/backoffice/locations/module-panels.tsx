import { MODULES } from "../../../modules/registry";
import type { ModuleScreens } from "../../../modules/ui-registry";

/**
 * Spec 0220 / ADR 0141 §3 — un panel por (modulo con `locationAction` y `locationPanel`, local).
 * Lo arma el servidor en `page.tsx`; `LocationsConsole` hace `router.refresh()` tras crear,
 * editar, archivar o reactivar un local para que se rearme con la lista y los nombres nuevos.
 * Recibe el registro de pantallas por parametro: `UI_SCREENS` trae pantallas de servidor y el
 * harness e2e (que corre en el navegador) pasa solo los paneles.
 */
export function locationModulePanels(
  locations: readonly { id: string; name: string }[],
  screens: Readonly<Record<string, ModuleScreens>>,
) {
  return MODULES.flatMap((module) => {
    const Panel = screens[module.id]?.locationPanel;
    return module.locationAction && Panel
      ? locations.map((location) => ({
          moduleId: module.id,
          locationId: location.id,
          content: (
            <Panel location={{ id: location.id, name: location.name }} />
          ),
        }))
      : [];
  });
}
