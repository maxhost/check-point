import { and, asc, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  businessConfiguration,
  products,
  productCategories,
} from "@mi-pasaporte/db/schema";
import {
  parseMeasure,
  parsePrice,
  trustedUnitSnapshotPrice,
  trustedUnitLegacyPrice,
  type MassUnit,
} from "@mi-pasaporte/domain/measures";
import { availableAtCounter } from "../../../server/counter/catalog-visibility";
import type { PosCatalogV2, PosCatalogProductV2 } from "../contracts";
import { bestSellingProductIds, frequentProductIds } from "./best-sellers";
import { posUpgradeRequired } from "./measured-read";

/** POS projection only: no costs, storage keys or administrative product fields. */
export async function readPosCatalog(
  businessId: string,
  locationId: string | null,
  contract: 1 | 2,
) {
  const db = getDb();
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      categoryId: products.categoryId,
      soldByWeight: products.soldByWeight,
      pricingUnit: products.pricingUnit,
      unitPrice: products.unitPrice,
      salesRevision: products.salesRevision,
      imageObjectKey: products.imageObjectKey,
      imageVersion: products.imageVersion,
    })
    .from(products)
    .where(
      and(
        eq(products.businessId, businessId),
        availableAtCounter(locationId),
        isNotNull(products.unitPrice),
      ),
    )
    .orderBy(asc(products.name));
  const categories = await db
    .select({ id: productCategories.id, name: productCategories.name })
    .from(productCategories)
    .where(eq(productCategories.businessId, businessId))
    .orderBy(asc(productCategories.name));
  const projected: PosCatalogProductV2[] = rows.map((row) => {
    if (contract === 1 && (row.soldByWeight || row.pricingUnit !== "unit"))
      posUpgradeRequired();
    const measure = parseMeasure({
      kind: row.soldByWeight ? "mass" : "unit",
      quantityUnit: row.pricingUnit,
      priceUnit: row.pricingUnit,
      conversionVersion: "mass-si-1",
    });
    if (contract === 1) {
      try {
        if (measure.kind !== "unit") posUpgradeRequired();
        trustedUnitLegacyPrice(row.unitPrice);
      } catch {
        posUpgradeRequired();
      }
    }
    return {
      id: row.id,
      name: row.name,
      categoryId: row.categoryId,
      soldByWeight: row.soldByWeight,
      pricingUnit: measure.priceUnit,
      unitPrice:
        measure.kind === "unit"
          ? trustedUnitSnapshotPrice(row.unitPrice)
          : parsePrice(row.unitPrice),
      catalogRevision: String(row.salesRevision),
      imagePath: row.imageObjectKey
        ? `/api/public/catalog/${row.id}/image?v=${row.imageVersion}`
        : null,
    };
  });
  const ids = projected.map((product) => product.id);
  if (contract === 1)
    return {
      products: projected.map((product) => ({
        id: product.id,
        name: product.name,
        categoryId: product.categoryId,
        unitPrice: Number(trustedUnitLegacyPrice(product.unitPrice)),
        imagePath: product.imagePath,
      })),
      categories,
      bestSellingProductIds: await bestSellingProductIds(
        businessId,
        locationId,
        ids,
      ),
    };
  const [configuration] = await db
    .select({ salesMassUnits: businessConfiguration.salesMassUnits })
    .from(businessConfiguration)
    .where(eq(businessConfiguration.businessId, businessId))
    .limit(1);
  const result: PosCatalogV2 = {
    products: projected,
    categories,
    salesMassUnits: configuration
      ? (configuration.salesMassUnits as MassUnit[])
      : ["kg"],
    frequentProductIds: await frequentProductIds(businessId, locationId, ids),
  };
  return result;
}
