import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const run =
  url && process.env.NEON_INTEGRATION_ISOLATED === "true" ? neon(url) : null;

describe.skipIf(!run)(
  "loyalty schema on the designated development branch",
  () => {
    it("keeps the single operational-program invariant", async () => {
      const indexes =
        await run!`SELECT indexname FROM pg_indexes WHERE schemaname = 'core' AND indexname = 'core_loyalty_program_one_operational'`;
      expect(indexes).toHaveLength(1);
    });

    it("has the append-only event table for the audit trail", async () => {
      const tables =
        await run!`SELECT tablename FROM pg_tables WHERE schemaname = 'core' AND tablename = 'loyalty_program_event'`;
      expect(tables).toHaveLength(1);
      const indexes =
        await run!`SELECT indexname FROM pg_indexes WHERE schemaname = 'core' AND indexname IN ('core_loyalty_program_event_program_idx', 'core_loyalty_program_event_business_idx')`;
      expect(indexes).toHaveLength(2);
    });
  },
);
