import { and, eq, sql } from "drizzle-orm";
import { withDbTransaction, type DbTransaction } from "../db";
import { catalogImports, productCategories, products } from "../schema";
import type { ImportResult, ProviderExtraction } from "./types";
import { buildAdditivePlan, type CatalogSnapshot } from "./plan";
import { touch } from "./quota";
import { enqueueImportCleanup, purgeImportObjects } from "./cleanup";

/**
 * Spec 0091 §6 — EL WRITER TRANSACCIONAL. Reemplaza al `accept.ts` del borrador.
 *
 * Lo llama `finishAnalysis` cuando el resultado del proveedor aterriza: **no hay ruta que lo
 * dispare** y no se llama a nuestra propia API por HTTP. Adentro de UNA transaccion se
 * lockea el import, se **relee** el catalogo, se construye el plan aditivo contra esa
 * lectura y se escribe. Nada de proveedor, R2 ni email adentro: eso va despues del commit.
 *
 * **La idempotencia la da el lock mas el estado `accepted`** (ADR 0082 §13.3): un callback
 * repetido y el reconciliador pueden llegar a la vez y el catalogo se escribe una sola vez.
 */
export const EMPTY_RESULT: ImportResult = {
  categoriesCreated: 0,
  categoriesReused: 0,
  productsCreated: 0,
  productsSkipped: 0,
  productsWithoutPrice: 0,
  discardedCount: 0,
  discarded: [],
};

/** `null` = no-op: el import no existe, es de otro negocio o ya no esta en analisis. */
export type WriteOutcome = { created: boolean; result: ImportResult } | null;

export async function writeImportedCatalog(
  importId: string,
  businessId: string,
  extraction: ProviderExtraction,
): Promise<WriteOutcome> {
  const outcome = await withDbTransaction<WriteOutcome>(async (tx) => {
    const [row] = await tx
      .select()
      .from(catalogImports)
      .where(
        and(
          eq(catalogImports.id, importId),
          eq(catalogImports.businessId, businessId),
        ),
      )
      .for("update")
      .limit(1);
    if (!row) return null;
    // §6.2 — **EL CHEQUEO QUE HACE IDEMPOTENTE AL CALLBACK DUPLICADO.** Bajo el lock, un
    // import ya importado devuelve el MISMO resumen guardado y no escribe una sola fila.
    if (row.status === "accepted") {
      return {
        created: false,
        result: (row.acceptedSummary as ImportResult | null) ?? EMPTY_RESULT,
      };
    }
    if (row.status !== "queued" && row.status !== "analyzing") return null;
    const plan = buildAdditivePlan(
      extraction,
      await readCatalog(tx, businessId),
    );

    let categoriesCreated = 0;
    let categoriesReused = 0;
    const rows: {
      businessId: string;
      categoryId: string | null;
      name: string;
      unitPrice: string | null;
      unitCost: null;
      availableAllLocations: true;
    }[] = [];
    for (const category of plan.categories) {
      let categoryId = category.existingId;
      if (categoryId) {
        categoriesReused += 1;
      } else {
        const inserted = await insertOrReuseCategory(
          tx,
          businessId,
          category.name,
        );
        categoryId = inserted.id;
        if (inserted.created) categoriesCreated += 1;
        else categoriesReused += 1;
      }
      for (const product of category.products) {
        rows.push({
          businessId,
          categoryId,
          name: product.name,
          // **`null`, NUNCA `0`** (§4): cero es un precio falso con cara de valido, y el
          // mostrador ya sabe pedirle el precio al operador cuando el producto no lo tiene.
          unitPrice: product.unitPrice,
          unitCost: null,
          availableAllLocations: true,
        });
      }
    }
    // §6.7 — en bulk y **sin una sola fila `product_location`**: nacen disponibles en todos.
    if (rows.length > 0) await tx.insert(products).values(rows);

    const result: ImportResult = {
      categoriesCreated,
      categoriesReused,
      productsCreated: rows.length,
      productsSkipped: plan.productsSkipped,
      productsWithoutPrice: rows.filter((row) => row.unitPrice === null).length,
      discardedCount: plan.discardedCount,
      discarded: plan.discarded,
    };
    await tx
      .update(catalogImports)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        acceptedSummary: result,
        leaseUntil: null,
        ...touch(),
      })
      .where(eq(catalogImports.id, importId));
    return { created: true, result };
  });
  if (outcome?.created) {
    // **Despues del commit** (§6.9): un borrado de R2 adentro alargaria la transaccion
    // sosteniendo el lock, y si fallara no habria nada que revertir igual.
    await enqueueImportCleanup(importId, businessId).catch(() => undefined);
    await purgeImportObjects(importId, businessId).catch(() => undefined);
  }
  return outcome;
}

/**
 * §6.4 — LA RELECTURA, **DENTRO DE LA TRANSACCION**. El catalogo pudo cambiar mientras el
 * proveedor trabajaba: conciliar contra una foto vieja duplicaria lo que se creo entretanto.
 *
 * Las dos consultas llevan su propio `eq(businessId)`: un import **nunca** ve ni escribe el
 * catalogo de otro negocio.
 */
async function readCatalog(
  tx: DbTransaction,
  businessId: string,
): Promise<CatalogSnapshot> {
  const categories = await tx
    .select({
      id: productCategories.id,
      name: productCategories.name,
      createdAt: productCategories.createdAt,
    })
    .from(productCategories)
    .where(eq(productCategories.businessId, businessId));
  const rows = await tx
    .select({
      id: products.id,
      name: products.name,
      categoryId: products.categoryId,
    })
    .from(products)
    .where(eq(products.businessId, businessId));
  return { categories, products: rows };
}

/**
 * §6.6 — UNA CATEGORIA QUE APARECIO EN PARALELO SE REUSA, NO FALLA.
 *
 * El unico `core_product_category_name_unique` es `(business_id, lower(name))`. Si la
 * categoria se creo entre la relectura y este insert, el 23505 **no es un error**: es la
 * respuesta «ya existe», y reusarla nunca destruye nada (ADR 0084 §7).
 *
 * Se resuelve con `on conflict do nothing` y NO atrapando el 23505 a mano: en Postgres una
 * violacion de unicidad **aborta la transaccion entera**, asi que despues de atraparla no se
 * podria releer la categoria ni escribir un solo producto mas.
 */
export async function insertOrReuseCategory(
  tx: DbTransaction,
  businessId: string,
  name: string,
): Promise<{ id: string; created: boolean }> {
  const [inserted] = await tx
    .insert(productCategories)
    .values({ businessId, name })
    .onConflictDoNothing()
    .returning({ id: productCategories.id });
  if (inserted) return { id: inserted.id, created: true };
  const [existing] = await tx
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(
      and(
        eq(productCategories.businessId, businessId),
        sql`lower(${productCategories.name}) = lower(${name})`,
      ),
    )
    .limit(1);
  if (!existing) throw new Error("catalog_import_category_unresolved");
  return { id: existing.id, created: false };
}
