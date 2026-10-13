import type { ComponentType } from "react";
import { StockLog } from "./stock/ui/stock-log";
import { RecipesConsole } from "./recipes/ui/recipes-console";

/**
 * Spec 0216 / ADR 0139 §3 y §4 — EL REGISTRO DE PANTALLAS: por modulo, la pantalla de cada `path`
 * bajo `/backoffice/<id>` (`""` = la principal). Lo lee el despachador
 * `app/backoffice/[module]/[[...path]]/page.tsx`, que ya aplico sesion, modulo encendido y permiso.
 *
 * Las pantallas viven en modules/<id>/ui; Next usa el despachador generico.
 *
 * Agregar un modulo = una linea aca. Un modulo sin pantallas declara `{ screens: {} }`.
 */
export type ModuleScreens = {
  screens: Readonly<Record<string, ComponentType>>;
  /** Spec 0220 / ADR 0141 §3 — el panel que abre el boton del modulo en Locales (si el manifiesto
   * declara `locationAction`). */
  locationPanel?: ComponentType<{ location: { id: string; name: string } }>;
};

export const UI_SCREENS: Readonly<Record<string, ModuleScreens>> = {
  stock: { screens: { "": StockLog } },
  recipes: { screens: { "": RecipesConsole } },
  // Spec 0220: las pantallas del POS y el panel de Mesas los pone GPT en la 2b
  // (`modules-boundary.test.ts`, `PENDING_GPT_SCREENS`).
  pos: { screens: {} },
  tables: { screens: {} },
};
