import type { ComponentType } from "react";
import { StockLog } from "../app/backoffice/stock/stock-log";
import { RecipesConsole } from "../app/backoffice/recipes/recipes-console";

/**
 * Spec 0216 / ADR 0139 §3 y §4 — EL REGISTRO DE PANTALLAS: por modulo, la pantalla de cada `path`
 * bajo `/backoffice/<id>` (`""` = la principal). Lo lee el despachador
 * `app/backoffice/[module]/[[...path]]/page.tsx`, que ya aplico sesion, modulo encendido y permiso.
 *
 * ARRANCA APUNTANDO A LAS PANTALLAS ACTUALES (`app/backoffice/{stock,recipes}/`, zona GPT) para que
 * nada se rompa: GPT las muda a `modules/<id>/ui/` y cambia estas lineas (encargo de la Fase 1).
 * Mientras esas carpetas existan, Next resuelve `/backoffice/stock` con la pagina estatica y no con
 * el despachador (los segmentos fijos le ganan a `[module]`).
 *
 * Agregar un modulo = una linea aca. Un modulo sin pantallas declara `{ screens: {} }`.
 */
export type ModuleScreens = {
  screens: Readonly<Record<string, ComponentType>>;
};

export const UI_SCREENS: Readonly<Record<string, ModuleScreens>> = {
  stock: { screens: { "": StockLog } },
  recipes: { screens: { "": RecipesConsole } },
};
