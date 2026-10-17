import { pgSchema } from "drizzle-orm/pg-core";
import { createCommissionTables } from "@mi-pasaporte/db/schema/commission-legacy-tables";
const tables = createCommissionTables(pgSchema("profitability"));
export const profitabilityCommissionRevisions = tables.revisions;
export const profitabilityPaymentCommissions = tables.snapshots;
