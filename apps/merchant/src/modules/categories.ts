/**
 * Spec 0220 — LOS RUBROS QUE COMPARTEN LOS MANIFIESTOS para `suggestedFor`. Core de modulos, puro y
 * sin ids de modulo: lo importan los manifiestos (stock, recetas, POS, mesas) en vez de importarse
 * entre si. Los `gcid:` salen de la lista curada del alta (`lib/business-categories.ts`).
 */

/** Los rubros gastronomicos. */
export const GASTRONOMIA = [
  "gcid:restaurant",
  "gcid:cafe",
  "gcid:bakery",
  "gcid:bar",
  "gcid:pizza_restaurant",
  "gcid:ice_cream_shop",
] as const;
