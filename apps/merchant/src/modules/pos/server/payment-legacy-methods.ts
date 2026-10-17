export { initializePaymentMethods } from "./payment-legacy-catalog";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb, type DbTransaction } from "@mi-pasaporte/db";
import { legacyPaymentTables } from "./payment-legacy";
const posPaymentMethods = legacyPaymentTables.methods;
import { isUuid } from "@mi-pasaporte/domain/server/counter/core";
import { ModuleError } from "../../errors";

export const PAYMENT_SHAPES = [
  "none",
  "percent",
  "fixed",
  "percent_and_fixed",
] as const;
export type PaymentShape = (typeof PAYMENT_SHAPES)[number];
export type PaymentMethod = {
  id: string;
  name: string;
  chargeShape: PaymentShape;
  isCash: boolean;
  status: "active" | "archived";
};
const methodMissing = () =>
  new ModuleError(
    404,
    "payment_method_not_found",
    "Ese medio de pago no existe.",
  );
const toMethod = (
  row: typeof posPaymentMethods.$inferSelect,
): PaymentMethod => ({
  id: row.id,
  name: row.name,
  chargeShape: row.chargeShape as PaymentShape,
  isCash: row.isCash,
  status: row.status as PaymentMethod["status"],
});

export async function listPaymentMethods(
  businessId: string,
  rawStatus: string | null = null,
) {
  if (rawStatus !== null && rawStatus !== "all" && rawStatus !== "active")
    throw new ModuleError(422, "invalid_status", "El estado no es válido.");
  const rows = await getDb()
    .select()
    .from(posPaymentMethods)
    .where(
      and(
        eq(posPaymentMethods.businessId, businessId),
        rawStatus === "all"
          ? undefined
          : eq(posPaymentMethods.status, "active"),
      ),
    )
    .orderBy(
      asc(sql`case when ${posPaymentMethods.isCash} then 0 else 1 end`),
      asc(posPaymentMethods.createdAt),
      asc(posPaymentMethods.id),
    );
  return {
    methods: rows.map(toMethod),
    defaultMethodId:
      rows.find((row) => row.isCash && row.status === "active")?.id ?? null,
  };
}

/** Close takes SHARE so archival waits for the committed payment snapshot. */
export async function paymentMethodsForClose(
  tx: DbTransaction,
  businessId: string,
  ids: string[],
) {
  if (ids.some((id) => !isUuid(id.trim()))) throw methodMissing();
  const unique = [...new Set(ids.map((id) => id.trim().toLowerCase()))].sort();
  const rows = unique.length
    ? await tx
        .select()
        .from(posPaymentMethods)
        .where(
          and(
            eq(posPaymentMethods.businessId, businessId),
            inArray(posPaymentMethods.id, unique),
          ),
        )
        .orderBy(asc(posPaymentMethods.id))
        .for("share")
    : [];
  if (rows.length !== unique.length) throw methodMissing();
  if (rows.some((row) => row.status !== "active"))
    throw new ModuleError(
      409,
      "payment_method_archived",
      "Ese medio de pago está archivado. Elige otro.",
    );
  return new Map(rows.map((row) => [row.id, toMethod(row)]));
}
