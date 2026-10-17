import { afterEach, describe, expect, it, vi } from "vitest";
import { ANALYTICS_POLICY } from "@mi-pasaporte/domain/analytics/policy/index";
const state = vi.hoisted(() => ({
  ready: false,
  resolve: () => {},
  after: [] as (() => Promise<void>)[],
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (work: () => Promise<void>) => state.after.push(work),
}));
vi.mock("../evaluation", () => ({
  evaluateBusiness: () =>
    new Promise<void>((resolve) => {
      state.resolve = () => {
        state.ready = true;
        resolve();
      };
    }),
  evaluateDueBusinesses: vi.fn(),
}));
vi.mock("../lifecycle", () => ({
  decideInboxCard: vi.fn(),
  cleanupInbox: vi.fn(),
  readInbox: async () => ({
    state: state.ready ? "ready" : "preparing",
    preparedAt: null,
    cards: state.ready ? [{ id: "today" }] : [{ id: "persisted-stock" }],
  }),
}));
vi.mock("../../api-permission", () => ({
  requireApiPermissionSinGateDeEmail: vi.fn(),
}));
import { inboxWithFallback } from "./index";
afterEach(() => {
  vi.useRealTimers();
  state.ready = false;
  state.after = [];
});
describe("AN-1 first-open budget", () => {
  it("returns valid persisted notices at the configured budget and completes with after", async () => {
    vi.useFakeTimers();
    const pending = inboxWithFallback("business", {
      role: "owner",
      permissions: ["analytics"],
    });
    await vi.advanceTimersByTimeAsync(
      ANALYTICS_POLICY.operation.fallbackWaitMs - 1,
    );
    expect(state.after).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect((await pending).cards[0]?.id).toBe("persisted-stock");
    state.resolve();
    await state.after[0]!();
    expect(state.ready).toBe(true);
  });
  it("returns completed cards immediately when evaluation fits the budget", async () => {
    vi.useFakeTimers();
    const pending = inboxWithFallback("business", {
      role: "owner",
      permissions: ["analytics"],
    });
    await vi.advanceTimersByTimeAsync(0);
    state.resolve();
    expect((await pending).cards[0]?.id).toBe("today");
  });
});
