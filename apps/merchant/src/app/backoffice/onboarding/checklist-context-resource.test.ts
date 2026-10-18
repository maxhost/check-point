import { describe, expect, it, vi } from "vitest";
import type {
  BackofficeInitialContext,
  ModuleDTO,
} from "../../../backoffice-context-contract";
import { createBackofficeContextController } from "../backoffice-context-controller";
import {
  OnboardingRequestError,
  type OnboardingChecklist,
} from "./onboarding-api";
import type { ChecklistAdapters } from "./checklist-context-resource";

const core: BackofficeInitialContext = {
  version: 1,
  bootId: "checklist-boot",
  scopeKey: "a".repeat(64),
  userId: "reader",
  emailVerified: false,
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
const payload = (done = false): OnboardingChecklist => ({
  locale: "es",
  items: [
    {
      id: "verify",
      anchor: "verify-email",
      position: 0,
      required: true,
      done,
      title: "Verifica tu email",
      body: "Fixture",
    },
  ],
});
const module: ModuleDTO = {
  id: "stock",
  name: "Stock",
  description: "Fixture",
  enabled: true,
  suggested: false,
  requires: [],
  navigation: [],
  permissions: [],
};
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
  for (let i = 0; i < 20; i++) await Promise.resolve();
}
function setup() {
  const io = {
    readSession: vi.fn(async (): Promise<unknown> => ({
      authenticated: true,
      user: {
        id: core.userId,
        name: "Fixture",
        email: "fixture@example.invalid",
        emailVerified: true,
      },
      business: {
        ...core.business,
        slug: "fixture",
        suspensionReason: null,
        enabledModules: [],
      },
      membership: core.membership,
      billing: core.billing,
    })),
    readModules: vi.fn(async () => [module]),
    readInbox: vi.fn(),
    decideInbox: vi.fn(),
    readChecklist: vi.fn<ChecklistAdapters["readChecklist"]>(async () =>
      payload(),
    ),
    verifyEmail: vi.fn<ChecklistAdapters["verifyEmail"]>(async () => ({
      sent: true,
    })),
    navigate: vi.fn(),
  };
  const controller = createBackofficeContextController(core, io);
  return { controller, io };
}

