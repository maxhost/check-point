import { parseOptionalMoney } from "../catalog/validation";
import { CatalogError } from "../catalog/core";
import type { DiscardedItem, ProviderExtraction } from "./types";

/**
 * Spec 0091 §2/§3/§4 — LA CONCILIACION, **PURA Y SIN BASE**.
 *
 * Todo lo que decide que se crea y que se omite vive aca, sin `getDb`, sin `tx` y sin fecha:
 * la decision se puede aseverar con una tabla de entradas y salidas. El writer
 * (`write.ts`) solo ejecuta el plan.
 *
 * La operacion es **siempre aditiva** (ADR 0084 §1): crea lo que falta, reusa lo que existe y
 * **nunca** actualiza ni borra nada. Por eso ninguna rama de este archivo produce un `update`
 * ni una eleccion destructiva.
 */

/** El catalogo ACTUAL del negocio, releido dentro de la transaccion que escribe (§6.4). */
export type CatalogSnapshot = {
  categories: { id: string; name: string; createdAt: Date }[];
  products: { id: string; name: string; categoryId: string | null }[];
};

export type PlannedProduct = { name: string; unitPrice: string | null };

export type PlannedCategory = {
  /** La clave canonica con la que se concilio. */
  key: string;
  /** El nombre tal como lo leyo el proveedor, en su primera aparicion. */
  name: string;
  /** La categoria existente que se reusa, o `null` si hay que crearla. */
  existingId: string | null;
  /** Solo los productos que hay que CREAR. Los que ya existen no llegan hasta aca. */
  products: PlannedProduct[];
};

export type AdditivePlan = {
  categories: PlannedCategory[];
  categoriesReused: number;
  productsSkipped: number;
  productsWithoutPrice: number;
  discarded: DiscardedItem[];
  discardedCount: number;
};

/** §5 — el resumen lista como maximo 50 descartes; el resto se cuenta en `discardedCount`. */
export const MAX_DISCARDED_LISTED = 50;

/**
 * §2 — LA CLAVE CANONICA. NFKD, sin marcas, minusculas, puntuacion y separadores a espacio,
 * espacios colapsados.
 *
 * **No es fuzzy matching y no reemplaza al indice unico real** (`core_product_category_name_
 * unique`, que es `lower(name)`): se usa SOLO para conciliar esta importacion. «Coca-Cola» =
 * «coca cola»; «Hamburguesa» ≠ «Hamburguesa doble».
 */
