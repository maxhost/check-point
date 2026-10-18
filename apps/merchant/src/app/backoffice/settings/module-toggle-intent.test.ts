import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { ModuleDTO } from "../../../backoffice-context-contract";
import type { BackofficeResourceTicket } from "../backoffice-context-state";
import { ModuleRequestError } from "./module-request";
const h = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./module-request", async (original) => ({
  ...(await original<typeof import("./module-request")>()),
  moduleRequest: h.request,
}));
import { captureModuleToggleIntent } from "./module-toggle-intent";
import { publishModules, MODULES_CHANGED_EVENT } from "./module-navigation";
const initialTicket = (): BackofficeResourceTicket => ({
  resource: "modules",
  scopeKey: "a".repeat(64),
  epoch: 0,
  generation: 0,
});
const moduleDTO = (): ModuleDTO => ({
  id: "synthetic-module",
  enabled: false,
  name: "Synthetic",
  description: "Synthetic",
  suggested: false,
  requires: [],
  permissions: [],
  navigation: [],
});
let current: BackofficeResourceTicket | null;
const context = {
  captureTicket: vi.fn(() => current),
  invalidate: vi.fn(() => {
    if (current) current = { ...current, generation: current.generation + 1 };
  }),
  applyConfirmedModule: vi.fn<
    (ticket: BackofficeResourceTicket, module: ModuleDTO) => boolean
  >(() => true),
  revalidateModules: vi.fn(),
  retire: vi.fn(() => {
    current = null;
  }),
};
beforeEach(() => {
  vi.clearAllMocks();
  current = initialTicket();
  h.request
    .mockReset()
    .mockResolvedValue({ module: { ...moduleDTO(), enabled: true } });
  context.applyConfirmedModule.mockImplementation(() => {
    // The provider invalidates the previous read generation before confirming its DTO.
    if (current) current = { ...current, generation: current.generation + 1 };
    return true;
  });
});
afterEach(() => vi.unstubAllGlobals());
it("retired context never invalidates or sends a PUT", () => {
  current = null;
  expect(captureModuleToggleIntent(moduleDTO(), context)).toBeNull();
  expect(h.request).not.toHaveBeenCalled();
  expect(context.invalidate).not.toHaveBeenCalled();
});
it("invalidates synchronously then binds the new generation before PUT/confirmation", async () => {
  const intent = captureModuleToggleIntent(moduleDTO(), context)!;
  expect(context.invalidate).toHaveBeenCalledExactlyOnceWith([
    "modules",
    "inbox",
    "checklist",
  ]);
  expect(h.request).not.toHaveBeenCalled();
  expect(await intent.execute()).toBe(true);
  expect(h.request).toHaveBeenCalledExactlyOnceWith(
    "/api/modules/synthetic-module",
    { enabled: true },
    { scopeKey: "a".repeat(64) },
  );
  expect(context.applyConfirmedModule).toHaveBeenCalledExactlyOnceWith(
    { ...initialTicket(), generation: 1 },
    { ...moduleDTO(), enabled: true },
  );
  expect(context.invalidate.mock.invocationCallOrder[0]).toBeLessThan(
    h.request.mock.invocationCallOrder[0],
  );
});
it("copies module primitives and ticket instead of retagging mutable references", async () => {
  const module = moduleDTO(),
    intent = captureModuleToggleIntent(module, context)!;
  module.id = "foreign";
  module.enabled = true;
  expect(await intent.execute()).toBe(true);
  expect(h.request.mock.calls[0]).toEqual([
    "/api/modules/synthetic-module",
    { enabled: true },
    { scopeKey: "a".repeat(64) },
  ]);
  expect(context.applyConfirmedModule.mock.calls[0][0]).toEqual({
    ...initialTicket(),
    generation: 1,
  });
});
it.each(["scope", "epoch"])(
  "change of %s before execution discards the intention",
  async (field) => {
    const intent = captureModuleToggleIntent(moduleDTO(), context)!;
    current = {
      ...current!,
      [field === "scope" ? "scopeKey" : "epoch"]:
        field === "scope" ? "b".repeat(64) : 1,
    };
    expect(await intent.execute()).toBe(false);
    expect(h.request).not.toHaveBeenCalled();
    expect(context.applyConfirmedModule).not.toHaveBeenCalled();
  },
);
it("identity changed synchronously during invalidation cannot be retagged", () => {
  context.invalidate.mockImplementationOnce(() => {
    current = { ...initialTicket(), scopeKey: "b".repeat(64) };
  });
  expect(captureModuleToggleIntent(moduleDTO(), context)).toBeNull();
  expect(h.request).not.toHaveBeenCalled();
});
it("a generation lost before execution recovers through the owner without PUT", async () => {
  const intent = captureModuleToggleIntent(moduleDTO(), context)!;
  current = { ...current!, generation: 2 };
  expect(await intent.execute()).toBe(false);
  expect(context.revalidateModules).toHaveBeenCalledTimes(1);
  expect(h.request).not.toHaveBeenCalled();
});
it("generation lost in flight never applies old DTO and revalidates without replay", async () => {
  let resolve!: (response: unknown) => void;
  h.request.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const intent = captureModuleToggleIntent(moduleDTO(), context)!,
    pending = intent.execute();
  current = { ...current!, generation: 2 };
  resolve({ module: { ...moduleDTO(), enabled: true } });
  expect(await pending).toBe(false);
  expect(context.applyConfirmedModule).not.toHaveBeenCalled();
  expect(context.revalidateModules).toHaveBeenCalledTimes(1);
  expect(h.request).toHaveBeenCalledTimes(1);
});
it.each(["success", "scope409", "offline"])(
  "old in-flight %s cannot alter or retire a newer session",
  async (result) => {
    let resolve!: (response: unknown) => void,
      reject!: (error: unknown) => void;
    h.request.mockImplementation(
      () =>
        new Promise((yes, no) => {
          resolve = yes;
          reject = no;
        }),
    );
    const intent = captureModuleToggleIntent(moduleDTO(), context)!,
      pending = intent.execute();
    current = { ...initialTicket(), scopeKey: "b".repeat(64), epoch: 1 };
    if (result === "success")
      resolve({ module: { ...moduleDTO(), enabled: true } });
    else
      reject(
        result === "scope409"
          ? { code: "backoffice_context_changed" }
          : new Error("offline"),
      );
    expect(await pending).toBe(false);
    expect(context.retire).not.toHaveBeenCalled();
    expect(context.revalidateModules).not.toHaveBeenCalled();
    expect(context.applyConfirmedModule).not.toHaveBeenCalled();
    expect(h.request.mock.calls[0][2]).toEqual({ scopeKey: "a".repeat(64) });
  },
);
it("scope409 retires once even if generation changed, with no automatic retry", async () => {
  h.request.mockImplementation(async () => {
    current = { ...current!, generation: 9 };
    throw { code: "backoffice_context_changed" };
  });
  const intent = captureModuleToggleIntent(moduleDTO(), context)!;
  expect(await intent.execute()).toBe(false);
  expect(await intent.execute()).toBe(false);
  expect(context.retire).toHaveBeenCalledTimes(1);
  expect(h.request).toHaveBeenCalledTimes(1);
});
it.each([
  "module_requires",
  "module_required_by",
  "open_orders",
  "unavailable",
])(
  "keeps native %s failure and only an explicit new intention retries",
  async (code) => {
    const error = new ModuleRequestError(
      "Synthetic failure",
      code,
      ["required"],
      ["dependent"],
      2,
      code === "unavailable" ? 503 : 409,
    );
    h.request.mockRejectedValueOnce(error);
    const intent = captureModuleToggleIntent(moduleDTO(), context)!;
    await expect(intent.execute()).rejects.toBe(error);
    expect(await intent.execute()).toBe(false);
    expect(context.retire).not.toHaveBeenCalled();
    expect(
      await captureModuleToggleIntent(moduleDTO(), context)!.execute(),
    ).toBe(true);
    expect(h.request).toHaveBeenCalledTimes(2);
  },
);
it.each(["wrong-id", "wrong-state", "invalid-dto"])(
  "never confirms %s and asks owner to recover",
  async (failure) => {
    h.request.mockResolvedValue({
      module: {
        ...moduleDTO(),
        id: failure === "wrong-id" ? "foreign" : moduleDTO().id,
        enabled: failure !== "wrong-state",
      },
    });
    if (failure === "invalid-dto")
      context.applyConfirmedModule.mockReturnValue(false);
    await expect(
      captureModuleToggleIntent(moduleDTO(), context)!.execute(),
    ).rejects.toThrow("No pudimos confirmar el cambio.");
    expect(context.revalidateModules).toHaveBeenCalledTimes(1);
    expect(context.retire).not.toHaveBeenCalled();
  },
);
it("raw module signal contains no authoritative DTO payload", () => {
  const events: Event[] = [];
  vi.stubGlobal("window", {
    dispatchEvent: (event: Event) => events.push(event),
  });
  publishModules();
  expect(events).toHaveLength(1);
  expect(events[0].type).toBe(MODULES_CHANGED_EVENT);
  expect(events[0]).not.toHaveProperty("detail");
});

it("a late native failure after a newer read generation recovers without error UI or replay", async () => {
  h.request.mockImplementation(async () => {
    current = { ...current!, generation: 2 };
    throw new ModuleRequestError(
      "Old dependency failure",
      "module_requires",
      ["required"],
      [],
      undefined,
      409,
    );
  });
  expect(await captureModuleToggleIntent(moduleDTO(), context)!.execute()).toBe(
    false,
  );
  expect(context.revalidateModules).toHaveBeenCalledTimes(1);
  expect(context.applyConfirmedModule).not.toHaveBeenCalled();
  expect(context.retire).not.toHaveBeenCalled();
  expect(h.request).toHaveBeenCalledTimes(1);
});
it("a mutable ticket cannot silently retag an in-flight confirmation", async () => {
  h.request.mockImplementation(async () => {
    (current as { generation: number }).generation = 2;
    return { module: { ...moduleDTO(), enabled: true } };
  });
  expect(await captureModuleToggleIntent(moduleDTO(), context)!.execute()).toBe(
    false,
  );
  expect(context.revalidateModules).toHaveBeenCalledTimes(1);
  expect(context.applyConfirmedModule).not.toHaveBeenCalled();
});
