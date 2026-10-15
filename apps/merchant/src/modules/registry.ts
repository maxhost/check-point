import type { ModuleManifest } from "./contract";
import { manifest as stock } from "./stock/manifest";
import { manifest as recipes } from "./recipes/manifest";
import { manifest as pos } from "./pos/manifest";
import { manifest as tables } from "./tables/manifest";
import { manifest as profitability } from "./profitability/manifest";

/**
 * Spec 0210 / 0216 — ADR 0138 §1 y ADR 0139 §3 — EL REGISTRO DE MANIFIESTOS: una de las tres
 * puertas entre el core y los modulos (las otras: `server-registry.ts` y `ui-registry.ts`). Es puro
 * (sin base ni servidor) para que cualquiera lo pueda leer. El orden de la lista es el orden de
 * `GET /api/modules`. El POS y Mesas entran en la Fase 2 (spec 0220, ADR 0141).
 *
 * Agregar un modulo = una linea aca (y una en cada uno de los otros dos registros).
 */

export type { ModuleManifest } from "./contract";

export const MODULES: readonly ModuleManifest[] = [
  stock,
  recipes,
  pos,
  tables,
  profitability,
];

export function moduleById(id: unknown): ModuleManifest | null {
  if (typeof id !== "string") return null;
  return MODULES.find((m) => m.id === id) ?? null;
}

/** Los modulos que declaran `id` en su `requires`. */
export function dependentsOf(id: string): ModuleManifest[] {
  return MODULES.filter((m) => m.requires.includes(id));
}
