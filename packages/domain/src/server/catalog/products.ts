import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getDb, withDbTransaction, type DbTransaction } from "@mi-pasaporte/db";
import { productLocations, products } from "@mi-pasaporte/db/schema";
import {
  CatalogError,
  type OwnerBusiness,
  type ProductRecord,
  productColumns,
  uuidPattern,
} from "./core";
import {
  validateProductInput,
  assertCategory,
  assertLocations,
} from "./validation";
import { assertNoOpenImport } from "./import-guard";
import { resolveImageChange } from "./image";
import { cleanupProductPrefixNow } from "./cleanup";

import {
  catalogPrice,
  lockBusiness,
  normalizedDecimal,
  productBody,
  catalogProductDTO,
  parseCatalogMeasure,
  prepareCatalogUpdate,
  assertMeasureUnit,
  parseSalesRevision,
  rethrowCatalogWriteError,
  type CatalogOptions,
} from "./measured-contract";

async function syncLocations(
  db: DbTransaction,
  productId: string,
  availableAllLocations: boolean,
  locationIds: string[],
) {
  await db
    .delete(productLocations)
    .where(eq(productLocations.productId, productId));
  if (!availableAllLocations && locationIds.length > 0) {
    await db
      .insert(productLocations)
      .values(locationIds.map((locationId) => ({ productId, locationId })));
  }
}

export { listCatalog } from "./core";

export async function createProduct(
  business: OwnerBusiness,
  value: unknown,
  options: CatalogOptions = {},
) {
  const raw = productBody(value);
  const measure =
    options.contract === 2
      ? parseCatalogMeasure(raw.soldByWeight, raw.pricingUnit)
      : { soldByWeight: false, pricingUnit: "unit" as const };
  const input = validateProductInput(
    value,
    options.contract === 2
      ? {
          unitPrice: catalogPrice(raw.unitPrice),
          unitCost: catalogPrice(raw.unitCost),
        }
      : undefined,
  );
  input.locationIds = [
    ...new Set(input.locationIds.map((id) => id.toLowerCase())),
  ];
  // Preserve the early guard before preparing any external asset; recheck under lock.
  await assertNoOpenImport(business.id);
  const change = await resolveImageChange(business.id, input, null);
  try {
    return await withDbTransaction(async (tx) => {
      await lockBusiness(tx, business.id);
      await assertNoOpenImport(business.id, tx);
      await assertMeasureUnit(tx, business.id, measure);
      await assertCategory(tx, business.id, input.categoryId);
      await assertLocations(
        tx,
        business.id,
        input.availableAllLocations,
        input.locationIds,
      );
      const [row] = await tx
        .insert(products)
        .values({
          businessId: business.id,
          categoryId: input.categoryId,
          name: input.name,
          unitPrice: input.unitPrice,
          unitCost: input.unitCost,
          ...measure,
          salesRevision: 1,
          availableAllLocations: input.availableAllLocations,
          imageObjectKey: change?.nextKey ?? null,
          imageVersion: change?.nextKey ? 1 : 0,
          imageSource: change?.attribution.source ?? null,
          imageAuthor: change?.attribution.author ?? null,
          imageAuthorUrl: change?.attribution.authorUrl ?? null,
          imageSourceUrl: change?.attribution.sourceUrl ?? null,
        })
        .returning(productColumns);
      await syncLocations(
        tx,
        row.id,
        input.availableAllLocations,
        input.locationIds,
      );
      return catalogProductDTO(
        {
          ...row,
          locationIds: input.availableAllLocations ? [] : input.locationIds,
        } as ProductRecord,
        options,
      );
    });
  } catch (error) {
    if (change?.rollback)
      await cleanupProductPrefixNow(business.id, change.rollback);
    rethrowCatalogWriteError(error);
  }
}

