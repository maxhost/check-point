import { businessConfiguration } from "@mi-pasaporte/db/schema";
import { eq, sql } from "drizzle-orm";
import { parseOptionalMoney, type ProductInput } from "./validation";
import type { DbTransaction } from "@mi-pasaporte/db";
import type { ResourceMeasurementValidator } from "../../resource-measurement";
import {
  MeasureError,
  parseNullablePrice,
  trustedUnitLegacyPrice,
  trustedUnitSnapshotPrice,
  type MeasureUnit,
} from "../../measures";
import { CatalogError, type ProductRecord, toProductDTO } from "./core";

export type CatalogOptions = {
  contract?: 1 | 2;
  validateMeasurementChange?: ResourceMeasurementValidator<DbTransaction>;
};
export function upgradeRequired(): never {
  throw new CatalogError(
    409,
    "Actualiza la aplicación para usar este producto.",
    "pos_client_upgrade_required",
  );
}
/** Only fields explicitly approved for both public catalog contracts. */
export function publicProduct(p: ProductRecord) {
  return {
    id: p.id,
    name: p.name,
    categoryId: p.categoryId,
    imagePath: p.imageObjectKey
      ? `/api/public/catalog/${p.id}/image?v=${p.imageVersion}`
      : null,
    imageVersion: p.imageVersion,
    imageSource: p.imageSource,
    imageAuthor: p.imageAuthor,
    imageAuthorUrl: p.imageAuthorUrl,
    imageSourceUrl: p.imageSourceUrl,
    availableAllLocations: p.availableAllLocations,
    locationIds: p.locationIds,
  };
}
export function assertLegacyProduct(p: ProductRecord) {
  if (
    p.soldByWeight ||
    (p.pricingUnit !== undefined && p.pricingUnit !== "unit")
  )
    upgradeRequired();
  try {
    for (const price of [p.unitPrice, p.unitCost])
      if (price !== null) trustedUnitLegacyPrice(price);
  } catch (error) {
    if (error instanceof MeasureError) upgradeRequired();
    throw error;
  }
}
export function parseCatalogMeasure(
  soldByWeight: unknown,
  pricingUnit: unknown,
) {
  if (
    typeof soldByWeight !== "boolean" ||
    typeof pricingUnit !== "string" ||
    (!soldByWeight && pricingUnit !== "unit") ||
    (soldByWeight && !["kg", "lb", "g"].includes(pricingUnit))
  )
    throw new CatalogError(422, "La medida no es válida.", "invalid_measure");
  return { soldByWeight, pricingUnit: pricingUnit as MeasureUnit };
}
export function parseSalesRevision(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[1-9]\d{0,9}$/.test(value) ||
    BigInt(value) > 2147483647n
  )
    throw new CatalogError(
      422,
      "La revisión no es válida.",
      "invalid_revision",
    );
  return value;
}
export function catalogPrice(
  value: unknown,
  current?: string | null,
  preserveLegacy = false,
) {
  try {
    return parseNullablePrice(value);
  } catch (error) {
    if (!(error instanceof MeasureError)) throw error;
    if (
      preserveLegacy &&
      current !== null &&
      current !== undefined &&
      typeof value === "string" &&
      value.length <= 64
    ) {
      try {
        if (
          trustedUnitSnapshotPrice(value) === trustedUnitSnapshotPrice(current)
        )
          return trustedUnitSnapshotPrice(current);
      } catch (legacyError) {
        if (!(legacyError instanceof MeasureError)) throw legacyError;
      }
    }
    throw new CatalogError(422, "La tarifa no es válida.", error.code);
  }
}
export function toMeasuredProductDTO(p: ProductRecord) {
  const measure = parseCatalogMeasure(p.soldByWeight, p.pricingUnit);
  if (!Number.isInteger(p.salesRevision) || p.salesRevision! < 1)
    throw new CatalogError(503, "La revisión del producto no está disponible.");
  return {
    ...publicProduct(p),
    ...measure,
    unitPrice:
      p.unitPrice === null
        ? null
        : measure.soldByWeight
          ? catalogPrice(p.unitPrice)
          : trustedUnitSnapshotPrice(p.unitPrice),
    unitCost:
      p.unitCost === null
        ? null
        : measure.soldByWeight
          ? catalogPrice(p.unitCost)
          : trustedUnitSnapshotPrice(p.unitCost),
    catalogRevision: String(p.salesRevision),
  };
}
export function catalogProductDTO(
  p: ProductRecord,
  options: CatalogOptions = {},
) {
  return options.contract === 2 ? toMeasuredProductDTO(p) : toProductDTO(p);
}
/** Drizzle wraps the PostgreSQL error; match only the expand-phase barriers. */
export function rethrowCatalogWriteError(error: unknown): never {
  let cause: unknown = error;
  const visited = new Set<unknown>();
  while (cause && typeof cause === "object" && !visited.has(cause)) {
    visited.add(cause);
    const db = cause as { code?: string; constraint?: string; cause?: unknown };
    if (
      db.code === "23514" &&
      [
        "product_sale_measure_legacy_check",
        "product_unit_price_legacy_check",
        "product_unit_cost_legacy_check",
      ].includes(db.constraint ?? "")
    )
      upgradeRequired();
    cause = db.cause;
  }
  throw error;
}

