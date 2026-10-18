import { expect, it, vi } from "vitest";
const readInput = vi.hoisted(() => vi.fn());
vi.mock("./queries", () => ({ readInput }));
import { readDashboardSummary } from "./summary";
it("uses one input read for all three values without reading Inbox or history", async () => {
  const now = new Date("2026-10-20T12:00Z");
  readInput.mockResolvedValue({
    today: "2026-10-20",
    timezone: "UTC",
    currencyCode: "USD",
    minorUnit: 2,
    metrics: [],
    labels: [],
    locations: [],
  });
  expect(await readDashboardSummary("guarded-business", now)).toMatchObject({
    todayRevenueMinor: 0,
    monthBreakEvenMinor: null,
    readAt: now.toISOString(),
  });
  expect(readInput).toHaveBeenCalledExactlyOnceWith("guarded-business", now);
});
