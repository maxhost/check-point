import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  AnalyticsInboxMutation,
  AnalyticsInboxResponse,
  InboxCard,
} from "@mi-pasaporte/domain/analytics/types";
import type { BackofficeInitialContext } from "../../../backoffice-context-contract";
import { createBackofficeContextController } from "../backoffice-context-controller";
import { PanelRequestError } from "../panel-request";
import type { InboxAdapters } from "./inbox-context-resource";

const core: BackofficeInitialContext = {
  version: 1,
  bootId: "inbox-boot",
  scopeKey: "a".repeat(64),
  userId: "reader",
  emailVerified: true,
  business: {
    id: "business",
    name: "Fixture",
    status: "active",
    timezone: "UTC",
    currencyCode: "USD",
  },
  membership: { role: "owner", status: "active", permissions: ["analytics"] },
  billing: { access: "subscribed", trialEndsAt: null, trialDaysLeft: null },
};
const card: InboxCard = {
  id: "card",
  version: "c".repeat(64),
  category: "informational",
  expiresAt: "2099-01-01T00:00:00.000Z",
  period: { label: "Fixture", from: "2026-01-01", to: "2026-01-02" },
  decisions: [{ key: "seen", label: "Entendido" }],
  cardKey: "fixture",
  sender: "Fixture",
  title: "Aviso",
  body: "Aviso propio",
  amountAtStake: null,
  quality: "observed",
  action: null,
};
const payload = (cards: InboxCard[] = [card]): AnalyticsInboxResponse => ({
  contractVersion: 2,
  policyVersion: "fixture",
  timezone: "UTC",
  state: "ready",
  preparedAt: null,
  nextReminderAt: null,
  refreshAfterMs: null,
  cards,
});
const mutation: AnalyticsInboxMutation = { cards: [], nextReminderAt: null };
const intent = () => ({ card: { ...card }, decision: "seen" as const });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
async function flush() {
  for (let i = 0; i < 18; i++) await Promise.resolve();
}
function setup() {
  const io = {
    readChecklist: vi.fn(),
    verifyEmail: vi.fn(),
    readSession: vi.fn(async (): Promise<unknown> => {
      throw new Error("unexpected reporter");
    }),
    readModules: vi.fn(async () => []),
    readInbox: vi.fn<InboxAdapters["readInbox"]>(async () => payload()),
    decideInbox: vi.fn<InboxAdapters["decideInbox"]>(async () => mutation),
    navigate: vi.fn(),
  };
  const controller = createBackofficeContextController(core, io);
  return { io, controller };
}
afterEach(() => vi.useRealTimers());

