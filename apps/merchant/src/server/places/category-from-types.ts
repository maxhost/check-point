/**
 * Spec 0155 / ADR 0121 §6 — la categoria SUGERIDA de un lugar de Google, desde sus `types`
 * (SKU Essentials; `primaryType` es Pro y no se pide).
 *
 * La tabla va de mas especifico a mas general: un lugar con `["cafe", "restaurant"]` es una
 * cafeteria, no un restaurante. El primer renglon con un tipo presente gana. El ultimo
 * renglon ademas acepta cualquier `*_restaurant` (`italian_restaurant`, …), que Google usa
 * mucho mas que `restaurant` a secas.
 *
 * Cada `gcid` de aca esta en la lista curada (`lib/business-categories.ts`): lo asevera
 * `category-from-types.test.ts` recorriendo la tabla.
 */
export const CATEGORY_BY_TYPES: readonly {
  types: readonly string[];
  gcid: string;
}[] = [
  { types: ["pizza_restaurant"], gcid: "gcid:pizza_restaurant" },
  { types: ["ice_cream_shop"], gcid: "gcid:ice_cream_shop" },
  { types: ["bakery"], gcid: "gcid:bakery" },
  { types: ["cafe", "coffee_shop"], gcid: "gcid:cafe" },
  { types: ["bar", "pub", "wine_bar"], gcid: "gcid:bar" },
  { types: ["barber_shop"], gcid: "gcid:barber_shop" },
  { types: ["nail_salon"], gcid: "gcid:nail_salon" },
  {
    types: ["beauty_salon", "hair_salon", "hair_care"],
    gcid: "gcid:beauty_salon",
  },
  { types: ["gym", "fitness_center"], gcid: "gcid:gym" },
  { types: ["pharmacy", "drugstore"], gcid: "gcid:pharmacy" },
  {
    types: ["grocery_store", "supermarket", "convenience_store"],
    gcid: "gcid:grocery_store",
  },
  { types: ["clothing_store"], gcid: "gcid:clothing_store" },
  { types: ["pet_store"], gcid: "gcid:pet_store" },
  { types: ["car_wash"], gcid: "gcid:car_wash" },
  { types: ["restaurant"], gcid: "gcid:restaurant" },
];

const RESTAURANT_GCID = "gcid:restaurant";

export function categoryFromTypes(types: readonly string[]): string | null {
  for (const row of CATEGORY_BY_TYPES) {
    if (row.types.some((type) => types.includes(type))) return row.gcid;
    if (
      row.gcid === RESTAURANT_GCID &&
      types.some((type) => type.endsWith("_restaurant"))
    )
      return row.gcid;
  }
  return null;
}
