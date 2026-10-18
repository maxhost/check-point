import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { BackofficeResourceTicket } from "../backoffice-context-state";
const h = vi.hoisted(() => ({
  record: vi.fn(),
  driver: vi.fn(),
  config: null as null | { onDoneClick: () => void },
}));
vi.mock("./onboarding-api", () => ({ recordOnboardingTour: h.record }));
vi.mock("driver.js", () => ({
  driver: (config: NonNullable<typeof h.config>) => {
    h.driver();
    h.config = config;
    return { drive: vi.fn(), destroy: vi.fn() };
  },
}));
import { captureOnboardingTourIntent } from "./onboarding-tour-persistence";
import { startOnboardingTour } from "./onboarding-tour";
const ticket = (): BackofficeResourceTicket => ({
  resource: "checklist",
  scopeKey: "a".repeat(64),
  epoch: 0,
  generation: 0,
});
let current: BackofficeResourceTicket | null;
const context = {
  captureTicket: vi.fn(() => current),
  invalidate: vi.fn(),
  retire: vi.fn(() => {
    current = null;
  }),
};
beforeEach(() => {
  vi.clearAllMocks();
  current = ticket();
  h.config = null;
  h.record.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.restoreAllMocks());
it("missing or retired context cannot create a persistent intention", () => {
  expect(captureOnboardingTourIntent("catalog", null)).toBeNull();
  current = null;
  expect(captureOnboardingTourIntent("catalog", context)).toBeNull();
  expect(h.record).not.toHaveBeenCalled();
});
it.each(["scope", "epoch"])(
  "captures values and discards a changed %s before save",
  async (field) => {
    const intent = captureOnboardingTourIntent("catalog", context)!;
    current = {
      ...current!,
      [field === "scope" ? "scopeKey" : "epoch"]:
        field === "scope" ? "b".repeat(64) : 1,
    };
    expect(intent.isCurrent()).toBe(false);
    expect(await intent.persistProgress("completed")).toBe(false);
    expect(context.invalidate).not.toHaveBeenCalled();
    expect(h.record).not.toHaveBeenCalled();
  },
);
it("copies the ticket instead of retaining a mutable scope reference", async () => {
  const intent = captureOnboardingTourIntent("catalog", context)!;
  (current as { scopeKey: string }).scopeKey = "b".repeat(64);
  expect(await intent.persistProgress("completed")).toBe(false);
  expect(h.record).not.toHaveBeenCalled();
});
it("captures before RAF, so an intervening account change never starts the driver", () => {
  const intent = captureOnboardingTourIntent("catalog", context)!;
  const raf = () => {
    if (intent.isCurrent())
      startOnboardingTour({
        tourId: "catalog",
        steps: [],
        persistProgress: intent.persistProgress,
      });
  };
  current = { ...ticket(), scopeKey: "b".repeat(64) };
  raf();
  expect(h.driver).not.toHaveBeenCalled();
  expect(h.record).not.toHaveBeenCalled();
});
it("a visible tour's save is discarded after a new login for the same account", async () => {
  const intent = captureOnboardingTourIntent("catalog", context)!;
  startOnboardingTour({
    tourId: "catalog",
    steps: [],
    persistProgress: intent.persistProgress,
  });
  current = { ...ticket(), scopeKey: "b".repeat(64) }; // New native session changes the signed scope.
  h.config!.onDoneClick();
  await Promise.resolve();
  expect(h.record).not.toHaveBeenCalled();
  expect(context.retire).not.toHaveBeenCalled();
});
it("checklist generation changes do not cancel the intention; invalidation is synchronous before scoped POST", async () => {
  const intent = captureOnboardingTourIntent("catalog", context)!;
  current = { ...ticket(), generation: 20 };
  expect(intent.isCurrent()).toBe(true);
  const pending = intent.persistProgress("completed");
  expect(context.invalidate).toHaveBeenCalledExactlyOnceWith(["checklist"]);
  expect(h.record).toHaveBeenCalledExactlyOnceWith("catalog", "completed", {
    scopeKey: "a".repeat(64),
  });
  expect(context.invalidate.mock.invocationCallOrder[0]).toBeLessThan(
    h.record.mock.invocationCallOrder[0],
  );
  expect(await pending).toBe(true);
});
it("409 retires the current epoch once, without replay or a saved callback", async () => {
  h.record.mockRejectedValue({
    status: 409,
    code: "backoffice_context_changed",
  });
  const intent = captureOnboardingTourIntent("brand", context)!;
  expect(await intent.persistProgress("completed")).toBe(false);
  expect(await intent.persistProgress("completed")).toBe(false);
  expect(context.retire).toHaveBeenCalledTimes(1);
  expect(captureOnboardingTourIntent("brand", context)).toBeNull();
  expect(h.record).toHaveBeenCalledTimes(1);
});
it("an operational failure stays visible and only an explicit new intention retries", async () => {
  const error = new Error("offline");
  h.record.mockRejectedValueOnce(error);
  const intent = captureOnboardingTourIntent("program", context)!;
  await expect(intent.persistProgress("skipped")).rejects.toBe(error);
  expect(context.retire).not.toHaveBeenCalled();
  expect(await intent.persistProgress("skipped")).toBe(false);
  current = { ...ticket(), scopeKey: "b".repeat(64) };
  const retry = captureOnboardingTourIntent("program", context)!;
  expect(await retry.persistProgress("skipped")).toBe(true);
  expect(h.record.mock.calls).toEqual([
    ["program", "skipped", { scopeKey: "a".repeat(64) }],
    ["program", "skipped", { scopeKey: "b".repeat(64) }],
  ]);
});
it.each(["success", "409", "offline"])(
  "an old in-flight %s result cannot save or retire a newer epoch",
  async (result) => {
    let resolve!: () => void, reject!: (error: unknown) => void;
    h.record.mockImplementation(
      () =>
        new Promise<void>((yes, no) => {
          resolve = yes;
          reject = no;
        }),
    );
    const intent = captureOnboardingTourIntent("staff", context)!;
    const pending = intent.persistProgress("completed");
    current = { ...ticket(), scopeKey: "b".repeat(64), epoch: 1 };
    if (result === "success") resolve();
    else
      reject(
        result === "409"
          ? { code: "backoffice_context_changed" }
          : new Error("offline"),
      );
    expect(await pending).toBe(false);
    expect(context.retire).not.toHaveBeenCalled();
    expect(h.record).toHaveBeenCalledExactlyOnceWith("staff", "completed", {
      scopeKey: "a".repeat(64),
    });
  },
);
it("persist:false local help needs no captured scope and never sends a POST", () => {
  current = null;
  startOnboardingTour({ tourId: "locations", steps: [], persist: false });
  h.config!.onDoneClick();
  expect(context.captureTicket).not.toHaveBeenCalled();
  expect(context.invalidate).not.toHaveBeenCalled();
  expect(h.record).not.toHaveBeenCalled();
});
