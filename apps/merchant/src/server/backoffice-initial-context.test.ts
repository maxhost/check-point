import { beforeEach, afterEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  render: vi.fn(),
  request: vi.fn(),
  guard: vi.fn(),
  modules: vi.fn(),
  api: vi.fn(),
}));
vi.mock("./backoffice-context", () => ({
  getBackofficeRenderContext: h.render,
  getBackofficeRequestContext: h.request,
}));
vi.mock("./auth-guards", () => ({ requireBackofficeSession: h.guard }));
vi.mock("./api-member", () => ({ requireApiMember: h.api }));
vi.mock("../modules/activation", () => ({
  listModulesWithCategory: h.modules,
}));
import {
  readBackofficeInitialCore,
  readBackofficeInitialModules,
  readBackofficePagePlan,
} from "./backoffice-initial-context";
import { GET } from "../app/api/modules/route";
const session = () => ({
  session: { id: "private-session" },
  user: { id: "user", emailVerified: true },
});
const member = () => ({
  id: "business",
  name: "Synthetic",
  slug: "private-slug",
  countryCode: "EC",
  currencyCode: "USD",
  timezone: "America/Guayaquil",
  categoryGcid: "gcid:test",
  businessStatus: "active",
  suspensionReason: null,
  role: "owner",
  membershipStatus: "active",
  permissions: ["catalog"],
  pinMustChange: false,
});
const billing = () => ({
  access: "subscribed",
  trialEndsAt: null,
  failure: null,
});
const data = () => ({
  member: member(),
  subscription: {
    plan: "private-plan",
    status: "active",
    stripeCustomerId: "private-stripe",
  },
});
let row = member(),
  auth = session();
let selection:
  | { state: "joined"; data: ReturnType<typeof data> | null }
  | { state: "recovered"; member: ReturnType<typeof member>; error: unknown };
