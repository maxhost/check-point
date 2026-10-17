import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { permisosIntegrationEnabled } from "../../permissions-integration-support";
import { getDb } from "@mi-pasaporte/db";
import { readInput } from "../queries";
describe.skipIf(
  !permisosIntegrationEnabled || process.env.ANALYTICS_PERF_EXPLAIN !== "1",
)("AN-1 targeted readInput execution plan", () => {
  it("explains the exact production statement without other table scans or fixtures", async () => {
    const h = createHash("md5")
      .update("analytics-perf-business:1")
      .digest("hex");
    const id = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    let explained = false;
    const observer = {
      execute: async (
        statement: Parameters<ReturnType<typeof getDb>["execute"]>[0],
      ) => {
        const result = await getDb().execute(
          sql`explain (analyze, buffers, format json) ${statement}`,
        );
        console.log("ANALYTICS_READ_PLAN", JSON.stringify(result.rows));
        explained = true;
        return {
          rows: [
            {
              currencyCode: "USD",
              today: "2026-10-20",
              firstSaleDay: null,
              states: [],
              metrics: [],
              labels: [],
              locations: [],
            },
          ],
        };
      },
    } as unknown as ReturnType<typeof getDb>;
    await readInput(id, new Date("2026-10-20T08:00:00Z"), observer);
    expect(explained).toBe(true);
  }, 60000);
});
