/**
 * Spec 0210 / ADR 0138 §1 y §3 — EL REGISTRO DE MODULOS: la unica puerta entre el core y los
 * modulos. Es puro (sin base ni servidor) para que cualquiera lo pueda leer. El orden de la lista es
 * el orden de `GET /api/modules`. El POS no esta aca hasta su migracion (ADR 0138 §9).
 *
 * `suggestedFor` usa el `gcid:` crudo de `core.business.category_gcid`
 * (`apps/merchant/src/lib/business-categories.ts`): marca el modulo como sugerido, no lo enciende.
 */

export type ModuleManifest = {
  id: string;
  name: string;
  description: string;
  /** Ids de modulos que tienen que estar encendidos para encender este (ADR 0138 §5). */
  requires: readonly string[];
  suggestedFor: readonly string[];
};

const GASTRONOMIA = [
  "gcid:restaurant",
  "gcid:cafe",
  "gcid:bakery",
  "gcid:bar",
  "gcid:pizza_restaurant",
  "gcid:ice_cream_shop",
] as const;

export const MODULES: readonly ModuleManifest[] = [
  {
    id: "stock",
    name: "Stock",
    description: "Insumos, compras y stock estimado",
    requires: [],
    suggestedFor: [
      ...GASTRONOMIA,
      "gcid:pharmacy",
      "gcid:grocery_store",
      "gcid:clothing_store",
      "gcid:pet_store",
    ],
  },
  {
    id: "recipes",
    name: "Recetas",
    description: "Receta de cada producto, costo y margen",
    requires: ["stock"],
    suggestedFor: [...GASTRONOMIA],
  },
];

export function moduleById(id: unknown): ModuleManifest | null {
  if (typeof id !== "string") return null;
  return MODULES.find((m) => m.id === id) ?? null;
}

/** Los modulos que declaran `id` en su `requires`. */
export function dependentsOf(id: string): ModuleManifest[] {
  return MODULES.filter((m) => m.requires.includes(id));
}
