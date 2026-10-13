import type { ModuleNavigationEntry } from "./contract";

/**
 * Spec 0216 / ADR 0139 §6 — LAS ENTRADAS DE MENU QUE APORTAN LOS MODULOS, puro. Lo usa el menu del
 * backoffice (zona GPT) con lo que devuelve `GET /api/modules`: el menu no nombra ningun modulo.
 *
 * Una entrada sale si el modulo esta ENCENDIDO y el usuario es owner o tiene el permiso de la
 * entrada. `href` es `/backoffice/<id>` + `path` (`""` = la pantalla principal).
 */

export type NavigableModule = {
  id: string;
  enabled: boolean;
  navigation: readonly ModuleNavigationEntry[];
};

export type ModuleMenuEntry = {
  moduleId: string;
  href: string;
  label: string;
  icon: string;
  permission: string;
};

export function moduleHref(moduleId: string, path: string): string {
  const base = `/backoffice/${moduleId}`;
  return path ? `${base}/${path}` : base;
}

export function moduleNavigation(
  modules: readonly NavigableModule[],
  viewer: { isOwner: boolean; permissions: readonly string[] },
): ModuleMenuEntry[] {
  return modules
    .filter((m) => m.enabled === true)
    .flatMap((m) =>
      m.navigation
        .filter(
          (entry) =>
            viewer.isOwner || viewer.permissions.includes(entry.permission),
        )
        .map((entry) => ({
          moduleId: m.id,
          href: moduleHref(m.id, entry.path),
          label: entry.label,
          icon: entry.icon,
          permission: entry.permission,
        })),
    );
}
