import { describe, expect, it, vi } from "vitest";
import type {
  BackofficeInitialContext,
  BackofficeModulesResult,
  ModuleDTO,
} from "../../backoffice-context-contract";
import type { SessionView } from "../../server/session-view";
import { createBackofficeContextController } from "./backoffice-context-controller";
import { ModuleRequestError } from "./settings/module-request";

const core: BackofficeInitialContext = {
  version: 1,
  bootId: "initial-boot",
  scopeKey: "a".repeat(64),
  userId: "fixture-user",
  emailVerified: true,
  business: {
    id: "fixture-business",
    name: "Fixture",
    status: "active",
    timezone: "UTC",
    currencyCode: "USD",
  },
  membership: {
    role: "owner",
    status: "active",
    permissions: ["analytics", "stock"],
  },
  billing: { access: "trial", trialDaysLeft: 10, trialEndsAt: null },
};
const module: ModuleDTO = {
  id: "stock",
  name: "Stock",
  description: "Fixture",
  enabled: true,
  requires: [],
  suggested: false,
  navigation: [],
  permissions: [],
};
const reporter = (): Extract<SessionView, { authenticated: true }> => ({
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
    enabledModules: ["stock"],
  },
  membership: { ...core.membership },
  billing: { ...core.billing },
});
const seed = (result: BackofficeModulesResult) => ({
  bootId: core.bootId,
  scopeKey: core.scopeKey,
  result,
});
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function adapters() {
  return {
    readSession: vi.fn(async (): Promise<unknown> => reporter()),
    readModules: vi.fn<
      Parameters<typeof createBackofficeContextController>[1]["readModules"]
    >(async () => [module]),
    readChecklist: vi.fn(),
    verifyEmail: vi.fn(),
    readSummary: async () => {
      throw new Error("unexpected summary read");
    },
    readInbox: vi.fn(),
    decideInbox: vi.fn(),
    requestRefresh: vi.fn(),
    navigate: vi.fn(),
  };
}

