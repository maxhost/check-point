import { describe, expect, it, vi } from "vitest";
import { createBackofficeContextController } from "../backoffice-context-controller";
import type { BackofficeInitialContext } from "../../../backoffice-context-contract";
import type { SummaryAdapters } from "./summary-context-resource";
import { PanelRequestError } from "../panel-request";

const core: BackofficeInitialContext = {
  version: 1,
  bootId: "summary-boot",
  scopeKey: "a".repeat(64),
  userId: "reader",
  emailVerified: true,
  business: {
    id: "b",
    name: "Fixture",
    status: "active",
    timezone: "UTC",
    currencyCode: "USD",
  },
  membership: { role: "owner", status: "active", permissions: ["analytics"] },
  billing: { access: "subscribed", trialEndsAt: null, trialDaysLeft: null },
};
const payload = (todayRevenueMinor = 123) => ({
  version: 1,
  date: "2026-10-20",
  timezone: "UTC",
  currencyCode: "USD",
  minorUnit: 2,
  readAt: "2026-10-20T15:00:00Z",
  monthBreakEvenMinor: null,
  dailyBreakEvenMinor: null,
  todayRevenueMinor,
  estimated: false,
  unavailableReason: "closed_month",
});
const flush = async () => {
  for (let i = 0; i < 24; i++) await Promise.resolve();
};
function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function setup() {
  const io = {
    readSummary: vi.fn<SummaryAdapters["readSummary"]>(async () => payload()),
    readSession: vi.fn(async () => {
      throw new Error("unexpected reporter");
    }),
    readModules: vi.fn(async () => []),
    readInbox: vi.fn(),
    decideInbox: vi.fn(),
    readChecklist: vi.fn(),
    verifyEmail: vi.fn(),
    navigate: vi.fn(),
    requestRefresh: vi.fn(),
  };
  const controller = createBackofficeContextController(core, io);
  return { controller, io };
}

describe("0239 summary in the existing document owner", () => {
  it("reads only while observed; StrictMode/two readers coalesce, remount rereads without session/modules", async () => {
    const { controller: c, io } = setup();
    c.attach();
    c.refreshSummary();
    await flush();
    expect(io.readSummary).not.toHaveBeenCalled();
    const first = c.acquireSummary();
    first();
    const second = c.acquireSummary();
    const third = c.acquireSummary();
    await flush();
    expect(io.readSummary).toHaveBeenCalledTimes(1);
    expect(c.getSnapshot().summary.data?.todayRevenueMinor).toBe(123);
    expect(io.readSession).not.toHaveBeenCalled();
    expect(io.readModules).not.toHaveBeenCalled();
    second();
    third();
    await flush();
    c.refreshSummary();
    await flush();
    expect(io.readSummary).toHaveBeenCalledTimes(1);
    c.acquireSummary();
    await flush();
    expect(io.readSummary).toHaveBeenCalledTimes(2);
  });
  it("groups focus/online intentions and preserves the previous snapshot on operational failure", async () => {
    const { controller: c, io } = setup();
    c.acquireSummary();
    await flush();
    c.revalidateVisible();
    c.revalidateVisible();
    await flush();
    expect(io.readSummary).toHaveBeenCalledTimes(2);
    io.readSummary.mockRejectedValueOnce(new Error("offline"));
    c.refreshSummary();
    await flush();
    expect(c.getSnapshot().summary).toMatchObject({
      status: "unavailable",
      data: { todayRevenueMinor: 123 },
    });
  });
  it("cancels obsolete reads and never lets an older result overwrite a newer intention", async () => {
    const { controller: c, io } = setup();
    const old = deferred();
    io.readSummary.mockReturnValueOnce(old.promise);
    c.acquireSummary();
    await flush();
    const signal = io.readSummary.mock.calls[0]![0];
    c.refreshSummary();
    await flush();
    expect(signal.aborted).toBe(true);
    old.resolve(payload(999));
    await flush();
    expect(io.readSummary).toHaveBeenCalledTimes(2);
    expect(c.getSnapshot().summary.data?.todayRevenueMinor).toBe(123);
  });
  it.each([401, 409])(
    "withdraws private presentation on %s without replay",
    async (status) => {
      const { controller: c, io } = setup();
      io.readSummary.mockRejectedValueOnce(
        new PanelRequestError(
          "Denied",
          status === 409 ? "backoffice_context_changed" : "unauthorized",
          status,
          {},
        ),
      );
      c.acquireSummary();
      await flush();
      expect(c.getSnapshot().core).toBeNull();
      expect(c.getSnapshot().summary.data).toBeNull();
      expect(io.readSummary).toHaveBeenCalledTimes(1);
    },
  );
  it.each([402, 403])(
    "clears only the resource on %s and never loops",
    async (status) => {
      const { controller: c, io } = setup();
      c.acquireSummary();
      await flush();
      io.readSummary.mockRejectedValueOnce(
        new PanelRequestError("Denied", "restricted", status, {}),
      );
      c.refreshSummary();
      await flush();
      expect(c.getSnapshot().core).not.toBeNull();
      expect(c.getSnapshot().summary).toEqual({
        data: null,
        status: "restricted",
      });
      expect(io.readSummary).toHaveBeenCalledTimes(2);
    },
  );
  it("rejects malformed money instead of inventing zero; scope withdrawal discards late responses", async () => {
    const { controller: c, io } = setup();
    io.readSummary.mockResolvedValueOnce({
      ...payload(),
      todayRevenueMinor: undefined,
    });
    c.acquireSummary();
    await flush();
    expect(c.getSnapshot().summary).toEqual({
      data: null,
      status: "unavailable",
    });
    const late = deferred();
    io.readSummary.mockReturnValueOnce(late.promise);
    c.refreshSummary();
    await flush();
    c.retire();
    late.resolve(payload());
    await flush();
    expect(c.getSnapshot().summary.data).toBeNull();
    expect(c.getSnapshot().core).toBeNull();
  });
});
