import { pgSchema } from "drizzle-orm/pg-core";

export const merchantAuth = pgSchema("merchant_auth");
export const core = pgSchema("core");
export const consumer = pgSchema("consumer");
