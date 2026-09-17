/**
 * Spec 0069 §D1 / ADR 0070 §7 — la lista CURADA de categorias de negocio.
 *
 * Se guarda el `gcid:` **crudo** de Google Business Profile, no un enum propio: el dia
 * que Google apruebe el Basic API Access esta lista se reemplaza por la API **sin
 * migrar un solo dato**. Las 15 entradas las confirmo el owner el 2026-09-17.
 *
 * El `displayName` es la copia en español que muestra el selector del wizard; el `gcid`
 * es el contrato con la base (`core.business.category_gcid`).
 */
export type BusinessCategory = {
  /** Identificador de Google Business Profile, con su prefijo `gcid:`. */
  gcid: string;
  /** Nombre en español para el selector. */
  displayName: string;
};

export const BUSINESS_CATEGORIES: readonly BusinessCategory[] = [
  { gcid: "gcid:restaurant", displayName: "Restaurante" },
  { gcid: "gcid:cafe", displayName: "Cafetería" },
  { gcid: "gcid:bakery", displayName: "Panadería" },
  { gcid: "gcid:bar", displayName: "Bar" },
  { gcid: "gcid:pizza_restaurant", displayName: "Pizzería" },
  { gcid: "gcid:ice_cream_shop", displayName: "Heladería" },
  { gcid: "gcid:beauty_salon", displayName: "Salón de belleza" },
  { gcid: "gcid:barber_shop", displayName: "Barbería" },
  { gcid: "gcid:nail_salon", displayName: "Salón de uñas" },
  { gcid: "gcid:gym", displayName: "Gimnasio" },
  { gcid: "gcid:pharmacy", displayName: "Farmacia" },
  { gcid: "gcid:grocery_store", displayName: "Tienda de abarrotes" },
  { gcid: "gcid:clothing_store", displayName: "Tienda de ropa" },
  { gcid: "gcid:pet_store", displayName: "Tienda de mascotas" },
  { gcid: "gcid:car_wash", displayName: "Lavado de autos" },
] as const;

const BUSINESS_CATEGORY_SET = new Set(
  BUSINESS_CATEGORIES.map((category) => category.gcid),
);

/**
 * `true` solo para un `gcid:` que este en la lista curada. Es la regla de producto del
 * alta: el DEFAULT `'gcid:store'` de la columna **no** pasa por aca (no esta en la
 * lista) porque es un relleno de migracion, no una categoria elegible.
 *
 * No normaliza: no recorta espacios ni baja a minusculas. El valor viaja desde un
 * selector que la UI arma con esta misma lista, asi que cualquier variante es un valor
 * que el cliente invento.
 */
export function isBusinessCategory(value: unknown): value is string {
  return typeof value === "string" && BUSINESS_CATEGORY_SET.has(value);
}
