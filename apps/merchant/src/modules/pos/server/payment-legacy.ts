import { pgSchema } from "drizzle-orm/pg-core";
import { createPaymentMethodTables } from "@mi-pasaporte/db/schema/payment-method-tables";
export const legacyPaymentTables = createPaymentMethodTables(pgSchema("pos"));
