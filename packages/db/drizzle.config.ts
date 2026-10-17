import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? "postgresql://placeholder",
  },
  schemaFilter: [
    "merchant_auth",
    "core",
    "consumer",
    "platform_auth",
    // Spec 0210 / ADR 0138: un esquema Postgres por modulo.
    "stock",
    "recipes",
    "expenses",
    // Spec 0220 / ADR 0141 §6: el POS y Mesas.
    "pos",
  ],
});
