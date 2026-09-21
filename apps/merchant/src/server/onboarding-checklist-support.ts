import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { GET } from "../app/api/onboarding/checklist/route";

/**
 * Soporte de `onboarding-checklist.neon.integration.test.ts` (spec 0085). Existe **por el hook
 * `file-size`**: con los casos del `done` de un tour adentro, ese archivo medía 320 líneas y el
 * límite es 300 — la regla del repo es dividir, no extender, y **no se borra una aserción para
 * hacer lugar**. Mismo motivo y misma forma que `onboarding-tours-support.ts`.
 *
 * **Acá no hay ni un `expect`**: los oráculos siguen todos en el test. Esto es sólo el montaje,
 * y todo lo de acá escribe o lee la base REAL — no dobla nada.
 */

/** La forma del item tal como SALE POR HTTP. El cuerpo llega como `any` de un `json()`, y sin
 * esto cada `map` sobre `body.items` sería un `any` implícito que el lint rechaza. */
export type ChecklistItemJson = {
  id: string;
  position: number;
  required: boolean;
  done: boolean;
  anchor: string;
};

/** Pega contra la ruta con la cookie que se le pase; `null` manda el pedido SIN sesión. */
export const getChecklist = (cookie: string | null) =>
  GET(
    new Request("http://localhost:3001/api/onboarding/checklist", {
      headers: cookie ? { cookie } : {},
    }),
  );

/**
 * La fila de progreso, escrita con **SQL CRUDO y no con `recordTourProgress`**: el montaje de
 * un oráculo no se arma con la pieza de producción que ese oráculo podría estar midiendo. El
 * `on conflict` es del montaje, no del invariante — acá se quiere el estado pedido, sin el
 * no-degradado que la escritura real aplica (eso tiene su propio oráculo en la spec 0084).
 */
export const seedTour = (businessId: string, tourId: string, status: string) =>
  getDb().execute(
    sql`insert into core.business_onboarding_tour (business_id, tour_id, status)
         values (${businessId}, ${tourId}, ${status})
         on conflict (business_id, tour_id) do update set status = excluded.status`,
  );

/** Los tres montajes que ya existían para la suite de la 0084 y sirven igual acá: se
 * RE-EXPORTAN en vez de copiarse, así el test tiene un solo módulo de soporte que importar. */
export {
  setBusinessStatus,
  setVerified,
  wipeTours,
} from "./onboarding-tours-support";