describe("0238 atomic document context controller", () => {
  it("does no I/O at construction/attach or for a ready seed, with stable server snapshot", async () => {
    const io = adapters();
    const controller = createBackofficeContextController(core, io);
    const server = controller.getServerSnapshot();
    const release = controller.attach();
    controller.applyModulesSeed(seed({ state: "ready", modules: [module] }));
    await flush();
    expect(controller.getServerSnapshot()).toBe(server);
    expect(controller.getSnapshot().modules).toEqual({
      state: "ready",
      modules: [module],
    });
    expect(io.readSession).not.toHaveBeenCalled();
    expect(io.readModules).not.toHaveBeenCalled();
    release();
    await flush();
  });

  it("recovers initial unavailable at most once, without a reporter mount request or retry loop", async () => {
    const io = adapters();
    io.readModules.mockRejectedValue(new Error("fixture unavailable"));
    const controller = createBackofficeContextController(core, io);
    controller.applyModulesSeed(seed({ state: "unavailable" }));
    await flush();
    controller.applyModulesSeed(seed({ state: "unavailable" }));
    await flush();
    expect(io.readModules).toHaveBeenCalledOnce();
    expect(io.readSession).not.toHaveBeenCalled();
    expect(controller.getSnapshot().modules.state).toBe("unavailable");
    expect(io.navigate).not.toHaveBeenCalled();
  });

  it("restricted has no mount recovery, but an explicit later signal can become ready", async () => {
    const io = adapters();
    const controller = createBackofficeContextController(core, io);
    controller.applyModulesSeed(seed({ state: "restricted" }));
    await flush();
    expect(io.readModules).not.toHaveBeenCalled();
    controller.revalidateSessionModules();
    await flush();
    expect(io.readModules).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().modules.state).toBe("ready");
  });

  it("commits invalidation before any subscriber/ticket capture and coalesces synchronous signals", async () => {
    const io = adapters();
    const controller = createBackofficeContextController(core, io);
    controller.applyModulesSeed(seed({ state: "ready", modules: [module] }));
    const generations: number[] = [];
    controller.subscribe(() => {
      const state = controller.getSnapshot();
      expect(controller.captureTicket("modules")?.generation).toBe(
        state.generations.modules,
      );
      generations.push(state.generations.modules);
    });
    controller.revalidateSessionModules();
    expect(controller.captureTicket("modules")?.generation).toBe(1);
    expect(io.readModules).not.toHaveBeenCalled();
    controller.revalidateSessionModules();
    expect(controller.captureTicket("modules")?.generation).toBe(2);
    await flush();
    expect(io.readModules).toHaveBeenCalledOnce();
    expect(io.readSession).toHaveBeenCalledOnce();
    expect(io.readModules.mock.calls[0]).toEqual([
      expect.any(AbortSignal),
      expect.objectContaining({ scopeKey: core.scopeKey, generation: 2 }),
    ]);
    expect(generations.every((generation) => generation >= 1)).toBe(true);
  });

  it("does not install an obsolete modules response and drains before the one pending refresh", async () => {
    const io = adapters();
    const old = deferred<ModuleDTO[]>(),
      fresh = deferred<ModuleDTO[]>();
    io.readModules
      .mockImplementationOnce(() => old.promise)
      .mockImplementationOnce(() => fresh.promise);
    const controller = createBackofficeContextController(core, io);
    controller.applyModulesSeed(seed({ state: "ready", modules: [module] }));
    controller.revalidateSessionModules();
    await flush();
    controller.revalidateSessionModules();
    await flush();
    expect(io.readModules).toHaveBeenCalledOnce();
    old.resolve([{ ...module, enabled: false }]);
    await flush();
    expect(io.readModules).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().modules).toEqual({
      state: "ready",
      modules: [module],
    });
    fresh.resolve([{ ...module, name: "Confirmed" }]);
    await flush();
    expect(controller.getSnapshot().modules).toEqual({
      state: "ready",
      modules: [{ ...module, name: "Confirmed" }],
    });
  });

  it("recovers modules when an Inbox invalidation closes a still-loading streamed seed", async () => {
    const io = adapters();
    const controller = createBackofficeContextController(core, io);
    controller.invalidate(["inbox"]);
    expect(controller.captureTicket("inbox")?.generation).toBe(1);
    expect(controller.captureTicket("modules")?.generation).toBe(1);
    controller.applyModulesSeed(
      seed({ state: "ready", modules: [{ ...module, enabled: false }] }),
    );
    await flush();
    expect(io.readModules).toHaveBeenCalledOnce();
    expect(io.readSession).not.toHaveBeenCalled();
    expect(controller.getSnapshot().modules).toEqual({
      state: "ready",
      modules: [module],
    });
  });

  it("new RSC boot only revalidates once; its snapshot never overwrites confirmed presentation", async () => {
    const io = adapters();
    const confirmed = reporter();
    confirmed.business!.name = "Confirmed server";
    io.readSession.mockResolvedValue(confirmed);
    const controller = createBackofficeContextController(core, io);
    const incoming = {
      ...core,
      bootId: "new-boot",
      business: { ...core.business, name: "Stale prefetched" },
    };
    controller.observeCoreSeed(incoming);
    expect(controller.getSnapshot().core?.business.name).toBe("Fixture");
    await flush();
    expect(controller.getSnapshot().core?.business.name).toBe(
      "Confirmed server",
    );
    controller.observeCoreSeed(incoming);
    controller.observeCoreSeed(core);
    await flush();
    expect(io.readSession).toHaveBeenCalledOnce();
    expect(io.readModules).toHaveBeenCalledOnce();
  });

  it("same-scope role/billing changes update live core without navigation or epoch/key reset", async () => {
    const io = adapters();
    const session = reporter();
    session.membership = {
      role: "staff",
      status: "active",
      permissions: ["stock"],
    };
    session.billing = {
      access: "subscribed",
      trialEndsAt: null,
      trialDaysLeft: null,
    };
    io.readSession.mockResolvedValue(session);
    const controller = createBackofficeContextController(core, io);
    controller.revalidateSessionModules();
    await flush();
    expect(controller.getSnapshot().core).toMatchObject({
      scopeKey: core.scopeKey,
      bootId: core.bootId,
      membership: { role: "staff", permissions: ["stock"] },
      billing: { access: "subscribed" },
    });
    expect(controller.getSnapshot().epoch).toBe(0);
    expect(io.navigate).not.toHaveBeenCalled();
  });

  it("withdraws before one scope409 navigation and a late reporter cannot restore private data", async () => {
    const io = adapters();
    const late = deferred<unknown>();
    io.readSession.mockImplementation(() => late.promise);
    io.readModules.mockRejectedValue(
      new ModuleRequestError(
        "Fixture scope",
        "backoffice_context_changed",
        [],
        [],
        undefined,
        409,
      ),
    );
    const controller = createBackofficeContextController(core, io);
    io.navigate.mockImplementation(() => {
      expect(controller.getSnapshot().core).toBeNull();
      expect(controller.getServerSnapshot().core).toBeNull();
      expect(controller.captureTicket("modules")).toBeNull();
    });
    controller.revalidateSessionModules();
    await flush();
    expect(io.navigate).toHaveBeenCalledOnce();
    expect(io.navigate).toHaveBeenCalledWith("/backoffice");
    late.resolve(reporter());
    await flush();
    controller.revalidateSessionModules();
    controller.retire();
    expect(controller.getSnapshot().core).toBeNull();
    expect(io.readModules).toHaveBeenCalledOnce();
    expect(io.navigate).toHaveBeenCalledOnce();
  });

  it.each([
    { authenticated: false },
    { ...reporter(), business: null, membership: null, billing: null },
    { ...reporter(), membership: { ...core.membership, status: "disabled" } },
    { ...reporter(), user: { ...reporter().user, id: "other-user" } },
    {
      ...reporter(),
      business: { ...reporter().business!, id: "other-business" },
    },
  ])(
    "valid reporter loss/change withdraws without installing another scope: %j",
    async (session) => {
      const io = adapters();
      io.readSession.mockResolvedValue(session);
      const controller = createBackofficeContextController(core, io);
      controller.revalidateSessionModules();
      await flush();
      expect(controller.getSnapshot().core).toBeNull();
      expect(controller.captureTicket("inbox")).toBeNull();
      expect(io.navigate).toHaveBeenCalledOnce();
      controller.observeCoreSeed(core);
      expect(controller.getSnapshot().core).toBeNull();
    },
  );

  it.each([
    {},
    { ...reporter(), business: undefined },
    { ...reporter(), billing: undefined },
    { ...reporter(), user: { id: core.userId } },
    {
      ...reporter(),
      membership: { ...core.membership, permissions: "invalid" },
    },
    {
      ...reporter(),
      billing: { access: ["trial"], trialEndsAt: null, trialDaysLeft: 1 },
    },
  ])(
    "malformed reporter is operational, never logout or fallback identity: %j",
    async (session) => {
      const io = adapters();
      io.readSession.mockResolvedValue(session);
      const controller = createBackofficeContextController(core, io);
      controller.revalidateSessionModules();
      await flush();
      expect(controller.getSnapshot().core?.userId).toBe(core.userId);
      expect(controller.getSnapshot().sessionState).toBe("unavailable");
      expect(io.navigate).not.toHaveBeenCalled();
    },
  );

  it.each([402, 403, 409, 500])(
    "module gate/operational failures preserve core without a retry loop (%s)",
    async (status) => {
      const io = adapters();
      io.readModules.mockRejectedValue(
        new ModuleRequestError("Fixture", undefined, [], [], undefined, status),
      );
      const controller = createBackofficeContextController(core, io);
      controller.revalidateSessionModules();
      await flush();
      expect(controller.getSnapshot().modules.state).toBe(
        status === 402 || status === 403 ? "restricted" : "unavailable",
      );
      expect(controller.getSnapshot().core?.business.id).toBe(core.business.id);
      expect(io.navigate).not.toHaveBeenCalled();
      expect(io.readModules).toHaveBeenCalledOnce();
    },
  );

  it("attach cleanup/replacement tolerates Strict Mode; final unmount disposes without navigation", async () => {
    const io = adapters();
    const work = deferred<ModuleDTO[]>();
    io.readModules.mockImplementation(() => work.promise);
    const controller = createBackofficeContextController(core, io);
    const cleanup = controller.attach();
    controller.revalidateSessionModules();
    await flush();
    cleanup();
    const replacement = controller.attach();
    await flush();
    expect(controller.getSnapshot().core).not.toBeNull();
    expect(io.readModules).toHaveBeenCalledOnce();
    replacement();
    await flush();
    expect(controller.captureTicket("modules")).toBeNull();
    expect(io.navigate).not.toHaveBeenCalled();
    work.resolve([module]);
    await flush();
    expect(controller.getSnapshot().core).toBeNull();
  });
});