describe("0238 Inbox single document owner", () => {
  it("does not read at construction, render, seed or provider attach; starts only for a visible subscriber", async () => {
    const { io, controller } = setup();
    controller.attach();
    controller.applyModulesSeed({
      bootId: core.bootId,
      scopeKey: core.scopeKey,
      result: { state: "ready", modules: [] },
    });
    await flush();
    expect(io.readInbox).not.toHaveBeenCalled();
    controller.acquireInbox();
    await flush();
    expect(io.readInbox).toHaveBeenCalledOnce();
    expect(io.readInbox.mock.calls[0][1].scopeKey).toBe(core.scopeKey);
    expect(controller.getSnapshot().inbox.data).toEqual(payload());
  });
  it("two subscribers and StrictMode release/reattach share one GET and one snapshot", async () => {
    const { io, controller } = setup();
    const work = deferred<AnalyticsInboxResponse>();
    io.readInbox.mockReturnValue(work.promise);
    const release = controller.acquireInbox();
    release();
    controller.acquireInbox();
    const releaseOther = controller.acquireInbox();
    await flush();
    expect(io.readInbox).toHaveBeenCalledOnce();
    releaseOther();
    expect(io.readInbox.mock.calls[0][0].aborted).toBe(false);
    work.resolve(payload());
    await flush();
    expect(controller.getSnapshot().inbox.data?.cards).toHaveLength(1);
  });
  it("coalesces synchronous signals and preserves one queued refresh during a pending GET", async () => {
    const { io, controller } = setup();
    const work = deferred<AnalyticsInboxResponse>();
    io.readInbox.mockReturnValueOnce(work.promise);
    controller.acquireInbox();
    controller.refreshInbox();
    controller.refreshInbox();
    await flush();
    for (let n = 0; n < 8; n++) controller.refreshInbox();
    await flush();
    expect(io.readInbox).toHaveBeenCalledOnce();
    work.resolve(payload());
    await flush();
    expect(io.readInbox).toHaveBeenCalledTimes(2);
    controller.refreshInbox();
    await flush();
    expect(io.readInbox).toHaveBeenCalledTimes(3); // Settled responses are not a transport cache.
  });
  it("invalidates before POST, captures immutable intent, drains old GET and queues one refresh through POST/remount/focus", async () => {
    const { io, controller } = setup();
    const oldRead = deferred<AnalyticsInboxResponse>();
    const write = deferred<AnalyticsInboxMutation>();
    const fresh = deferred<AnalyticsInboxResponse>();
    io.readInbox
      .mockResolvedValueOnce(payload())
      .mockReturnValueOnce(oldRead.promise)
      .mockReturnValueOnce(fresh.promise);
    io.decideInbox.mockImplementation((command, ticket) => {
      expect(controller.captureTicket("inbox")).toEqual(ticket);
      expect(controller.getSnapshot().generations.inbox).toBe(1);
      expect(Object.isFrozen(command.body)).toBe(true);
      return write.promise;
    });
    const release = controller.acquireInbox();
    await flush();
    controller.refreshInbox();
    await flush();
    const input = intent();
    const result = controller.decideInbox(input);
    input.card.id = "mutated";
    input.card.version = "mutated";
    expect(io.decideInbox.mock.calls[0][0]).toMatchObject({
      cardId: "card",
      body: { expectedVersion: card.version },
    });
    expect(Object.isFrozen(io.decideInbox.mock.calls[0][0].body)).toBe(true);
    expect(io.readInbox.mock.calls[1][0].aborted).toBe(true);
    release();
    await flush();
    controller.acquireInbox();
    for (let n = 0; n < 8; n++) controller.refreshInbox();
    oldRead.resolve(payload([{ ...card, title: "OLD" }]));
    await flush();
    expect(io.readInbox).toHaveBeenCalledTimes(2);
    write.resolve(mutation);
    await result;
    await flush();
    expect(controller.getSnapshot().inbox.data?.cards).toEqual([]);
    expect(io.readInbox).toHaveBeenCalledTimes(3);
    fresh.resolve(payload([]));
    await flush();
    expect(controller.getSnapshot().inbox.data?.cards).toEqual([]);
    expect(controller.getSnapshot().inbox.pending).toBeNull();
  });
  it("never starts a post-decision GET before an invalidated transport physically drains", async () => {
    const { io, controller } = setup();
    const old = deferred<AnalyticsInboxResponse>();
    io.readInbox.mockReturnValueOnce(old.promise);
    controller.acquireInbox();
    await flush();
    await controller.decideInbox(intent());
    await flush();
    expect(io.readInbox).toHaveBeenCalledOnce();
    old.resolve(payload());
    await flush();
    expect(io.readInbox).toHaveBeenCalledTimes(2);
  });
  it("retirement clears cards synchronously, discards late POST/GET and prohibits new operations/replay", async () => {
    const { io, controller } = setup();
    const write = deferred<AnalyticsInboxMutation>();
    io.decideInbox.mockReturnValue(write.promise);
    controller.acquireInbox();
    await flush();
    const result = controller.decideInbox(intent());
    const ticket = io.decideInbox.mock.calls[0][1];
    controller.observeCoreSeed({
      ...core,
      userId: "other",
      scopeKey: "b".repeat(64),
      bootId: "other",
    });
    expect(controller.getSnapshot().inbox).toEqual({
      data: null,
      error: "",
      pending: null,
    });
    expect(ticket.scopeKey).toBe(core.scopeKey);
    write.resolve({ cards: [card], nextReminderAt: null });
    await result;
    await flush();
    controller.refreshInbox();
    await controller.decideInbox(intent());
    controller.acquireInbox();
    await flush();
    expect(io.decideInbox).toHaveBeenCalledOnce();
    expect(io.readInbox).toHaveBeenCalledOnce();
    expect(io.navigate).toHaveBeenCalledExactlyOnceWith("/backoffice");
    expect(controller.getServerSnapshot().inbox.data).toBeNull();
  });
  it("ambiguous error retains operationId/version for an explicit retry in the same scope, with no automatic POST", async () => {
    const { io, controller } = setup();
    io.decideInbox.mockRejectedValueOnce(new Error("network lost"));
    controller.acquireInbox();
    await flush();
    await controller.decideInbox(intent());
    await flush();
    expect(io.decideInbox).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().inbox.error).toContain(
      "No pudimos guardar",
    );
    await controller.decideInbox(intent());
    expect(io.decideInbox.mock.calls[0][0]).toEqual(
      io.decideInbox.mock.calls[1][0],
    );
    expect(io.decideInbox.mock.calls[1][0].body.expectedVersion).toBe(
      card.version,
    );
    await controller.decideInbox(intent());
    expect(io.decideInbox.mock.calls[2][0].body.operationId).not.toBe(
      io.decideInbox.mock.calls[1][0].body.operationId,
    );
  });
  it("new decision/reminder intention gets a different id and simultaneous clicks cannot fan out", async () => {
    const { io, controller } = setup();
    const write = deferred<AnalyticsInboxMutation>();
    io.decideInbox
      .mockReturnValueOnce(write.promise)
      .mockRejectedValueOnce(new Error("ambiguous"));
    controller.acquireInbox();
    await flush();
    const first = controller.decideInbox(intent());
    await controller.decideInbox({ ...intent(), decision: "ignore" });
    expect(io.decideInbox).toHaveBeenCalledOnce();
    write.resolve(mutation);
    await first;
    await controller.decideInbox({
      ...intent(),
      decision: "snooze",
      remindAt: "2098-01-01T00:00:00Z",
    });
    await controller.decideInbox({
      ...intent(),
      decision: "snooze",
      remindAt: "2098-01-02T00:00:00Z",
    });
    expect(io.decideInbox.mock.calls[1][0].body.operationId).not.toBe(
      io.decideInbox.mock.calls[2][0].body.operationId,
    );
  });
  it("scope409 retires before ordinary card409 handling and never retries the POST", async () => {
    const { io, controller } = setup();
    controller.acquireInbox();
    await flush();
    io.decideInbox.mockRejectedValue(
      new PanelRequestError("changed", "backoffice_context_changed", 409, {}),
    );
    await controller.decideInbox(intent());
    await flush();
    expect(controller.getSnapshot().core).toBeNull();
    expect(controller.getSnapshot().inbox.data).toBeNull();
    expect(io.navigate).toHaveBeenCalledExactlyOnceWith("/backoffice");
    expect(io.decideInbox).toHaveBeenCalledOnce();
    expect(io.readInbox).toHaveBeenCalledOnce();
  });
  it.each([404, 409])(
    "card conflict %s keeps scope, releases id and performs one actual GET",
    async (status) => {
      const { io, controller } = setup();
      controller.acquireInbox();
      await flush();
      io.decideInbox.mockRejectedValueOnce(
        new PanelRequestError("stale card", "inbox_conflict", status, {}),
      );
      const result = await controller.decideInbox(intent());
      await flush();
      expect(result.conflict).toBe(true);
      expect(controller.getSnapshot().core).not.toBeNull();
      expect(io.navigate).not.toHaveBeenCalled();
      expect(io.readInbox).toHaveBeenCalledTimes(2);
      await controller.decideInbox(intent());
      expect(io.decideInbox.mock.calls[0][0].body.operationId).not.toBe(
        io.decideInbox.mock.calls[1][0].body.operationId,
      );
    },
  );
  it("invalid reminder remains a field error and an operational GET can be explicitly retried", async () => {
    const { io, controller } = setup();
    io.readInbox.mockRejectedValueOnce(new Error("temporarily down"));
    controller.acquireInbox();
    await flush();
    expect(controller.getSnapshot().inbox.error).toContain("No pudimos leer");
    controller.refreshInbox();
    await flush();
    expect(controller.getSnapshot().inbox.error).toBe("");
    io.decideInbox.mockRejectedValueOnce(
      new PanelRequestError("Invalid reminder", "invalid_reminder", 422, {}),
    );
    const result = await controller.decideInbox({
      ...intent(),
      decision: "snooze",
    });
    expect(result.reminderError).toBe("Invalid reminder");
    expect(controller.getSnapshot().inbox.error).toBe("");
    expect(controller.getSnapshot().core).not.toBeNull();
  });
  it("decision during a slow module stream recovers modules and rejects the original seed", async () => {
    const { io, controller } = setup();
    controller.acquireInbox();
    await flush();
    expect(controller.getSnapshot().modules.state).toBe("loading");
    await controller.decideInbox(intent());
    await flush();
    expect(io.readModules).toHaveBeenCalledOnce();
    expect(io.readSession).not.toHaveBeenCalled();
    controller.applyModulesSeed({
      bootId: core.bootId,
      scopeKey: core.scopeKey,
      result: { state: "restricted" },
    });
    expect(controller.getSnapshot().modules).toEqual({
      state: "ready",
      modules: [],
    });
  });
  it("last release aborts only its GET, remount drains then reads fresh and old finally cannot erase it", async () => {
    const { io, controller } = setup();
    const old = deferred<AnalyticsInboxResponse>();
    const fresh = deferred<AnalyticsInboxResponse>();
    io.readInbox
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(fresh.promise);
    const release = controller.acquireInbox();
    await flush();
    release();
    await flush();
    expect(io.readInbox.mock.calls[0][0].aborted).toBe(true);
    controller.acquireInbox();
    await flush();
    expect(io.readInbox).toHaveBeenCalledOnce();
    old.resolve(payload([{ ...card, title: "old" }]));
    await flush();
    expect(io.readInbox).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().inbox.data).toBeNull();
    fresh.resolve(payload());
    await flush();
    expect(controller.getSnapshot().inbox.data?.cards[0].title).toBe("Aviso");
  });
  it("releasing an Inbox GET cancels its transport without invalidating the unrelated initial module seed", async () => {
    const { io, controller } = setup();
    const old = deferred<AnalyticsInboxResponse>();
    io.readInbox.mockReturnValue(old.promise);
    const release = controller.acquireInbox();
    await flush();
    release();
    await flush();
    expect(io.readInbox.mock.calls[0][0].aborted).toBe(true);
    expect(io.readModules).not.toHaveBeenCalled();
    expect(controller.getSnapshot().initialModulesTicket).not.toBeNull();
    controller.applyModulesSeed({
      bootId: core.bootId,
      scopeKey: core.scopeKey,
      result: { state: "restricted" },
    });
    expect(controller.getSnapshot().modules.state).toBe("restricted");
    old.resolve(payload());
    await flush();
    expect(controller.getSnapshot().inbox.data).toBeNull();
  });
  it("expires cards locally before refresh and coalesces a reminder instant across consumers/remounts", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const { io, controller } = setup();
    const expiring = { ...card, expiresAt: "2026-01-01T00:00:01Z" };
    io.readInbox.mockResolvedValue(payload([expiring]));
    const release = controller.acquireInbox();
    await flush();
    vi.setSystemTime(new Date("2026-01-01T00:00:02Z"));
    controller.refreshInbox("reminder:2026-01-01");
    expect(controller.getSnapshot().inbox.data?.cards).toEqual([]);
    controller.refreshInbox("reminder:2026-01-01");
    await flush();
    expect(io.readInbox).toHaveBeenCalledTimes(2);
    release();
    controller.acquireInbox();
    await flush();
    const count = io.readInbox.mock.calls.length;
    controller.refreshInbox("reminder:2026-01-01");
    await flush();
    expect(io.readInbox).toHaveBeenCalledTimes(count);
  });
  it("same-scope invalidation during POST discards its result but releases pending and queues a fresh GET", async () => {
    const { io, controller } = setup();
    const write = deferred<AnalyticsInboxMutation>();
    io.decideInbox.mockReturnValue(write.promise);
    controller.acquireInbox();
    await flush();
    const result = controller.decideInbox(intent());
    controller.invalidate(["inbox"]);
    write.resolve(mutation);
    await result;
    await flush();
    expect(controller.getSnapshot().inbox.pending).toBeNull();
    expect(io.readInbox).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().inbox.data?.cards).toHaveLength(1);
  });
  it.each([401, 402, 403])(
    "authoritative GET denial %s clears cards without a reload loop for restricted access",
    async (status) => {
      const { io, controller } = setup();
      controller.acquireInbox();
      await flush();
      io.readInbox.mockRejectedValueOnce(
        new PanelRequestError("denied", "access_denied", status, {}),
      );
      controller.refreshInbox();
      await flush();
      expect(controller.getSnapshot().inbox.data).toBeNull();
      if (status === 401) {
        expect(controller.getSnapshot().core).toBeNull();
        expect(io.navigate).toHaveBeenCalledExactlyOnceWith("/");
      } else {
        expect(controller.getSnapshot().core).not.toBeNull();
        expect(io.navigate).not.toHaveBeenCalled();
        expect(io.readInbox).toHaveBeenCalledTimes(2);
      }
    },
  );
  it.each([402, 403])(
    "POST denial %s clears cards without replay or reload; explicit later GET can recover",
    async (status) => {
      const { io, controller } = setup();
      controller.acquireInbox();
      await flush();
      io.decideInbox.mockRejectedValueOnce(
        new PanelRequestError("restricted", "access_denied", status, {}),
      );
      await controller.decideInbox(intent());
      await flush();
      expect(controller.getSnapshot().inbox).toEqual({
        data: null,
        pending: null,
        error: "restricted",
      });
      expect(controller.getSnapshot().core).not.toBeNull();
      expect(io.navigate).not.toHaveBeenCalled();
      expect(io.decideInbox).toHaveBeenCalledOnce();
      expect(io.readInbox).toHaveBeenCalledOnce();
      controller.refreshInbox();
      await flush();
      expect(controller.getSnapshot().inbox.data?.cards).toHaveLength(1);
      expect(controller.getSnapshot().inbox.error).toBe("");
    },
  );
  it("GET scope409 retires without retrying or replaying a decision", async () => {
    const { io, controller } = setup();
    io.readInbox.mockRejectedValue(
      new PanelRequestError("changed", "backoffice_context_changed", 409, {}),
    );
    controller.acquireInbox();
    await flush();
    controller.refreshInbox();
    await controller.decideInbox(intent());
    await flush();
    expect(io.navigate).toHaveBeenCalledExactlyOnceWith("/backoffice");
    expect(io.readInbox).toHaveBeenCalledOnce();
    expect(io.decideInbox).not.toHaveBeenCalled();
  });
  it("observe new boot invalidates visible Inbox even after its GET settled; dispose observes rejected work", async () => {
    const { io, controller } = setup();
    controller.acquireInbox();
    await flush();
    const work = deferred<AnalyticsInboxResponse>();
    io.readInbox.mockReturnValueOnce(work.promise);
    controller.observeCoreSeed({ ...core, bootId: "next-boot" });
    await flush();
    expect(io.readInbox).toHaveBeenCalledTimes(2);
    controller.dispose();
    work.reject(new Error("late failure"));
    await flush();
    expect(controller.getSnapshot().inbox.data).toBeNull();
  });
});
