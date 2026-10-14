import type { ModuleServer } from "./route-table";
import { routes as stock } from "./stock/server/routes";
import {
  routes as recipes,
  eventSubscriptions as recipeEvents,
} from "./recipes/server/routes";
import { server as pos } from "./pos/server/routes";
import { server as tables } from "./tables/server/routes";

/**
 * Spec 0216 / 0220 — ADR 0139 §3 y ADR 0141 §4 — EL REGISTRO DE SERVIDOR: por modulo, su tabla de
 * rutas de API y, si la tiene, su regla para no apagarse (`beforeDisable`). Solo servidor. Lo leen
 * el despachador `app/api/modules/[moduleId]/[[...path]]/route.ts` (via `modules/dispatch.ts`) y el
 * toggle (`modules/activation.ts`). Un modulo sin API declara `{ routes: [] }`;
 * `modules-boundary.test.ts` exige una entrada por cada modulo del registro.
 *
 * Agregar un modulo = una linea aca.
 */
export const SERVER_MODULES: Readonly<Record<string, ModuleServer>> = {
  stock: { routes: stock },
  recipes: { routes: recipes, eventSubscriptions: recipeEvents },
  pos,
  tables,
};