const ctx = {
  bootId: "boot",
  now: new Date("2026-10-17T12:00:00Z"),
  readSession: vi.fn(),
  readSelection: vi.fn(),
  readBilling: vi.fn(),
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv(
    "BETTER_AUTH_SECRET",
    "synthetic-test-secret-at-least-32-characters",
  );
  row = member();
  auth = session();
  selection = { state: "joined", data: { ...data(), member: row } };
  ctx.readSession.mockImplementation(async () => auth);
  ctx.readSelection.mockImplementation(async () => selection);
  ctx.readBilling.mockResolvedValue(billing());
  h.render.mockResolvedValue(ctx);
  h.request.mockReturnValue(ctx);
  h.modules.mockResolvedValue([]);
  h.api.mockResolvedValue({ business: { id: "business" } });
  h.guard.mockImplementation(async () => ({
    userId: "user",
    emailVerified: true,
    business: {
      id: row.id,
      name: row.name,
      status: row.businessStatus,
      timezone: row.timezone,
      currencyCode: row.currencyCode,
      privateField: "private-business",
    },
    membership: {
      role: row.role,
      status: row.membershipStatus,
      permissions: row.permissions,
    },
  }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it("serializes only the public core, with the authorized guard and no modules read", async () => {
  const core = await readBackofficeInitialCore();
  expect(core).toEqual({
    version: 1,
    bootId: "boot",
    scopeKey: expect.stringMatching(/^[a-f0-9]{64}$/),
    userId: "user",
    emailVerified: true,
    business: {
      id: "business",
      name: "Synthetic",
      status: "active",
      timezone: "America/Guayaquil",
      currencyCode: "USD",
    },
    membership: { role: "owner", status: "active", permissions: ["catalog"] },
    billing: { access: "subscribed", trialEndsAt: null, trialDaysLeft: null },
  });
  expect(JSON.stringify(core)).not.toContain("private");
  expect(h.guard).toHaveBeenCalledExactlyOnceWith({ allowBlocked: true });
  expect(ctx.readBilling).toHaveBeenCalledWith("business", "page");
  expect(h.modules).not.toHaveBeenCalled();
});
it("propagates guard denial before reading any context", async () => {
  const denied = new Error("redirect");
  h.guard.mockRejectedValue(denied);
  await expect(readBackofficeInitialCore()).rejects.toBe(denied);
  expect(h.render).not.toHaveBeenCalled();
});
it("refuses guard/context identity divergence", async () => {
  h.guard.mockResolvedValue({
    userId: "another",
    business: { id: "business" },
  });
  await expect(readBackofficeInitialCore()).rejects.toThrow("disagree");
  expect(ctx.readBilling).not.toHaveBeenCalled();
});
it("shares the core ticket and category and distinguishes ready-empty from unavailable", async () => {
  const core = await readBackofficeInitialCore();
  expect(
    await readBackofficeInitialModules(core.bootId, core.scopeKey),
  ).toEqual({
    bootId: core.bootId,
    scopeKey: core.scopeKey,
    result: { state: "ready", modules: [] },
  });
  expect(h.modules).toHaveBeenCalledExactlyOnceWith("business", "gcid:test");
});
it.each(["boot", "scope"])(
  "discards a stale %s ticket before modules/billing",
  async (field) => {
    const core = await readBackofficeInitialCore();
    ctx.readBilling.mockClear();
    const ticket = {
      bootId: core.bootId,
      scopeKey: core.scopeKey,
      [field === "boot" ? "bootId" : "scopeKey"]: "stale",
    };
    expect(
      await readBackofficeInitialModules(ticket.bootId, ticket.scopeKey),
    ).toEqual({ ...ticket, result: { state: "unavailable" } });
    expect(ctx.readBilling).not.toHaveBeenCalled();
    expect(h.modules).not.toHaveBeenCalled();
  },
);
it.each(["inactive", "email", "suspended", "closed"])(
  "restricts %s before billing/modules",
  async (gate) => {
    const core = await readBackofficeInitialCore();
    ctx.readBilling.mockClear();
    if (gate === "inactive") row.membershipStatus = "inactive";
    if (gate === "email") auth.user.emailVerified = false;
    if (gate === "suspended" || gate === "closed") row.businessStatus = gate;
    expect(
      (await readBackofficeInitialModules(core.bootId, core.scopeKey)).result,
    ).toEqual({ state: "restricted" });
    expect(ctx.readBilling).not.toHaveBeenCalled();
    expect(h.modules).not.toHaveBeenCalled();
  },
);
it.each(["billing", "pin"])(
  "restricts %s after earlier gates",
  async (gate) => {
    const core = await readBackofficeInitialCore();
    if (gate === "billing")
      ctx.readBilling.mockResolvedValue({
        ...billing(),
        failure: { status: 402 },
      });
    else {
      row.role = "staff";
      row.pinMustChange = true;
    }
    expect(
      (await readBackofficeInitialModules(core.bootId, core.scopeKey)).result,
    ).toEqual({ state: "restricted" });
    expect(h.modules).not.toHaveBeenCalled();
  },
);
it("staff email is not an owner gate and owner default PIN does not restrict", async () => {
  const core = await readBackofficeInitialCore();
  row.pinMustChange = true;
  expect(
    (await readBackofficeInitialModules(core.bootId, core.scopeKey)).result
      .state,
  ).toBe("ready");
  row.role = "staff";
  row.pinMustChange = false;
  auth.user.emailVerified = false;
  expect(
    (await readBackofficeInitialModules(core.bootId, core.scopeKey)).result
      .state,
  ).toBe("ready");
});
it.each(["billing", "modules"])(
  "observes %s operational error without serializing its message",
  async (source) => {
    const core = await readBackofficeInitialCore();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new TypeError("private-secret");
    if (source === "billing") {
      row.role = "staff";
      row.pinMustChange = true;
      ctx.readBilling.mockRejectedValue(failure);
    } else h.modules.mockRejectedValue(failure);
    expect(
      (await readBackofficeInitialModules(core.bootId, core.scopeKey)).result,
    ).toEqual({ state: "unavailable" });
    expect(log).toHaveBeenCalledExactlyOnceWith(
      "backoffice_modules_unavailable",
      { name: "TypeError" },
    );
  },
);
it("reads private page presentation from JOIN, defaults only absent subscription, propagates recovery error", async () => {
  expect(await readBackofficePagePlan()).toEqual({
    plan: "private-plan",
    status: "active",
  });
  selection = {
    state: "joined",
    data: { ...data(), subscription: null as never },
  };
  expect(await readBackofficePagePlan()).toEqual({
    plan: "none",
    status: "active",
  });
  const error = new Error("join failed");
  selection = { state: "recovered", member: row, error };
  await expect(readBackofficePagePlan()).rejects.toBe(error);
  expect(ctx.readBilling).not.toHaveBeenCalled();
});
it("modules HTTP denial skips context/category and success uses the same selected row", async () => {
  h.api.mockResolvedValueOnce({
    failure: {
      status: 403,
      code: "email_not_verified",
      message: "Verifica tu email.",
    },
  });
  expect(
    (await GET(new Request("https://example.test/api/modules"))).status,
  ).toBe(403);
  expect(h.request).not.toHaveBeenCalled();
  expect(h.modules).not.toHaveBeenCalled();
  const request = new Request("https://example.test/api/modules");
  expect(await (await GET(request)).json()).toEqual({ modules: [] });
  expect(h.request).toHaveBeenCalledWith(request);
  expect(ctx.readSelection).toHaveBeenCalledWith("active-member");
  expect(h.modules).toHaveBeenCalledExactlyOnceWith("business", "gcid:test");
});

it("a pending modules read does not hold another core consumer", async () => {
  const core = await readBackofficeInitialCore();
  let release!: (value: []) => void;
  h.modules.mockImplementation(
    () =>
      new Promise<[]>((resolve) => {
        release = resolve;
      }),
  );
  const pending = readBackofficeInitialModules(core.bootId, core.scopeKey);
  expect(await readBackofficeInitialCore()).toEqual(core);
  release([]);
  expect((await pending).result).toEqual({ state: "ready", modules: [] });
});