describe("0238 confirmed module transport seam", () => {
  it("invalidates prior GET before applying a confirmed module; late read cannot overwrite it or unrelated modules", async () => {
    const io = adapters();
    const old = deferred<ModuleDTO[]>();
    io.readModules.mockReturnValueOnce(old.promise);
    const controller = createBackofficeContextController(core, io);
    const other = { ...module, id: "other" };
    controller.applyModulesSeed(
      seed({ state: "ready", modules: [module, other] }),
    );
    controller.revalidateModules();
    await flush();
    const ticket = controller.captureTicket("modules")!;
    const before = controller.getSnapshot().generations;
    expect(
      controller.applyConfirmedModule(ticket, { ...module, enabled: false }),
    ).toBe(true);
    expect(controller.getSnapshot().generations).toMatchObject({
      modules: before.modules + 1,
      inbox: before.inbox + 1,
      checklist: before.checklist + 1,
    });
    expect(controller.getSnapshot().modules).toEqual({
      state: "ready",
      modules: [{ ...module, enabled: false }, other],
    });
    old.resolve([module]);
    await flush();
    expect(controller.getSnapshot().modules).toEqual({
      state: "ready",
      modules: [{ ...module, enabled: false }, other],
    });
    expect(io.readSession).not.toHaveBeenCalled();
    expect(io.readModules.mock.calls[0][1].scopeKey).toBe(core.scopeKey);
  });
  it("rejects stale/wrong resource/malformed/unknown module without changing state", () => {
    const io = adapters();
    const controller = createBackofficeContextController(core, io);
    controller.applyModulesSeed(seed({ state: "ready", modules: [module] }));
    const stale = controller.captureTicket("modules")!;
    controller.invalidate(["modules"]);
    const current = controller.captureTicket("modules")!;
    const before = controller.getSnapshot();
    expect(controller.applyConfirmedModule(stale, module)).toBe(false);
    expect(
      controller.applyConfirmedModule(
        controller.captureTicket("inbox")!,
        module,
      ),
    ).toBe(false);
    expect(
      controller.applyConfirmedModule(current, { ...module, id: "unknown" }),
    ).toBe(false);
    expect(
      controller.applyConfirmedModule(current, {
        ...module,
        navigation: [null],
      } as unknown as ModuleDTO),
    ).toBe(false);
    expect(
      controller.applyConfirmedModule(current, {
        ...module,
        permissions: [{ id: "bad" }],
      } as ModuleDTO),
    ).toBe(false);
    expect(
      controller.applyConfirmedModule(current, null as unknown as ModuleDTO),
    ).toBe(false);
    expect(controller.getSnapshot()).toBe(before);
  });
  it("needs a ready base and deep copies confirmed public fields without retaining caller aliases", () => {
    const io = adapters();
    const controller = createBackofficeContextController(core, io);
    expect(
      controller.applyConfirmedModule(
        controller.captureTicket("modules")!,
        module,
      ),
    ).toBe(false);
    controller.applyModulesSeed(seed({ state: "ready", modules: [module] }));
    const confirmed: ModuleDTO = {
      ...module,
      enabled: false,
      requires: ["other"],
      navigation: [
        { path: "", label: "Confirmed", icon: "Box", permission: "stock" },
      ],
      permissions: [{ id: "stock", label: "Stock", description: "Fixture" }],
    };
    expect(
      controller.applyConfirmedModule(
        controller.captureTicket("modules")!,
        confirmed,
      ),
    ).toBe(true);
    confirmed.enabled = true;
    confirmed.requires.push("mutated");
    confirmed.navigation[0].label = "mutated";
    confirmed.permissions[0].label = "mutated";
    const state = controller.getSnapshot().modules;
    expect(state.state).toBe("ready");
    if (state.state !== "ready") throw new Error("expected ready");
    expect(state.modules[0]).toMatchObject({
      enabled: false,
      requires: ["other"],
      navigation: [{ label: "Confirmed" }],
      permissions: [{ label: "Stock" }],
    });
  });
  it("module-only revalidation coalesces and does not automatically request the reporter", async () => {
    const io = adapters();
    const controller = createBackofficeContextController(core, io);
    controller.applyModulesSeed(seed({ state: "ready", modules: [module] }));
    controller.revalidateModules();
    controller.revalidateModules();
    await flush();
    expect(io.readModules).toHaveBeenCalledOnce();
    expect(io.readSession).not.toHaveBeenCalled();
    expect(io.readModules.mock.calls[0][1]).toMatchObject({
      scopeKey: core.scopeKey,
      resource: "modules",
      generation: 2,
    });
  });
});

