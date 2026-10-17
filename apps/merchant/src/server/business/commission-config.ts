import { withDbTransaction, type DbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  moduleResourceVersions,
  paymentMethods,
  commissionRevisions as revisions,
} from "@mi-pasaporte/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { isUuid } from "@mi-pasaporte/domain/server/counter/core";
import { minorUnitForCurrency } from "@mi-pasaporte/domain/financial";
import {
  exact,
  formatMinor,
  minorRational,
  originalMoney,
  subtract,
  toMinor,
} from "@mi-pasaporte/domain/financial/rational";
import { BusinessError } from "./error";
import { setResourceVersion } from "../module-events/publish";
import {
  parsePercent,
  usesFixed,
  usesPercent,
  type ChargeShape,
} from "@mi-pasaporte/domain/financial/commission";
export const methodNotFound = () =>
  new BusinessError(
    404,
    "payment_method_not_found",
    "Ese medio de pago no existe.",
  );
export function paymentMetadata(resource: {
  providerId: string;
  resourceId: string;
  metadata: Record<string, unknown>;
}) {
  const { name, chargeShape, status } = resource.metadata;
  if (
    typeof name !== "string" ||
    !name ||
    !["none", "percent", "fixed", "percent_and_fixed"].includes(
      String(chargeShape),
    ) ||
    !["active", "archived"].includes(String(status))
  )
    throw new Error("Invalid payment method metadata");
  return {
    providerId: resource.providerId,
    methodId: resource.resourceId,
    isCash: resource.metadata.isCash === true,
    name,
    status: status as string,
    chargeShape: chargeShape as ChargeShape,
  };
}
export async function currentCommission(
  tx: DbTransaction,
  businessId: string,
  methodId: string,
) {
  const [pointer] = await tx
    .select()
    .from(moduleResourceVersions)
    .where(
      and(
        eq(moduleResourceVersions.businessId, businessId),
        eq(moduleResourceVersions.resourceType, "payment_method"),
        eq(moduleResourceVersions.resourceId, methodId),
        eq(moduleResourceVersions.providerId, "core"),
        eq(moduleResourceVersions.slot, "commission"),
      ),
    );
  if (!pointer) return null;
  const [revision] = await tx
    .select()
    .from(revisions)
    .where(
      and(
        eq(revisions.businessId, businessId),
        eq(revisions.id, pointer.versionId),
      ),
    );
  if (!revision || revision.methodId !== methodId)
    throw new Error("Current commission revision unavailable");
  return revision;
}
type Method = ReturnType<typeof paymentMetadata>;
export function commissionDTO(
  method: Method,
  revision: typeof revisions.$inferSelect | null,
) {
  if (revision && revision.chargeShape !== method.chargeShape)
    throw new Error("Commission metadata mismatch");
  return {
    ...method,
    revisionId: revision?.id ?? null,
    percent: revision?.percent ?? null,
    fixed:
      revision?.fixed == null
        ? null
        : formatMinor(
            toMinor(originalMoney(revision.fixed), revision.minorUnit as 0 | 2),
            revision.minorUnit as 0 | 2,
          ),
    originalFixed: revision?.originalFixed ?? null,
    fixedNormalizationAdjustment:
      revision?.fixedNormalizationAdjustment ?? null,
    currencyCode: revision?.currencyCode ?? null,
    minorUnit: revision?.minorUnit ?? null,
    configured:
      (!usesPercent(method.chargeShape) || revision?.percent != null) &&
      (!usesFixed(method.chargeShape) || revision?.originalFixed != null),
  };
}
export async function listCommissions(businessId: string) {
  return withDbTransaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level repeatable read`);
    const methods = (
      await tx
        .select()
        .from(paymentMethods)
        .where(eq(paymentMethods.businessId, businessId))
    )
      .map((row) => ({ providerId: "core", resourceId: row.id, metadata: row }))
      .map(paymentMetadata);
    const result = [];
    for (const method of methods)
      result.push(
        commissionDTO(
          method,
          await currentCommission(tx, businessId, method.methodId),
        ),
      );
    return { methods: result };
  });
}
export async function saveCommission(
  businessId: string,
  rawId: unknown,
  body: Record<string, unknown>,
) {
  if (!isUuid(rawId)) throw methodNotFound();
  const methodId = (rawId as string).trim().toLowerCase();
  if (body.expectedRevisionId !== null && !isUuid(body.expectedRevisionId))
    throw new BusinessError(
      422,
      "invalid_commission",
      "La revisión no es válida.",
    );
  return withDbTransaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"business-config/" + businessId},0))`,
    );
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"commissions/" + businessId},0))`,
    );
    const resources = (
      await tx
        .select()
        .from(paymentMethods)
        .where(
          and(
            eq(paymentMethods.businessId, businessId),
            eq(paymentMethods.id, methodId),
          ),
        )
    ).map((row) => ({ providerId: "core", resourceId: row.id, metadata: row }));
    if (resources.length !== 1) throw methodNotFound();
    const method = paymentMetadata(resources[0]);
    const current = await currentCommission(tx, businessId, methodId);
    const expectedRevisionId =
      body.expectedRevisionId === null
        ? null
        : (body.expectedRevisionId as string).trim().toLowerCase();
    if ((current?.id ?? null) !== expectedRevisionId)
      throw new BusinessError(
        409,
        "commission_revision_conflict",
        "La comisión cambió. Actualiza e intenta de nuevo.",
      );
    let percent: string | null = null,
      fixed: string | null = null,
      originalFixed = null,
      fixedNormalizationAdjustment = null,
      currencyCode: string | null = null,
      minorUnit: 0 | 2 | null = null;
    const [business] = await tx
      .select({ currencyCode: businesses.currencyCode })
      .from(businesses)
      .where(eq(businesses.id, businessId));
    if (!business) throw methodNotFound();
    if (
      usesFixed(method.chargeShape) &&
      body.fixed !== null &&
      body.expectedCurrencyCode !== undefined &&
      body.expectedCurrencyCode !== business.currencyCode
    )
      throw new BusinessError(
        409,
        "commission_currency_conflict",
        "La moneda cambió. Actualiza y confirma el fijo en la moneda actual.",
      );
    try {
      if (usesPercent(method.chargeShape)) {
        if (!Object.hasOwn(body, "percent")) throw new Error();
        percent = parsePercent(body.percent);
      } else if (Object.hasOwn(body, "percent")) throw new Error();
      if (usesFixed(method.chargeShape)) {
        if (!Object.hasOwn(body, "fixed")) throw new Error();
        if (body.fixed !== null) {
          const input = originalMoney(body.fixed as string);
          currencyCode = business.currencyCode;
          minorUnit = minorUnitForCurrency(currencyCode);
          const normalized = toMinor(input, minorUnit);
          fixed = formatMinor(normalized, minorUnit);
          originalFixed = exact(input);
          fixedNormalizationAdjustment = exact(
            subtract(minorRational(normalized, minorUnit), input),
          );
        }
      } else if (Object.hasOwn(body, "fixed")) throw new Error();
    } catch {
      throw new BusinessError(
        422,
        "invalid_commission",
        "La comisión no es válida. Revisa el porcentaje y el importe fijo.",
      );
    }
    const [revision] = await tx
      .insert(revisions)
      .values({
        businessId,
        methodProviderId: method.providerId,
        methodId,
        chargeShape: method.chargeShape,
        percent,
        fixed,
        originalFixed,
        fixedNormalizationAdjustment,
        currencyCode,
        minorUnit,
      })
      .returning();
    await setResourceVersion(tx, {
      businessId,
      resourceType: "payment_method",
      resourceId: methodId,
      providerId: "core",
      slot: "commission",
      versionId: revision.id,
    });
    return commissionDTO(method, revision);
  });
}
