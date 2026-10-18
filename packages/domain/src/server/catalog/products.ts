import { and, asc, eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getDb, withDbTransaction, type DbTransaction } from "@mi-pasaporte/db";
import {
  locations,
  productCategories,
  productLocations,
  products,
} from "@mi-pasaporte/db/schema";
import {
  CatalogError,
  type OwnerBusiness,
  type ProductRecord,
  toProductDTO,
  uuidPattern,
} from "./core";
import { validateProductInput } from "./validation";
import { assertNoOpenImport, hasOpenImport } from "./import-guard";
import { resolveImageChange } from "./image";
import { cleanupProductPrefixNow } from "./cleanup";

const productColumns = {
  id: products.id,
  name: products.name,
  categoryId: products.categoryId,
  unitPrice: products.unitPrice,
  unitCost: products.unitCost,
  imageObjectKey: products.imageObjectKey,
  imageVersion: products.imageVersion,
  imageSource: products.imageSource,
  imageAuthor: products.imageAuthor,
  imageAuthorUrl: products.imageAuthorUrl,
  imageSourceUrl: products.imageSourceUrl,
  availableAllLocations: products.availableAllLocations,
};

/** Rejects a category that isn't the owner's; a null category is always allowed. */
async function assertCategory(
  tx: DbTransaction,
  businessId: string,
  categoryId: string | null,
) {
  if (!categoryId) return;
  const [row] = await tx
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(
      and(
        eq(productCategories.id, categoryId),
        eq(productCategories.businessId, businessId),
      ),
    )
    .limit(1);
  if (!row)
    throw new CatalogError(422, "La categoría no pertenece a tu negocio.");
}

/** Rejects a restricted visibility list containing a location outside the business. */
async function assertLocations(
  tx: DbTransaction,
  businessId: string,
  availableAllLocations: boolean,
  locationIds: string[],
) {
  if (availableAllLocations || locationIds.length === 0) return;
  const rows = await tx
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(
        eq(locations.businessId, businessId),
        inArray(locations.id, locationIds),
      ),
    );
  if (rows.length !== locationIds.length) {
    throw new CatalogError(422, "Hay un local que no pertenece a tu negocio.");
  }
}

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

export async function listCatalog(business: OwnerBusiness) {
  const db = getDb();
  const rows = await db
    .select(productColumns)
    .from(products)
    .where(eq(products.businessId, business.id))
    .orderBy(asc(products.name));
  const categories = await db
    .select({ id: productCategories.id, name: productCategories.name })
    .from(productCategories)
    .where(eq(productCategories.businessId, business.id))
    .orderBy(asc(productCategories.name));
  const locationList = await db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(eq(locations.businessId, business.id))
    .orderBy(asc(locations.name));

  const restrictedIds = rows
    .filter((row) => !row.availableAllLocations)
    .map((row) => row.id);
  const links = restrictedIds.length
    ? await db
        .select({
          productId: productLocations.productId,
          locationId: productLocations.locationId,
        })
        .from(productLocations)
        .where(inArray(productLocations.productId, restrictedIds))
    : [];
  const byProduct = new Map<string, string[]>();
  for (const link of links) {
    const list = byProduct.get(link.productId) ?? [];
    list.push(link.locationId);
    byProduct.set(link.productId, list);
  }

  return {
    products: rows.map((row) =>
      toProductDTO({ ...row, locationIds: byProduct.get(row.id) ?? [] }),
    ),
    categories,
    locations: locationList,
    currencyCode: business.currencyCode,
    // ADR 0086 — un BOOLEANO, y nada mas: la pantalla necesita saber que el alta esta
    // bloqueada, no quien importa ni con que. Ninguna clave interna del import cruza.
    // **No es el guard**, es su reflejo: la proteccion sigue siendo el 409 del servidor.
    importInProgress: await hasOpenImport(business.id),
  };
}

/** The configuration mutex always precedes product/import locks and validation. */
async function lockBusiness(tx: DbTransaction, businessId: string) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${"business-config/" + businessId},0))`,
  );
}

// Compare PostgreSQL numeric strings without converting tariffs to floating point.
function normalizedDecimal(value: string | null) {
  if (value === null) return null;
  const [whole, fraction = ""] = value.split(".");
  return `${whole.replace(/^0+(?=\d)/, "")}.${fraction.replace(/0+$/, "")}`;
}

export async function createProduct(business: OwnerBusiness, value: unknown) {
  const input = validateProductInput(value);
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
          soldByWeight: false,
          pricingUnit: "unit",
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
      return toProductDTO({
        ...row,
        locationIds: input.availableAllLocations ? [] : input.locationIds,
      } as ProductRecord);
    });
  } catch (error) {
    if (change?.rollback)
      await cleanupProductPrefixNow(business.id, change.rollback);
    throw error;
  }
}

export async function updateProduct(
  business: OwnerBusiness,
  productId: string,
  value: unknown,
) {
  if (!uuidPattern.test(productId))
    throw new CatalogError(404, "Producto no encontrado.");
  const input = validateProductInput(value);
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
      const links = await tx
        .select({ id: productLocations.locationId })
        .from(productLocations)
        .where(eq(productLocations.productId, productId));
      const oldLocations = current.availableAllLocations
        ? []
        : links.map((row) => row.id).sort();
      const newLocations = input.availableAllLocations
        ? []
        : [...input.locationIds].sort();
      const commercialChange =
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
      return toProductDTO({
        ...row,
        locationIds: input.availableAllLocations ? [] : input.locationIds,
      } as ProductRecord);
    });
  } catch (error) {
    if (change?.rollback)
      await cleanupProductPrefixNow(business.id, change.rollback);
    throw error;
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
