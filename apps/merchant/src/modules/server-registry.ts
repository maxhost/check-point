import type { ModuleRoute } from "./route-table";
import { routes as stock } from "./stock/server/routes";
import { routes as recipes } from "./recipes/server/routes";

/**
 * Spec 0216 / ADR 0139 §3 — EL REGISTRO DE SERVIDOR: por modulo, su tabla de rutas de API. Solo
 * servidor. Lo lee el despachador `app/api/modules/[moduleId]/[[...path]]/route.ts` (via
 * `modules/dispatch.ts`). Un modulo sin API declara `[]`; `modules-boundary.test.ts` exige una
 * entrada por cada modulo del registro.
 *
 * Agregar un modulo = una linea aca.
 */
export const SERVER_ROUTES: Readonly<Record<string, readonly ModuleRoute[]>> = {
  stock,
  recipes,
};
