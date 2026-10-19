import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { DbTransaction } from "@mi-pasaporte/db";
import { businessConfiguration, products } from "@mi-pasaporte/db/schema";
import { buildFinancialAmountsFromSnapshots } from "@mi-pasaporte/domain/financial";
import {
  MeasureError,
  parseMeasure,
  parsePrice,
  trustedUnitSnapshotPrice,
} from "@mi-pasaporte/domain/measures";
import { CounterError } from "@mi-pasaporte/domain/server/counter/core";
import { availableAtCounter } from "../../../server/counter/catalog-visibility";
import type { PosNewLineV2, PosCatalogProductV2 } from "../contracts";
import { PosError } from "./errors";

/** Caller holds lockBusiness before entering; catalog writers take that same mutex.
 * Keep lines distinct, including repeated product IDs, and assign real persisted IDs. */
export async function captureMeasuredLines(
  tx: DbTransaction,
  businessId: string,
  locationId: string,
  currencyCode: string,
  inputs: readonly PosNewLineV2[],
) {
  const [configuration] = await tx
    .select({ units: businessConfiguration.salesMassUnits })
    .from(businessConfiguration)
    .where(eq(businessConfiguration.businessId, businessId));
  const units = configuration?.units ?? ["kg"];
  const ids = [...new Set(inputs.map((line) => line.productId))].sort();
  const rows = ids.length
    ? await tx
        .select({
          id: products.id,
          name: products.name,
          categoryId: products.categoryId,
          imageObjectKey: products.imageObjectKey,
          imageVersion: products.imageVersion,
          unitPrice: products.unitPrice,
          soldByWeight: products.soldByWeight,
          pricingUnit: products.pricingUnit,
          revision: products.salesRevision,
        })
        .from(products)
        .where(
          and(
            eq(products.businessId, businessId),
            inArray(products.id, ids),
            availableAtCounter(locationId),
          ),
        )
        .orderBy(asc(products.id))
        .for("share")
    : [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  try {
    const lines = inputs.map((input, position) => {
      const product = byId.get(input.productId);
      if (!product || product.unitPrice === null)
        throw new CounterError(
          422,
          "unknown_product",
          "El producto no está disponible en este local.",
        );
      const unitPrice = product.soldByWeight
        ? parsePrice(product.unitPrice)
        : trustedUnitSnapshotPrice(product.unitPrice);
      if (input.catalogRevision !== String(product.revision))
        throw new PosError(
          409,
          "catalog_changed",
          "El producto cambió. Revisa la orden.",
          {
            products: [
              {
                id: product.id,
                categoryId: product.categoryId,
                imagePath: product.imageObjectKey
                  ? `/api/public/catalog/${product.id}/image?v=${product.imageVersion}`
                  : null,
                name: product.name,
                unitPrice,
                soldByWeight: product.soldByWeight,
                pricingUnit: parseMeasure({
                  kind: product.soldByWeight ? "mass" : "unit",
                  quantityUnit: product.pricingUnit,
                  priceUnit: product.pricingUnit,
                  conversionVersion: "mass-si-1",
                }).priceUnit,
                catalogRevision: String(product.revision),
              } satisfies PosCatalogProductV2,
            ],
          },
        );
      const measure = parseMeasure({
        kind: product.soldByWeight ? "mass" : "unit",
        quantityUnit: input.quantityUnit,
        priceUnit: product.pricingUnit,
        conversionVersion: "mass-si-1",
      });
      if (measure.kind === "mass" && !units.includes(input.quantityUnit))
        throw new CounterError(
          422,
          "invalid_unit",
          "La unidad no está habilitada en tu negocio.",
        );
      return {
        sourceLineId: randomUUID(),
        productId: product.id,
        name: product.name,
        quantity: input.quantity,
        unitPrice,
        measure,
        position,
      };
    });
    const total = lines.length
      ? buildFinancialAmountsFromSnapshots({
          currencyCode,
          discount: null,
          lines,
        }).gross
      : "0.00";
    return { lines, total };
  } catch (error) {
    if (error instanceof MeasureError)
      throw new CounterError(
        422,
        error.code,
        "La cantidad, medida o tarifa no es válida.",
      );
    throw error;
  }
}
