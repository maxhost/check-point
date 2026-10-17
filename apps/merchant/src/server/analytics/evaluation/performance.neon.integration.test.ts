import { describe, expect, it } from "vitest";
import { permisosIntegrationEnabled } from "../../permissions-integration-support";
import { evaluateBusiness } from "./index";
/** Suspend only the assigned ephemeral compute after the seed wrapper exits.
 * The migration wrapper itself wakes Neon before Vitest; this is explicitly recorded.
 * ANALYTICS_PERF_MEASURE=1 enables the one-shot observation, never a retry loop. */
describe.skipIf(
  !permisosIntegrationEnabled || process.env.ANALYTICS_PERF_MEASURE !== "1",
)("AN-1 isolated cold evaluation observation", () => {
  it("records the full evaluation and its connection/claim/read/calculate/write stages", async () => {
    // Deterministic ID = md5('analytics-perf-business:1'), fixed by the seed.
    const { createHash } = await import("node:crypto");
    const h = createHash("md5")
      .update("analytics-perf-business:1")
      .digest("hex");
    const id = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    const stages: Record<string, number> = {};
    const started = performance.now();
    const result = await evaluateBusiness(
      id,
      new Date("2026-10-20T08:00:00Z"),
      {
        trace: (stage, ms) => {
          stages[stage] = Math.round(ms * 100) / 100;
        },
      },
    );
    const elapsed = Math.round((performance.now() - started) * 100) / 100;
    const connection =
      (stages.business_clock_and_connection ?? 0) +
      (stages.transaction_connection ?? 0);
    console.log(
      "ANALYTICS_PERF_OBSERVATION",
      JSON.stringify({
        result,
        endToEndMs: elapsed,
        connectionMs: connection,
        executionAfterConnectionMs:
          Math.round((elapsed - connection) * 100) / 100,
        stages,
      }),
    );
    expect(result).toBe(true);
    // The owner/coordinator fixes which observed clock is the acceptance criterion before execution.
    expect(elapsed).toBeLessThanOrEqual(1000);
  }, 30000);
});
