/**
 * Spec 0216 / ADR 0139 §2 — LO QUE UN MODULO DECLARA. Puro (sin servidor ni base): lo leen el
 * cliente (menu, Ajustes) y el servidor (despachadores, permisos). Cada modulo exporta su
 * `manifest` desde `modules/<id>/manifest.ts` y `registry.ts` los lista.
 */

/** Un permiso propio del modulo (ADR 0139 §5). `id` cumple `PERMISSION_SHAPE` y no choca con uno
 * del core ni de otro modulo (`registry.test.ts`). */
export type ModulePermission = {
  id: string;
  label: string;
  description: string;
};

/** Una entrada del menu del backoffice. `path` es relativo a `/backoffice/<id>` (`""` = la
 * pantalla principal); `icon` es el nombre de un icono de `iconoir-react` (lo resuelve la UI);
 * `permission` es el que tiene que tener un integrante para verla (el owner las ve todas). */
export type ModuleNavigationEntry = {
  path: string;
  label: string;
  icon: string;
  permission: string;
};

export type ModuleManifest = {
  id: string;
  name: string;
  description: string;
  /** Ids de modulos que tienen que estar encendidos para encender este (ADR 0138 §5). */
  requires: readonly string[];
  /** `gcid:` crudo de `core.business.category_gcid`: marca el modulo como sugerido, no lo enciende. */
  suggestedFor: readonly string[];
  permissions: readonly ModulePermission[];
  navigation: readonly ModuleNavigationEntry[];
};
