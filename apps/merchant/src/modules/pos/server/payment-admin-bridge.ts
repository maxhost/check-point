import { catalogFor } from "./payment-legacy-catalog";
export {
  listPaymentCatalog,
  initializePaymentMethods,
} from "./payment-legacy-catalog";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb, withDbTransaction, type DbTransaction } from "@mi-pasaporte/db";
import { legacyPaymentTables } from "./payment-legacy";
const posPaymentMethods = legacyPaymentTables.methods;
import { isUuid, pgErrorCode } from "@mi-pasaporte/domain/server/counter/core";
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

export async function createPaymentMethod(
  businessId: string,
  body: Record<string, unknown>,
): Promise<PaymentMethod> {
  try {
    return await withDbTransaction(async (tx) => {
      let values: {
        catalogId?: string;
        name: string;
        chargeShape: string;
        isCash: boolean;
      };
      if (body.catalogId !== undefined) {
        if (
          typeof body.catalogId !== "string" ||
          !isUuid(body.catalogId.trim()) ||
          body.name !== undefined ||
          body.chargeShape !== undefined
        )
          throw new ModuleError(
            422,
            "invalid_payment_method",
            "Elige un medio del catálogo o crea uno con nombre y forma de cobro.",
          );
        const catalog = await catalogFor(tx, businessId);
        const entry = catalog.entries.find(
          (candidate) =>
            candidate.id === (body.catalogId as string).trim().toLowerCase(),
        );
        if (!entry) throw methodMissing();
        if (entry.isCash) {
          const [cash] = await tx
            .select()
            .from(posPaymentMethods)
            .where(
              and(
                eq(posPaymentMethods.businessId, businessId),
                eq(posPaymentMethods.isCash, true),
              ),
            );
          if (cash) return toMethod(cash);
        }
        const [active] = await tx
          .select()
          .from(posPaymentMethods)
          .where(
            and(
              eq(posPaymentMethods.businessId, businessId),
              eq(posPaymentMethods.catalogId, entry.id),
              eq(posPaymentMethods.status, "active"),
            ),
          );
        if (active)
          throw new ModuleError(
            409,
            "payment_method_exists",
            "Ese medio de pago ya está activo.",
          );
        values = {
          catalogId: entry.id,
          name: entry.name,
          chargeShape: entry.chargeShape,
          isCash: entry.isCash,
        };
      } else {
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (
          !name ||
          name.length > 120 ||
          !PAYMENT_SHAPES.includes(body.chargeShape as PaymentShape)
        )
          throw new ModuleError(
            422,
            "invalid_payment_method",
            "Indica un nombre de hasta 120 caracteres y una forma de cobro válida.",
          );
        values = {
          name,
          chargeShape: body.chargeShape as PaymentShape,
          isCash: false,
        };
      }
      const [row] = await tx
        .insert(posPaymentMethods)
        .values({ businessId, ...values })
        .returning();
      return toMethod(row);
    });
  } catch (error) {
    if (pgErrorCode(error) === "23505")
      throw new ModuleError(
        409,
        "payment_method_name_taken",
        "Ya hay un medio de pago activo con ese nombre.",
      );
    throw error;
  }
}

export async function archivePaymentMethod(
  businessId: string,
  rawId: unknown,
): Promise<PaymentMethod> {
  if (!isUuid(rawId)) throw methodMissing();
  return withDbTransaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(posPaymentMethods)
      .where(
        and(
          eq(posPaymentMethods.businessId, businessId),
          eq(posPaymentMethods.id, rawId as string),
        ),
      )
      .for("update");
    if (!row) throw methodMissing();
    if (row.isCash)
      throw new ModuleError(
        409,
        "cash_required",
        "Efectivo siempre debe estar disponible.",
      );
    const [archived] = await tx
      .update(posPaymentMethods)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(posPaymentMethods.id, row.id))
      .returning();
    return toMethod(archived);
  });
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
