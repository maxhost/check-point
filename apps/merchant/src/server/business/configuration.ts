import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { businessConfiguration, businesses } from "@mi-pasaporte/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { isIanaTimezone } from "@mi-pasaporte/domain/server/timezone";
import { isSupportedCurrency } from "@mi-pasaporte/domain/lib/currencies";
import {
  resultingBrandVat,
  validateVatPatch,
} from "@mi-pasaporte/domain/server/brand/vat";
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