describe("0238 single checklist owner", () => {
  it("no GET at construction/attach/seed; one scoped GET only after a visible acquisition", async () => {
    const { controller, io } = setup();
    controller.attach();
    controller.applyModulesSeed({
      bootId: core.bootId,
      scopeKey: core.scopeKey,
      result: { state: "ready", modules: [] },
    });
    await flush();
    expect(io.readChecklist).not.toHaveBeenCalled();
    controller.acquireChecklist();
    await flush();
    expect(io.readChecklist).toHaveBeenCalledOnce();
    expect(io.readChecklist.mock.calls[0][1]).toMatchObject({
      scopeKey: core.scopeKey,
      resource: "checklist",
    });
    expect(controller.getSnapshot().checklist).toEqual({
      data: payload(),
      status: "ready",
    });
  });
  it("two readers/StrictMode cleanup reattach share GET and releasing one cannot abort another", async () => {
    const { controller, io } = setup();
    const read = deferred<OnboardingChecklist>();
    io.readChecklist.mockReturnValue(read.promise);
    const release = controller.acquireChecklist();
    release();
    controller.acquireChecklist();
    const releaseOther = controller.acquireChecklist();
    await flush();
    releaseOther();
    await flush();
    expect(io.readChecklist).toHaveBeenCalledOnce();
    expect(io.readChecklist.mock.calls[0][0].aborted).toBe(false);
    read.resolve(payload());
    await flush();
    expect(controller.getSnapshot().checklist.data).toEqual(payload());
  });
  it("last release cancels only its GET without closing unrelated initial seed; remount drains before new GET", async () => {
    const { controller, io } = setup();
    const old = deferred<OnboardingChecklist>();
    const fresh = deferred<OnboardingChecklist>();
    io.readChecklist
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(fresh.promise);
    const release = controller.acquireChecklist();
    await flush();
    release();
    await flush();
    expect(io.readChecklist.mock.calls[0][0].aborted).toBe(true);
    expect(io.readModules).not.toHaveBeenCalled();
    expect(controller.getSnapshot().initialModulesTicket).not.toBeNull();
    controller.acquireChecklist();
    await flush();
    expect(io.readChecklist).toHaveBeenCalledOnce();
    old.resolve(payload(true));
    await flush();
    expect(io.readChecklist).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().checklist.data).toBeNull();
    fresh.resolve(payload(false));
    await flush();
    expect(controller.getSnapshot().checklist.data).toEqual(payload(false));
  });
  it("intentional remount after a settled GET makes another request rather than caching its response", async () => {
    const { controller, io } = setup();
    const release = controller.acquireChecklist();
    await flush();
    release();
    await flush();
    controller.acquireChecklist();
    await flush();
    expect(io.readChecklist).toHaveBeenCalledTimes(2);
  });
  it("duplicate synchronous END signals coalesce a GET and invalidate BEFORE reading; old finally cannot erase pending", async () => {
    const { controller, io } = setup();
    const old = deferred<OnboardingChecklist>();
    const fresh = deferred<OnboardingChecklist>();
    io.readChecklist
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(fresh.promise);
    controller.acquireChecklist();
    await flush();
    controller.refreshChecklist();
    controller.refreshChecklist();
    expect(controller.getSnapshot().generations.checklist).toBe(2);
    await flush();
    expect(io.readChecklist).toHaveBeenCalledOnce();
    expect(io.readChecklist.mock.calls[0][0].aborted).toBe(true);
    old.resolve(payload(false));
    await flush();
    expect(io.readChecklist).toHaveBeenCalledTimes(2);
    expect(io.readChecklist.mock.calls[1][1].generation).toBe(2);
    expect(controller.getSnapshot().checklist.data).toBeNull();
    fresh.resolve(payload(true));
    await flush();
    expect(controller.getSnapshot().checklist.data).toEqual(payload(true));
  });
  it("pre-tour invalidation reads while mounted, final END disqualifies the pre-confirmation GET and keeps only one pending", async () => {
    const { controller, io } = setup();
    const preSave = deferred<OnboardingChecklist>();
    io.readChecklist
      .mockResolvedValueOnce(payload(false))
      .mockReturnValueOnce(preSave.promise)
      .mockResolvedValueOnce(payload(true));
    controller.acquireChecklist();
    await flush();
    controller.invalidate(["checklist"]);
    await flush();
    expect(io.readChecklist).toHaveBeenCalledTimes(2);
    for (let i = 0; i < 5; i++) controller.refreshChecklist();
    await flush();
    expect(io.readChecklist).toHaveBeenCalledTimes(2);
    preSave.resolve(payload(false));
    await flush();
    expect(io.readChecklist).toHaveBeenCalledTimes(3);
    expect(controller.getSnapshot().checklist.data).toEqual(payload(true));
  });
  it("operational failure can be manually retried with a real new GET", async () => {
    const { controller, io } = setup();
    io.readChecklist.mockRejectedValueOnce(new Error("offline"));
    controller.acquireChecklist();
    await flush();
    expect(controller.getSnapshot().checklist.status).toBe("unavailable");
    expect(controller.getSnapshot().core).not.toBeNull();
    controller.refreshChecklist();
    await flush();
    expect(io.readChecklist).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().checklist.status).toBe("ready");
  });
  it.each([402, 403])(
    "denial%s hides checklist without a navigation/retry loop",
    async (status) => {
      const { controller, io } = setup();
      controller.acquireChecklist();
      await flush();
      io.readChecklist.mockRejectedValueOnce(
        new OnboardingRequestError("denied", "denied", status),
      );
      controller.refreshChecklist();
      await flush();
      expect(controller.getSnapshot().checklist).toEqual({
        data: null,
        status: "restricted",
      });
      expect(io.navigate).not.toHaveBeenCalled();
      expect(controller.getSnapshot().core).not.toBeNull();
      expect(io.readChecklist).toHaveBeenCalledTimes(2);
    },
  );
  it.each([401, 409])(
    "auth/scope denial%s clears all private snapshots once and prevents later GET",
    async (status) => {
      const { controller, io } = setup();
      io.readChecklist.mockRejectedValue(
        new OnboardingRequestError(
          "denied",
          status === 409 ? "backoffice_context_changed" : "unauthenticated",
          status,
        ),
      );
      controller.acquireChecklist();
      await flush();
      controller.refreshChecklist();
      await flush();
      expect(controller.getSnapshot().core).toBeNull();
      expect(controller.getSnapshot().checklist.data).toBeNull();
      expect(controller.getServerSnapshot().checklist.data).toBeNull();
      expect(io.navigate).toHaveBeenCalledExactlyOnceWith(
        status === 401 ? "/" : "/backoffice",
      );
      expect(io.readChecklist).toHaveBeenCalledOnce();
    },
  );
  it("ordinary409 is operational, distinct from scope409", async () => {
    const { controller, io } = setup();
    io.readChecklist.mockRejectedValueOnce(
      new OnboardingRequestError("conflict", "other_conflict", 409),
    );
    controller.acquireChecklist();
    await flush();
    expect(controller.getSnapshot().core).not.toBeNull();
    expect(controller.getSnapshot().checklist.status).toBe("unavailable");
    expect(io.navigate).not.toHaveBeenCalled();
  });
  it("new same-scope RSC boot invalidates the visible settled checklist once", async () => {
    const { controller, io } = setup();
    controller.acquireChecklist();
    await flush();
    controller.observeCoreSeed({ ...core, bootId: "next" });
    await flush();
    expect(io.readChecklist).toHaveBeenCalledTimes(2);
    controller.observeCoreSeed({ ...core, bootId: "next" });
    await flush();
    expect(io.readChecklist).toHaveBeenCalledTimes(2);
  });
  it("retirement/dispose synchronously clear data and observe late rejects without revival", async () => {
    const { controller, io } = setup();
    controller.acquireChecklist();
    await flush();
    const late = deferred<OnboardingChecklist>();
    io.readChecklist.mockReturnValueOnce(late.promise);
    controller.refreshChecklist();
    await flush();
    controller.dispose();
    expect(controller.getSnapshot().checklist.data).toBeNull();
    late.reject(new Error("late"));
    await flush();
    expect(controller.getSnapshot().checklist.data).toBeNull();
  });
  it("sent auth response produces feedback only, no raw checklist/core patch or auxiliary GET", async () => {
    const { controller, io } = setup();
    controller.acquireChecklist();
    await flush();
    expect(await controller.verifyChecklistEmail()).toBe("sent");
    expect(controller.getSnapshot().checklist.data).toEqual(payload(false));
    expect(controller.getSnapshot().core?.emailVerified).toBe(false);
    expect(io.readChecklist).toHaveBeenCalledOnce();
    expect(io.readSession).not.toHaveBeenCalled();
  });
  it("verified auth response confirms via scoped GET + reporter, never via raw result; generation alone does not cancel intention", async () => {
    const { controller, io } = setup();
    controller.acquireChecklist();
    await flush();
    const verify = deferred<unknown>();
    const checklist = deferred<OnboardingChecklist>();
    const reporter = deferred<unknown>();
    io.verifyEmail.mockReturnValue(verify.promise);
    const result = controller.verifyChecklistEmail();
    controller.refreshChecklist();
    await flush();
    io.readChecklist.mockReturnValueOnce(checklist.promise);
    io.readSession.mockReturnValueOnce(reporter.promise);
    verify.resolve({ verified: true, items: payload(true).items });
    expect(await result).toBe("verified");
    await flush();
    expect(controller.getSnapshot().checklist.data).toEqual(payload(false));
    expect(controller.getSnapshot().core?.emailVerified).toBe(false);
    expect(io.readChecklist.mock.calls[2][1].scopeKey).toBe(core.scopeKey);
    checklist.resolve(payload(true));
    reporter.resolve({
      authenticated: true,
      user: { id: core.userId, emailVerified: true },
      business: core.business,
      membership: core.membership,
      billing: core.billing,
    });
    await flush();
    expect(controller.getSnapshot().checklist.data).toEqual(payload(true));
    expect(controller.getSnapshot().core?.emailVerified).toBe(true);
  });
  it.each(["sent", "verified", "error"])(
    "late verify %s after identity retirement cannot update UI or start GET",
    async (outcome) => {
      const { controller, io } = setup();
      const verify = deferred<unknown>();
      io.verifyEmail.mockReturnValue(verify.promise);
      const result = controller.verifyChecklistEmail();
      controller.observeCoreSeed({
        ...core,
        scopeKey: "b".repeat(64),
        userId: "other",
        bootId: "other",
      });
      if (outcome === "error") verify.reject(new Error("late error"));
      else verify.resolve({ [outcome]: true });
      expect(await result).toBe("obsolete");
      await flush();
      expect(io.readChecklist).not.toHaveBeenCalled();
      expect(io.readSession).not.toHaveBeenCalled();
      expect(controller.getSnapshot().checklist.data).toBeNull();
    },
  );
  it.each([{}, null, { sent: false }, "invalid"])(
    "malformed auth response %j is an operational error, with manual retry available",
    async (response) => {
      const { controller, io } = setup();
      io.verifyEmail.mockResolvedValueOnce(response);
      expect(await controller.verifyChecklistEmail()).toBe("error");
      expect(controller.getSnapshot().core).not.toBeNull();
      expect(await controller.verifyChecklistEmail()).toBe("sent");
      expect(io.verifyEmail).toHaveBeenCalledTimes(2);
    },
  );
});