export async function updateProduct(
  business: OwnerBusiness,
  productId: string,
  value: unknown,
  options: CatalogOptions = {},
) {
  if (!uuidPattern.test(productId))
    throw new CatalogError(404, "Producto no encontrado.");
  const raw = productBody(value);
  const expected =
    options.contract === 2
      ? parseSalesRevision(raw.expectedSalesRevision)
      : null;
  // Strict tariffs are parsed against the locked snapshot below, never an unlocked observation.
  const input = validateProductInput(value, {
    unitPrice: null,
    unitCost: null,
  });
  input.locationIds = [
    ...new Set(input.locationIds.map((id) => id.toLowerCase())),
  ];
  const [observed] = await getDb()
    .select({
      imageObjectKey: products.imageObjectKey,
      imageVersion: products.imageVersion,
    })
    .from(products)
    .where(
      and(eq(products.id, productId), eq(products.businessId, business.id)),
    )
    .limit(1);
  if (!observed) throw new CatalogError(404, "Producto no encontrado.");
  const change = await resolveImageChange(
    business.id,
    input,
    observed.imageObjectKey,
  );
  let result;
  try {
    result = await withDbTransaction(async (tx) => {
      await lockBusiness(tx, business.id);
      const [current] = await tx
        .select()
        .from(products)
        .where(
          and(eq(products.id, productId), eq(products.businessId, business.id)),
        )
        .for("update")
        .limit(1);
      if (!current) throw new CatalogError(404, "Producto no encontrado.");
      const linksForConflict = await tx
        .select({ id: productLocations.locationId })
        .from(productLocations)
        .where(eq(productLocations.productId, productId));
      const measure = await prepareCatalogUpdate(
        tx,
        business.id,
        { ...current, locationIds: [] },
        raw,
        input,
        linksForConflict.map((link) => link.id),
        expected,
        options,
      );
      if (
        change &&
        (current.imageObjectKey !== observed.imageObjectKey ||
          current.imageVersion !== observed.imageVersion)
      ) {
        throw new CatalogError(
          409,
          "La imagen cambió. Revisa el producto y vuelve a guardar.",
        );
      }
      await assertCategory(tx, business.id, input.categoryId);
      await assertLocations(
        tx,
        business.id,
        input.availableAllLocations,
        input.locationIds,
      );
      const oldLocations = current.availableAllLocations
        ? []
        : linksForConflict.map((row) => row.id).sort();
      const newLocations = input.availableAllLocations
        ? []
        : [...input.locationIds].sort();
      const commercialChange =
        current.soldByWeight !== measure.soldByWeight ||
        current.pricingUnit !== measure.pricingUnit ||
        current.name !== input.name ||
        normalizedDecimal(current.unitPrice) !==
          normalizedDecimal(input.unitPrice) ||
        normalizedDecimal(current.unitCost) !==
          normalizedDecimal(input.unitCost) ||
        current.availableAllLocations !== input.availableAllLocations ||
        JSON.stringify(oldLocations) !== JSON.stringify(newLocations);
      const [row] = await tx
        .update(products)
        .set({
          ...measure,
          categoryId: input.categoryId,
          name: input.name,
          unitPrice: input.unitPrice,
          unitCost: input.unitCost,
          availableAllLocations: input.availableAllLocations,
          ...(commercialChange
            ? { salesRevision: sql`${products.salesRevision} + 1` }
            : {}),
          ...(change
            ? {
                imageObjectKey: change.nextKey,
                imageVersion: sql`${products.imageVersion} + 1`,
                imageSource: change.attribution.source,
                imageAuthor: change.attribution.author,
                imageAuthorUrl: change.attribution.authorUrl,
                imageSourceUrl: change.attribution.sourceUrl,
              }
            : {}),
          updatedAt: new Date(),
        })
        .where(
          and(eq(products.id, productId), eq(products.businessId, business.id)),
        )
        .returning(productColumns);
      await syncLocations(
        tx,
        productId,
        input.availableAllLocations,
        input.locationIds,
      );
      return catalogProductDTO(
        {
          ...row,
          locationIds: input.availableAllLocations ? [] : input.locationIds,
        } as ProductRecord,
        options,
      );
    });
  } catch (error) {
    if (change?.rollback)
      await cleanupProductPrefixNow(business.id, change.rollback);
    rethrowCatalogWriteError(error);
  }
  // A committed replacement owns its new prefix; never roll it back on aftercommit cleanup.
  if (change?.previous)
    await cleanupProductPrefixNow(business.id, change.previous);
  return result;
}

export async function deleteProduct(
  business: OwnerBusiness,
  productId: string,
) {
  if (!uuidPattern.test(productId))
    throw new CatalogError(404, "Producto no encontrado.");
  const row = await withDbTransaction(async (tx) => {
    await lockBusiness(tx, business.id);
    const [deleted] = await tx
      .delete(products)
      .where(
        and(eq(products.id, productId), eq(products.businessId, business.id)),
      )
      .returning({ id: products.id, imageObjectKey: products.imageObjectKey });
    if (!deleted) throw new CatalogError(404, "Producto no encontrado.");
    return deleted;
  });
  if (row.imageObjectKey)
    await cleanupProductPrefixNow(business.id, row.imageObjectKey);
  return { ok: true };
}