export function matchKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[\p{P}\p{Z}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * §4 — EL PRECIO LO DECIDE EL SERVIDOR, a partir del texto impreso.
 *
 * El proveedor ya no manda un `priceStatus`: manda el fragmento y **esta funcion** decide.
 * Mover la decision del modelo al servidor es lo que la vuelve testeable.
 *
 * La regla: se recorta el ruido de los BORDES (simbolo de moneda, «c/u», espacios) y nada del
 * medio —por eso `"$ 3,25"` parsea y `"3-5"` no, porque el guion queda adentro—; el ULTIMO
 * separador seguido de **exactamente 2** digitos es el decimal y cualquier otro es de miles
 * (y un separador de miles lleva exactamente 3 digitos). Mas de un candidato a decimal, cero
 * digitos, un signo, un rango o cualquier otra cosa devuelven **`null`**: un producto sin
 * precio es seguro (`counter/grant.ts` se lo pide al operador), un `0` es un precio falso con
 * cara de valido.
 */
export function parsePriceText(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;
  const core = value.replace(/^[^0-9.,+-]+/, "").replace(/[^0-9.,+-]+$/, "");
  if (!/^[0-9.,]+$/.test(core)) return null;
  const groups = core.split(/[.,]/);
  if (groups.some((group) => group.length === 0)) return null;
  const candidates: number[] = [];
  for (let i = 1; i < groups.length; i += 1) {
    if (groups[i].length === 2) candidates.push(i);
  }
  if (candidates.length > 1) return null;
  const last = groups.length - 1;
  if (candidates.length === 1 && candidates[0] !== last) return null;
  const fraction = candidates.length === 1 ? groups[last] : "";
  const integers = candidates.length === 1 ? groups.slice(0, last) : groups;
  if (integers.length > 1) {
    if (integers[0].length > 3) return null;
    if (integers.slice(1).some((group) => group.length !== 3)) return null;
  }
  const whole = integers.join("");
  const numeric = fraction ? `${whole}.${fraction}` : whole;
  try {
    // `parseOptionalMoney` es EL parser de dinero del repo: no nace una segunda aritmetica.
    return parseOptionalMoney(numeric, "El precio");
  } catch (error) {
    if (error instanceof CatalogError) return null;
    throw error;
  }
}

/**
 * §3 — EL PLAN ADITIVO.
 *
 * Categoria: match canonico contra las existentes → se reusa; empate entre dos existentes →
 * la de `createdAt` menor (reusar nunca destruye, asi que no hay que preguntarle a nadie);
 * sin match → se crea. Dos categorias extraidas con la misma clave se agrupan en una, en
 * orden de primera aparicion, y **una categoria nueva sin un solo producto a crear no se
 * crea**.
 *
 * Producto: se compara **SOLO** contra los productos existentes de la categoria conciliada y
 * contra los ya planificados por esta misma importacion. El producto de una categoria nueva
 * no se compara con nada, porque «Agua» en dos categorias son dos productos legitimos.
 */
export function buildAdditivePlan(
  extraction: ProviderExtraction,
  snapshot: CatalogSnapshot,
): AdditivePlan {
  const existingCategories = categoriesByKey(snapshot);
  const existingProducts = productKeysByCategory(snapshot);
  const planned = new Map<string, PlannedCategory>();
  const order: string[] = [];
  const taken = new Map<string, Set<string>>();
  let productsSkipped = 0;

  for (const category of extraction.categories) {
    const key = matchKey(category.name);
    let entry = planned.get(key);
    if (!entry) {
      const existing = existingCategories.get(key) ?? null;
      entry = {
        key,
        name: category.name,
        existingId: existing?.id ?? null,
        products: [],
      };
      planned.set(key, entry);
      order.push(key);
      taken.set(
        key,
        new Set(existing ? (existingProducts.get(existing.id) ?? []) : []),
      );
    }
    const vistos = taken.get(key) as Set<string>;
    for (const product of category.products) {
      const productKey = matchKey(product.name);
      // Match (uno o varios) → se OMITE. No hay que elegir entre dos: no se modifica ninguno.
      if (vistos.has(productKey)) {
        productsSkipped += 1;
        continue;
      }
      vistos.add(productKey);
      entry.products.push({
        name: product.name,
        unitPrice: parsePriceText(product.priceText),
      });
    }
  }

  const categories = order
    .map((key) => planned.get(key) as PlannedCategory)
    .filter((entry) => entry.existingId !== null || entry.products.length > 0);
  return {
    categories,
    categoriesReused: categories.filter((entry) => entry.existingId !== null)
      .length,
    productsSkipped,
    productsWithoutPrice: categories.reduce(
      (total, entry) =>
        total + entry.products.filter((p) => p.unitPrice === null).length,
      0,
    ),
    discarded: extraction.discarded.slice(0, MAX_DISCARDED_LISTED),
    discardedCount: extraction.discarded.length,
  };
}

/**
 * Las categorias existentes por clave canonica. **El empate lo gana la mas vieja** (§3), y
 * cuando dos comparten `createdAt` desempata el `id`: el plan tiene que ser una funcion del
 * catalogo, no del orden en que la base devolvio las filas.
 */
function categoriesByKey(
  snapshot: CatalogSnapshot,
): Map<string, { id: string; createdAt: Date }> {
  const out = new Map<string, { id: string; createdAt: Date }>();
  for (const category of snapshot.categories) {
    const key = matchKey(category.name);
    const current = out.get(key);
    const gana =
      !current ||
      category.createdAt.getTime() < current.createdAt.getTime() ||
      (category.createdAt.getTime() === current.createdAt.getTime() &&
        category.id < current.id);
    if (gana) out.set(key, { id: category.id, createdAt: category.createdAt });
  }
  return out;
}

/**
 * Las claves de los productos existentes, **agrupadas por categoria**. Un producto sin
 * categoria no entra: no hay categoria conciliada contra la cual compararlo.
 */
function productKeysByCategory(
  snapshot: CatalogSnapshot,
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const product of snapshot.products) {
    if (!product.categoryId) continue;
    const set = out.get(product.categoryId) ?? new Set<string>();
    set.add(matchKey(product.name));
    out.set(product.categoryId, set);
  }
  return out;
}
