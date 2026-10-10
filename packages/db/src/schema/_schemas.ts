import { pgSchema } from "drizzle-orm/pg-core";

export const merchantAuth = pgSchema("merchant_auth");
export const core = pgSchema("core");
export const consumer = pgSchema("consumer");
/** Spec 0190 (ADR 0135): la identidad del panel de plataforma, separada de `merchant_auth`. */
export const platformAuth = pgSchema("platform_auth");
