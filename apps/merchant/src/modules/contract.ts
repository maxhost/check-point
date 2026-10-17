/**
 * Spec 0216 / ADR 0139 §2 — LO QUE UN MODULO DECLARA. Puro (sin servidor ni base): lo leen el
 * cliente (menu, Ajustes) y el servidor (despachadores, permisos). Cada modulo exporta su
 * `manifest` desde `modules/<id>/manifest.ts` y `registry.ts` los lista.
 *
 * Spec 0220 / ADR 0141: los puntos de enganche que pidieron el POS y Mesas (`optional`,
 * `operation`, `startPage`, `locationAction`), todos genericos.
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

/** ADR 0141 §1 — la PANTALLA DE OPERACION: en `/backoffice/<id>/…` la barra movil del core muestra
 * las entradas del modulo y un boton principal que dispara `checkpass:module-primary` con
 * `detail: { moduleId }`; el aviso de prueba sale solo en los ultimos 7 dias. */
export type ModuleOperation = {
  primaryAction: { label: string; icon: string };
};

/** ADR 0141 §2 — la PAGINA DE INICIO (PWA e ingreso del personal). `path` es relativo a
 * `/backoffice/<id>`; `permission`, el que tiene que tener el usuario (el owner los tiene todos). */
export type ModuleStartPage = { path: string; permission: string };

/** ADR 0141 §3 — un boton por local en Locales, que abre el `locationPanel` de `ui-registry`. */
export type ModuleLocationAction = {
  label: string;
  icon?: string;
  permission: string;
};

export type ModuleManifest = {
  id: string;
  name: string;
  description: string;
  /** Ids de modulos que tienen que estar encendidos para encender este (ADR 0138 §5). El modulo
   * puede IMPORTAR codigo y tablas de estos (ADR 0141 §5). */
  requires: readonly string[];
  /** ADR 0141 §5 — modulos que este USA si estan encendidos y sin ellos degrada. Los puede NOMBRAR
   * (consultar si estan encendidos) pero no importar; no generan 409 de dependencia. */
  optional?: readonly string[];
  /** `gcid:` crudo de `core.business.category_gcid`: marca el modulo como sugerido, no lo enciende. */
  suggestedFor: readonly string[];
  permissions: readonly ModulePermission[];
  navigation: readonly ModuleNavigationEntry[];
  /** ADR 0139 §2 — aporta un panel a Ajustes (lo dibuja `ui/`, via `ui-registry`). */
  settingsPanel?: true;
  operation?: ModuleOperation;
  startPage?: ModuleStartPage;
  locationAction?: ModuleLocationAction;
};
