import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { catalogImports } from "../schema";
import { CATALOG_IMPORT_OPEN_STATUSES } from "../schema/catalog-import";
import { CatalogError } from "./core";

/**
 * ADR 0086 / spec 0092 §3 — **EL ALTA MANUAL SE BLOQUEA MIENTRAS SE IMPORTA.**
 *
 * El writer de la importacion relee el catalogo DENTRO de su transaccion y despues inserta;
 * en esa ventana otra sesion puede escribir. Eso dejaba dos carreras vivas: el 23505 de
 * `core_product_category_name_unique` (que el writer recupera) y el producto duplicado (que
 * la spec 0091 declaro afuera). En vez de resolverlas, el owner eligio **volverlas
 * imposibles por el camino normal**: mientras el negocio tiene un import ABIERTO, crear una
 * categoria o un producto a mano devuelve 409.
 *
 * **La lista de estados abiertos es la del esquema** (`CATALOG_IMPORT_OPEN_STATUSES`), la
 * misma que consume `activeImport` y la misma que repite el indice unico parcial. No se
 * escribe una segunda: dos listas que tienen que coincidir son un bug esperando.
 *
 * **Esto NO cierra la ventana del todo** (declarado en la spec): se mira el estado en el
 * instante del alta, asi que dos requests exactamente simultaneas siguen pudiendo cruzarse.
 * Por eso la recuperacion del 23505 del writer **no se borra**.
 *
 * Lo llaman `createCategory` y `createProduct`, y **nadie mas**: editar, renombrar y borrar
 * no compiten con el writer, que es estrictamente aditivo y nunca toca lo que ya existe.
 */
export const CATALOG_IMPORT_IN_PROGRESS = "catalog_import_in_progress";

/** Si el negocio tiene un import en alguno de los cuatro estados no terminales. */
export async function hasOpenImport(businessId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: catalogImports.id })
    .from(catalogImports)
    .where(
      and(
        eq(catalogImports.businessId, businessId),
        inArray(catalogImports.status, [...CATALOG_IMPORT_OPEN_STATUSES]),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Tira `409 catalog_import_in_progress` si hay un import abierto. El `code` viaja porque el
 * dominio catalogo **no tiene lista cerrada de codigos** y la pantalla no puede distinguir
 * este 409 de otro conflicto leyendo el texto.
 */
export async function assertNoOpenImport(businessId: string): Promise<void> {
  if (!(await hasOpenImport(businessId))) return;
  throw new CatalogError(
    409,
    "Estamos importando tu menú. Cuando termine vas a poder volver a cargar a mano.",
    CATALOG_IMPORT_IN_PROGRESS,
  );
}
