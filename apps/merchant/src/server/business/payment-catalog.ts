import { asc, eq, sql } from "drizzle-orm";
import { getDb, type DbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  paymentMethodCatalog,
  paymentMethods,
  paymentMethodInitializations,
} from "@mi-pasaporte/db/schema";
import { BusinessError } from "./error";
type Db = DbTransaction | ReturnType<typeof getDb>;
const methodMissing = () =>
  new BusinessError(
    404,
    "payment_method_not_found",
    "Ese medio de pago no existe.",
  );
export async function catalogFor(db: Db, businessId: string) {
  const [business] = await db
    .select({ countryCode: businesses.countryCode })
    .from(businesses)
    .where(eq(businesses.id, businessId));
  if (!business) throw methodMissing();
  const country = await db
    .select()
    .from(paymentMethodCatalog)
    .where(eq(paymentMethodCatalog.countryCode, business.countryCode))
    .orderBy(asc(paymentMethodCatalog.sortOrder), asc(paymentMethodCatalog.id));
  const entries = country.length
    ? country
    : await db
        .select()
        .from(paymentMethodCatalog)
        .where(sql`${paymentMethodCatalog.countryCode} is null`)
        .orderBy(
          asc(paymentMethodCatalog.sortOrder),
          asc(paymentMethodCatalog.id),
        );
  return {
    countryCode: business.countryCode,
    source: country.length ? ("country" as const) : ("base" as const),
    entries,
  };
}
export async function listPaymentCatalog(businessId: string) {
  const catalog = await catalogFor(getDb(), businessId);
  return {
    ...catalog,
    entries: catalog.entries.map(
      ({ id, name, chargeShape, isCash, initiallySuggested }) => ({
        id,
        name,
        chargeShape,
        isCash,
        initiallySuggested,
      }),
    ),
  };
}

/** Activation owns its module lock and transaction; reads never seed implicitly. */
export async function initializePaymentMethods(
  tx: DbTransaction,
  { businessId }: { businessId: string },
) {
  const [existing] = await tx
    .select()
    .from(paymentMethodInitializations)
    .where(eq(paymentMethodInitializations.businessId, businessId));
  if (existing) return;
  const catalog = await catalogFor(tx, businessId);
  await tx.insert(paymentMethods).values(
    catalog.entries
      .filter((entry) => entry.initiallySuggested)
      .map((entry) => ({
        businessId,
        catalogId: entry.id,
        name: entry.name,
        chargeShape: entry.chargeShape,
        isCash: entry.isCash,
      })),
  );
  await tx.insert(paymentMethodInitializations).values({
    businessId,
    countryCode: catalog.countryCode,
    source: catalog.source,
  });
}