const emptyInbox = {
  contractVersion: 2 as const,
  policyVersion: "fixture",
  timezone: "UTC",
  state: "ready" as const,
  preparedAt: null,
  nextReminderAt: null,
  refreshAfterMs: null,
  cards: [],
};
describe("0238 global signals and server reconciliation", () => {
  it("coalesces visible signals once per subscribed resource, without hidden Inbox/checklist reads or mount requests", async () => {
    const io = adapters();
    io.readInbox.mockResolvedValue(emptyInbox);
    io.readChecklist.mockResolvedValue({ locale: "es", items: [] });
    const c = createBackofficeContextController(core, io);
    c.applyModulesSeed(seed({ state: "ready", modules: [module] }));
    c.attach();
    await flush();
    expect(io.readSession).not.toHaveBeenCalled();
    expect(io.requestRefresh).not.toHaveBeenCalled();
    const releaseInbox = c.acquireInbox(),
      releaseChecklist = c.acquireChecklist();
    await flush();
    io.readInbox.mockClear();
    io.readChecklist.mockClear();
    c.revalidateVisible();
    c.revalidateVisible();
    c.revalidateVisible();
    await flush();
    expect(io.readSession).toHaveBeenCalledOnce();
    expect(io.readModules).toHaveBeenCalledOnce();
    expect(io.readInbox).toHaveBeenCalledOnce();
    expect(io.readChecklist).toHaveBeenCalledOnce();
    expect(io.requestRefresh).not.toHaveBeenCalled();
    releaseInbox();
    releaseChecklist();
    await flush();
    c.revalidateVisible();
    await flush();
    expect(io.readSession).toHaveBeenCalledTimes(2);
    expect(io.readModules).toHaveBeenCalledTimes(2);
    expect(io.readInbox).toHaveBeenCalledOnce();
    expect(io.readChecklist).toHaveBeenCalledOnce();
  });
  it("reconciles a confirmed structural core change once, acknowledges boot without applying its stale DTO or looping", async () => {
    const io = adapters();
    const current = reporter();
    current.billing = { ...core.billing, access: "subscribed" };
    io.readSession.mockResolvedValue(current);
    const c = createBackofficeContextController(core, io);
    c.applyModulesSeed(seed({ state: "ready", modules: [module] }));
    c.revalidateVisible();
    await flush();
    expect(io.requestRefresh).toHaveBeenCalledOnce();
    expect(io.navigate).not.toHaveBeenCalled();
    c.observeCoreSeed({ ...core, bootId: "ack-1" });
    await flush();
    expect(c.getSnapshot().core?.billing.access).toBe("subscribed");
    expect(io.requestRefresh).toHaveBeenCalledOnce();
    c.observeCoreSeed({ ...core, bootId: "ack-1" });
    await flush();
    expect(io.requestRefresh).toHaveBeenCalledOnce();
  });
  it("keeps one pending latest revision during refresh including A→B→A, then acknowledges without another loop", async () => {
    const io = adapters();
    const current = reporter();
    current.billing = { ...core.billing, access: "subscribed" };
    io.readSession.mockImplementation(async () => current);
    const c = createBackofficeContextController(core, io);
    c.applyModulesSeed(seed({ state: "ready", modules: [module] }));
    c.revalidateVisible();
    await flush();
    expect(io.requestRefresh).toHaveBeenCalledOnce();
    current.membership = { ...core.membership, role: "staff" };
    c.revalidateVisible();
    await flush();
    current.membership = { ...core.membership, role: "owner" };
    c.revalidateVisible();
    await flush();
    expect(io.requestRefresh).toHaveBeenCalledOnce();
    c.observeCoreSeed({ ...core, bootId: "ack-first" });
    await flush();
    expect(io.requestRefresh).toHaveBeenCalledTimes(2);
    c.observeCoreSeed({ ...core, bootId: "ack-last" });
    await flush();
    expect(io.requestRefresh).toHaveBeenCalledTimes(2);
    expect(io.navigate).not.toHaveBeenCalled();
  });
  it("name, days, permission ordering and ordinary data reads do not request RSC refresh", async () => {
    const io = adapters();
    const current = reporter();
    current.business = { ...current.business!, name: "Renamed" };
    current.billing = { ...core.billing, trialDaysLeft: 9 };
    current.membership = {
      ...core.membership,
      permissions: ["stock", "analytics"],
    };
    io.readSession.mockResolvedValue(current);
    const c = createBackofficeContextController(core, io);
    c.applyModulesSeed(seed({ state: "ready", modules: [module] }));
    c.revalidateVisible();
    await flush();
    expect(c.getSnapshot().core?.business.name).toBe("Renamed");
    expect(c.getSnapshot().core?.billing.trialDaysLeft).toBe(9);
    expect(io.requestRefresh).not.toHaveBeenCalled();
    c.observeCoreSeed({ ...core, bootId: "ordinary-navigation" });
    await flush();
    expect(io.requestRefresh).not.toHaveBeenCalled();
  });
  it("module flag confirmation demands one refresh and stale GET cannot create another demand", async () => {
    const io = adapters();
    const c = createBackofficeContextController(core, io);
    c.applyModulesSeed(seed({ state: "ready", modules: [module] }));
    expect(
      c.applyConfirmedModule(c.captureTicket("modules")!, {
        ...module,
        enabled: false,
      }),
    ).toBe(true);
    await flush();
    expect(io.requestRefresh).toHaveBeenCalledOnce();
    io.readModules.mockResolvedValue([{ ...module, enabled: false }]);
    c.observeCoreSeed({ ...core, bootId: "module-ack" });
    await flush();
    expect(io.requestRefresh).toHaveBeenCalledOnce();
  });
  it("PIN403 reconciles via page guard once, repeat gate/ack cannot loop and email403 never requests page exit", async () => {
    const io = adapters();
    io.readModules.mockRejectedValue(
      new ModuleRequestError(
        "pin",
        "pin_change_required",
        [],
        [],
        undefined,
        403,
      ),
    );
    const staff = {
      ...core,
      membership: { ...core.membership, role: "staff" },
    };
    io.readSession.mockResolvedValue({
      ...reporter(),
      membership: staff.membership,
    });
    const c = createBackofficeContextController(staff, io);
    c.applyModulesSeed(seed({ state: "ready", modules: [module] }));
    c.revalidateVisible();
    await flush();
    expect(io.requestRefresh).toHaveBeenCalledOnce();
    expect(io.navigate).not.toHaveBeenCalled();
    c.observeCoreSeed({ ...core, bootId: "pin-ack" });
    await flush();
    expect(io.requestRefresh).toHaveBeenCalledOnce();
    c.revalidateVisible();
    await flush();
    expect(io.requestRefresh).toHaveBeenCalledOnce();
    const email = adapters();
    email.readModules.mockRejectedValue(
      new ModuleRequestError(
        "email",
        "email_not_verified",
        [],
        [],
        undefined,
        403,
      ),
    );
    const unverified = { ...core, emailVerified: false };
    email.readSession.mockResolvedValue({
      ...reporter(),
      user: { ...reporter().user, emailVerified: false },
    });
    const e = createBackofficeContextController(unverified, email);
    e.applyModulesSeed(seed({ state: "restricted" }));
    e.revalidateVisible();
    await flush();
    expect(email.requestRefresh).not.toHaveBeenCalled();
    expect(email.navigate).not.toHaveBeenCalled();
  });
  it("retirement cancels queued refresh and all later signals instead of navigating twice", async () => {
    const io = adapters();
    const c = createBackofficeContextController(core, io);
    c.applyModulesSeed(seed({ state: "ready", modules: [module] }));
    c.applyConfirmedModule(c.captureTicket("modules")!, {
      ...module,
      enabled: false,
    });
    c.retire();
    c.revalidateVisible();
    await flush();
    expect(io.requestRefresh).not.toHaveBeenCalled();
    expect(io.navigate).toHaveBeenCalledExactlyOnceWith("/backoffice");
    expect(io.readSession).not.toHaveBeenCalled();
  });
  it("operational router exception is observed without logout/autoretry; a later intentional signal retries", async () => {
    const io = adapters();
    io.requestRefresh.mockImplementationOnce(() => {
      throw new Error("router unavailable");
    });
    const current = reporter();
    current.billing = { ...core.billing, access: "subscribed" };
    io.readSession.mockResolvedValue(current);
    const c = createBackofficeContextController(core, io);
    c.applyModulesSeed(seed({ state: "ready", modules: [module] }));
    c.revalidateVisible();
    await flush();
    expect(io.requestRefresh).toHaveBeenCalledOnce();
    expect(c.getSnapshot().core).not.toBeNull();
    expect(io.navigate).not.toHaveBeenCalled();
    c.revalidateVisible();
    await flush();
    expect(io.requestRefresh).toHaveBeenCalledTimes(2);
  });
});
