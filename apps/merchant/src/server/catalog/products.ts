import { and, asc, eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  locations,
  productCategories,
  productLocations,
  products,
} from "../schema";
import {
  CatalogError,
  type OwnerBusiness,
  type ProductRecord,
  toProductDTO,
  uuidPattern,
} from "./core";
import { validateProductInput } from "./validation";
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
async function assertCategory(businessId: string, categoryId: string | null) {
  if (!categoryId) return;
  const [row] = await getDb()
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
  businessId: string,
  availableAllLocations: boolean,
  locationIds: string[],
) {
  if (availableAllLocations || locationIds.length === 0) return;
  const rows = await getDb()
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
  productId: string,
  availableAllLocations: boolean,
  locationIds: string[],
) {
  const db = getDb();
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
  };
}

export async function createProduct(business: OwnerBusiness, value: unknown) {
  const input = validateProductInput(value);
  await assertCategory(business.id, input.categoryId);
  await assertLocations(
    business.id,
    input.availableAllLocations,
    input.locationIds,
  );
  const change = await resolveImageChange(business.id, input, null);
  try {
    const [row] = await getDb()
      .insert(products)
      .values({
        businessId: business.id,
        categoryId: input.categoryId,
        name: input.name,
        unitPrice: input.unitPrice,
        unitCost: input.unitCost,
        availableAllLocations: input.availableAllLocations,
        imageObjectKey: change?.nextKey ?? null,
        imageVersion: change?.nextKey ? 1 : 0,
        imageSource: change?.attribution.source ?? null,
        imageAuthor: change?.attribution.author ?? null,
        imageAuthorUrl: change?.attribution.authorUrl ?? null,
        imageSourceUrl: change?.attribution.sourceUrl ?? null,
      })
      .returning(productColumns);
    await syncLocations(row.id, input.availableAllLocations, input.locationIds);
    return toProductDTO({
      ...row,
      locationIds: input.availableAllLocations ? [] : input.locationIds,
    } as ProductRecord);
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
  if (!uuidPattern.test(productId)) {
    throw new CatalogError(404, "Producto no encontrado.");
  }
  const input = validateProductInput(value);
  const [current] = await getDb()
    .select({ imageObjectKey: products.imageObjectKey })
    .from(products)
    .where(
      and(eq(products.id, productId), eq(products.businessId, business.id)),
    )
    .limit(1);
  if (!current) throw new CatalogError(404, "Producto no encontrado.");
  await assertCategory(business.id, input.categoryId);
  await assertLocations(
    business.id,
    input.availableAllLocations,
    input.locationIds,
  );

  const change = await resolveImageChange(
    business.id,
    input,
    current.imageObjectKey,
  );
  try {
    const [row] = await getDb()
      .update(products)
      .set({
        categoryId: input.categoryId,
        name: input.name,
        unitPrice: input.unitPrice,
        unitCost: input.unitCost,
        availableAllLocations: input.availableAllLocations,
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
      productId,
      input.availableAllLocations,
      input.locationIds,
    );
    if (change?.previous) {
      await cleanupProductPrefixNow(business.id, change.previous);
    }
    return toProductDTO({
      ...row,
      locationIds: input.availableAllLocations ? [] : input.locationIds,
    } as ProductRecord);
  } catch (error) {
    if (change?.rollback) {
      await cleanupProductPrefixNow(business.id, change.rollback);
    }
    throw error;
  }
}

export async function deleteProduct(
  business: OwnerBusiness,
  productId: string,
) {
  if (!uuidPattern.test(productId)) {
    throw new CatalogError(404, "Producto no encontrado.");
  }
  const [row] = await getDb()
    .delete(products)
    .where(
      and(eq(products.id, productId), eq(products.businessId, business.id)),
    )
    .returning({
      id: products.id,
      imageObjectKey: products.imageObjectKey,
    });
  if (!row) throw new CatalogError(404, "Producto no encontrado.");
  if (row.imageObjectKey) {
    await cleanupProductPrefixNow(business.id, row.imageObjectKey);
  }
  return { ok: true };
}