export async function assertMeasureUnit(
  tx: DbTransaction,
  businessId: string,
  measure: { soldByWeight: boolean; pricingUnit: string },
) {
  if (!measure.soldByWeight) return;
  const [configuration] = await tx
    .select({ units: businessConfiguration.salesMassUnits })
    .from(businessConfiguration)
    .where(eq(businessConfiguration.businessId, businessId));
  if (!(configuration?.units ?? ["kg"]).includes(measure.pricingUnit))
    throw new CatalogError(
      422,
      "La unidad no está habilitada en tu negocio.",
      "invalid_unit",
    );
}

export async function prepareCatalogUpdate(
  tx: DbTransaction,
  businessId: string,
  current: ProductRecord,
  raw: Record<string, unknown>,
  input: ProductInput,
  locationIds: string[],
  expected: string | null,
  options: CatalogOptions,
) {
  if (expected !== null && expected !== String(current.salesRevision))
    throw new CatalogError(
      409,
      "El producto cambió. Revisa los datos y vuelve a guardar.",
      "catalog_changed",
      catalogProductDTO(
        {
          ...current,
          locationIds: current.availableAllLocations ? [] : locationIds,
        },
        options,
      ),
    );
  if (options.contract !== 2) assertLegacyProduct(current);
  const measure =
    options.contract === 2
      ? parseCatalogMeasure(raw.soldByWeight, raw.pricingUnit)
      : parseCatalogMeasure(current.soldByWeight, current.pricingUnit);
  if (options.contract === 2) {
    input.unitPrice = catalogPrice(
      raw.unitPrice,
      current.unitPrice,
      !current.soldByWeight && !measure.soldByWeight,
    );
    input.unitCost = catalogPrice(
      raw.unitCost,
      current.unitCost,
      !current.soldByWeight && !measure.soldByWeight,
    );
  } else {
    input.unitPrice = parseOptionalMoney(raw.unitPrice, "El precio");
    input.unitCost = parseOptionalMoney(raw.unitCost, "El coste");
  }
  await assertMeasureUnit(tx, businessId, measure);
  const error = await options.validateMeasurementChange?.({
    tx,
    businessId,
    resourceType: "product",
    resourceId: current.id,
    oldMeasure: {
      kind: current.soldByWeight ? "mass" : "unit",
      pricingUnit: parseCatalogMeasure(
        current.soldByWeight,
        current.pricingUnit,
      ).pricingUnit,
    },
    newMeasure: {
      kind: measure.soldByWeight ? "mass" : "unit",
      pricingUnit: measure.pricingUnit,
    },
  });
  if (error) throw new CatalogError(409, error.message, error.code);
  return measure;
}

/** The configuration mutex always precedes product/import locks and validation. */
export async function lockBusiness(tx: DbTransaction, businessId: string) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${"business-config/" + businessId},0))`,
  );
}

// Compare PostgreSQL numeric strings without converting tariffs to floating point.
export function normalizedDecimal(value: string | null) {
  if (value === null) return null;
  const [whole, fraction = ""] = value.split(".");
  return `${whole.replace(/^0+(?=\d)/, "")}.${fraction.replace(/0+$/, "")}`;
}

export function productBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new CatalogError(422, "La solicitud no es válida.");
  return value as Record<string, unknown>;
}
