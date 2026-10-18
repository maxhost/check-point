import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  businessConfiguration,
  businesses,
  products,
} from "@mi-pasaporte/db/schema";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { isIanaTimezone } from "@mi-pasaporte/domain/server/timezone";
import { isSupportedCurrency } from "@mi-pasaporte/domain/lib/currencies";
import {
  resultingBrandVat,
  validateVatPatch,
} from "@mi-pasaporte/domain/server/brand/vat";
import type { BusinessSalesUnits, MassUnit } from "../../lib/business-contract";
import { BusinessError } from "./error";
export async function readConfiguration(
  businessId: string,
  kind: "regional" | "fiscal",
) {
  const [row] = await getDb()
    .select({
      timezone: businesses.timezone,
      currencyCode: businesses.currencyCode,
      chargesVat: businesses.chargesVat,
      saleVatRate: businesses.saleVatRate,
      recoversPurchaseVat: businesses.recoversPurchaseVat,
      revision: businessConfiguration.revision,
    })
    .from(businesses)
    .leftJoin(
      businessConfiguration,
      eq(businessConfiguration.businessId, businesses.id),
    )
    .where(eq(businesses.id, businessId));
  if (!row)
    throw new BusinessError(
      404,
      "business_not_found",
      "Ese negocio no existe.",
    );
  return kind === "regional"
    ? {
        timezone: row.timezone,
        currencyCode: row.currencyCode,
        revision: row.revision ?? 1,
      }
    : {
        chargesVat: row.chargesVat,
        saleVatRate: row.saleVatRate,
        recoversPurchaseVat: row.recoversPurchaseVat,
        revision: row.revision ?? 1,
      };
}
export async function saveConfiguration(
  businessId: string,
  kind: "regional" | "fiscal",
  body: Record<string, unknown>,
) {
  if (!Number.isInteger(body.revision) || Number(body.revision) < 1)
    throw new BusinessError(
      422,
      "invalid_revision",
      "La revisión no es válida.",
    );
  return withDbTransaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"business-config/" + businessId},0))`,
    );
    await tx
      .insert(businessConfiguration)
      .values({ businessId })
      .onConflictDoNothing();
    const [current] = await tx
      .select()
      .from(businessConfiguration)
      .where(eq(businessConfiguration.businessId, businessId));
    if (current.revision !== body.revision)
      throw new BusinessError(
        409,
        "business_revision_conflict",
        "La configuración cambió. Actualiza y vuelve a intentarlo.",
      );
    let patch;
    if (kind === "regional") {
      if (
        typeof body.timezone !== "string" ||
        !isIanaTimezone(body.timezone) ||
        !isSupportedCurrency(body.currencyCode)
      )
        throw new BusinessError(
          422,
          "invalid_regional",
          "Revisa la zona horaria y la moneda.",
        );
      patch = { timezone: body.timezone, currencyCode: body.currencyCode };
    } else {
      // Reuse fiscal validation; fiscal changes retain their existing semantics.
      try {
        const vat = validateVatPatch(body);
        if (
          typeof body.chargesVat !== "boolean" ||
          typeof body.recoversPurchaseVat !== "boolean" ||
          !Object.hasOwn(body, "saleVatRate")
        )
          throw new Error();
        patch = resultingBrandVat(
          { chargesVat: false, saleVatRate: null, recoversPurchaseVat: false },
          vat,
        );
      } catch {
        throw new BusinessError(
          422,
          "invalid_fiscal",
          "Revisa los datos fiscales.",
        );
      }
    }
    await tx
      .update(businesses)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(businesses.id, businessId));
    await tx
      .update(businessConfiguration)
      .set({ revision: current.revision + 1 })
      .where(
        and(
          eq(businessConfiguration.businessId, businessId),
          eq(businessConfiguration.revision, current.revision),
        ),
      );
    return { ...patch, revision: current.revision + 1 };
  });
}

export async function readSalesUnits(
  businessId: string,
): Promise<BusinessSalesUnits> {
  const [row] = await getDb()
    .select({
      salesMassUnits: businessConfiguration.salesMassUnits,
      revision: businessConfiguration.revision,
    })
    .from(businessConfiguration)
    .where(eq(businessConfiguration.businessId, businessId));
  return {
    salesMassUnits: (row?.salesMassUnits ?? ["kg"]) as MassUnit[],
    revision: row?.revision ?? 1,
  };
}

export async function saveSalesUnits(
  businessId: string,
  body: Record<string, unknown>,
): Promise<BusinessSalesUnits> {
  const units = body.salesMassUnits;
  if (
    Object.keys(body).some(
      (key) => key !== "salesMassUnits" && key !== "revision",
    ) ||
    !Array.isArray(units) ||
    units.length === 0 ||
    units.some((unit) => !["kg", "lb", "g"].includes(unit)) ||
    new Set(units).size !== units.length ||
    !Number.isInteger(body.revision) ||
    Number(body.revision) < 1
  ) {
    throw new BusinessError(
      422,
      "invalid_sales_units",
      "Revisa las unidades de venta.",
      {
        fields: {
          salesMassUnits: "Elige unidades de masa válidas, sin repetir.",
        },
      },
    );
  }
  return withDbTransaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"business-config/" + businessId},0))`,
    );
    await tx
      .insert(businessConfiguration)
      .values({ businessId })
      .onConflictDoNothing();
    const [current] = await tx
      .select()
      .from(businessConfiguration)
      .where(eq(businessConfiguration.businessId, businessId));
    if (current.revision !== body.revision)
      throw new BusinessError(
        409,
        "business_revision_conflict",
        "La configuración cambió. Actualiza y vuelve a intentarlo.",
      );
    // Only current catalog products matter; historical snapshots never block removal.
    const referenced = await tx
      .select({
        id: products.id,
        name: products.name,
        pricingUnit: products.pricingUnit,
      })
      .from(products)
      .where(
        and(
          eq(products.businessId, businessId),
          eq(products.soldByWeight, true),
          notInArray(products.pricingUnit, units),
        ),
      );
    if (referenced.length)
      throw new BusinessError(
        409,
        "unit_in_use",
        "Hay productos que usan una unidad que quieres retirar.",
        { products: referenced },
      );
    const revision = current.revision + 1;
    await tx
      .update(businessConfiguration)
      .set({ salesMassUnits: units, revision })
      .where(eq(businessConfiguration.businessId, businessId));
    return { salesMassUnits: units as MassUnit[], revision };
  });
}
