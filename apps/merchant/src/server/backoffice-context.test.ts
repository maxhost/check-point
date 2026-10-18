import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  join: vi.fn(),
  only: vi.fn(),
  tours: vi.fn(),
}));
vi.mock("./auth", () => ({
  getMerchantAuth: () => ({ api: { getSession: mocks.auth } }),
}));
vi.mock("./backoffice-membership", () => ({
  readBackofficeMembership: mocks.join,
  readBackofficeMembershipOnly: mocks.only,
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@mi-pasaporte/db", () => ({
  getDb: () => ({ select: () => ({ from: () => ({ where: mocks.tours }) }) }),
}));
import { getBackofficeRequestContext } from "./backoffice-context";
import { requireApiPermission } from "./api-permission";
import { requireApiOwner, requireApiOwnerSinGateDeEmail } from "./api-owner";
import { checklistFacts } from "./onboarding/checklist-facts";
const request = (cookie = "A") =>
  new Request("https://merchant.test/api", { headers: { cookie } });
const identity = (id: string, emailVerified = true) => ({
  user: { id, emailVerified },
});
const member = () => ({
  id: "business-A",
  name: "Synthetic",
  slug: "synthetic",
  countryCode: "EC",
  currencyCode: "USD",
  timezone: "America/Guayaquil",
  categoryGcid: "gcid:store",
  businessStatus: "active",
  suspensionReason: null,
  role: "owner",
  membershipStatus: "active",
  permissions: [] as string[],
  pinMustChange: false,
});
const joined = (row = member()) => ({
  member: row,
  subscription: {
    id: "sub",
    plan: "base",
    status: "active",
    stripeCustomerId: null,
    stripeSubscriptionId: "sub",
    trialEndsAt: null,
  },
  billing: { access: "subscribed", trialEndsAt: null, failure: null },
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockImplementation(async ({ headers }: { headers: Headers }) =>
    identity(headers.get("cookie")!),
  );
  mocks.join.mockResolvedValue(joined());
  mocks.only.mockResolvedValue(member());
  mocks.tours.mockResolvedValue([]);
});
describe("request context JOIN provenance and fallback (A2b)", () => {
  it("shares native auth, same-mode JOIN and derived billing promises with one clock", async () => {
    const req = request(),
      a = getBackofficeRequestContext(req),
      b = getBackofficeRequestContext(req);
    expect(a).toBe(b);
    expect(a.now).toBe(b.now);
    expect(a.bootId).toBe(b.bootId);
    expect(a.readSession()).toBe(b.readSession());
    expect(a.readMembership("active-member")).toBe(
      b.readMembership("active-member"),
    );
    expect(a.readBilling("business-A", "active-member")).toBe(
      b.readBilling("business-A", "active-member"),
    );
    await Promise.all([
      a.readSession(),
      a.readMembership("active-member"),
      a.readBilling("business-A", "active-member"),
    ]);
    expect(mocks.auth).toHaveBeenCalledTimes(1);
    expect(mocks.join).toHaveBeenCalledExactlyOnceWith(
      "A",
      "active-member",
      a.now,
    );
    expect(mocks.only).not.toHaveBeenCalled();
  });
  it("revalidates another Request even with identical cookie/user, including session revocation", async () => {
    const a = getBackofficeRequestContext(request()),
      b = getBackofficeRequestContext(request());
    expect(a).not.toBe(b);
    expect(a.bootId).not.toBe(b.bootId);
    expect(await a.readSession()).not.toBeNull();
    mocks.auth.mockResolvedValueOnce(null);
    expect(await b.readSession()).toBeNull();
    expect(await b.readMembership("active-member")).toBeNull();
    expect(mocks.auth).toHaveBeenCalledTimes(2);
    expect(mocks.join).not.toHaveBeenCalled();
  });
  it("rechecks membership revocation on a later Request from the same authenticated user", async () => {
    expect(
      await requireApiPermission(request(), "analytics"),
    ).not.toHaveProperty("failure");
    mocks.join.mockResolvedValueOnce(null);
    expect(await requireApiPermission(request(), "analytics")).toMatchObject({
      failure: { code: "not_member" },
    });
    expect(mocks.auth).toHaveBeenCalledTimes(2);
    expect(mocks.join).toHaveBeenCalledTimes(2);
  });
  it("does not cross interleaved identities when the second session resolves first", async () => {
    let resolveA!: (value: ReturnType<typeof identity>) => void;
    const waitingA = new Promise<ReturnType<typeof identity>>((resolve) => {
      resolveA = resolve;
    });
    mocks.auth.mockImplementation(({ headers }: { headers: Headers }) =>
      headers.get("cookie") === "A" ? waitingA : Promise.resolve(identity("B")),
    );
    mocks.join.mockImplementation(async (id: string) =>
      joined({ ...member(), id: `business-${id}` }),
    );
    const a = getBackofficeRequestContext(request("A")),
      b = getBackofficeRequestContext(request("B")),
      pendingA = a.readMembership("active-member");
    expect((await b.readMembership("active-member"))?.id).toBe("business-B");
    resolveA(identity("A"));
    expect((await pendingA)?.id).toBe("business-A");
    expect(mocks.join.mock.calls.map(([id]) => id)).toEqual(["B", "A"]);
  });
  it("keeps modes separate and projects private rows out of API owner results", async () => {
    mocks.join.mockImplementation(async (_id: string, mode: string) =>
      joined({ ...member(), id: mode }),
    );
    const context = getBackofficeRequestContext(request());
    for (const mode of ["page", "active-member", "active-owner"] as const)
      expect((await context.readMembership(mode))?.id).toBe(mode);
    expect(mocks.join).toHaveBeenCalledTimes(3);
    const owner = await requireApiOwner(request());
    if ("failure" in owner) throw new Error("Expected owner");
    expect(Object.keys(owner.business).sort()).toEqual(
      [
        "id",
        "slug",
        "countryCode",
        "currencyCode",
        "status",
        "suspensionReason",
      ].sort(),
    );
  });
  it("memoizes auth rejection without converting it to a missing session or starting recovery", async () => {
    const error = new Error("auth unavailable");
    mocks.auth.mockRejectedValue(error);
    const context = getBackofficeRequestContext(request()),
      first = context.readSession();
    await expect(first).rejects.toBe(error);
    expect(context.readSession()).toBe(first);
    await expect(context.readMembership("active-member")).rejects.toBe(error);
    expect(mocks.auth).toHaveBeenCalledTimes(1);
    expect(mocks.join).not.toHaveBeenCalled();
    expect(mocks.only).not.toHaveBeenCalled();
    await expect(
      getBackofficeRequestContext(request()).readSession(),
    ).rejects.toBe(error);
    expect(mocks.auth).toHaveBeenCalledTimes(2);
  });
  it("recovers once after JOIN failure, but never turns unknown billing into absent subscription", async () => {
    const error = new Error("subscription unavailable");
    mocks.join.mockRejectedValue(error);
    const context = getBackofficeRequestContext(request());
    expect((await context.readMembership("active-member"))?.id).toBe(
      "business-A",
    );
    const pending = context.readBilling("business-A", "active-member");
    await expect(pending).rejects.toBe(error);
    expect(context.readBilling("business-A", "active-member")).toBe(pending);
    await expect(
      context.readBilling("business-A", "active-member"),
    ).rejects.toBe(error);
    expect(mocks.join).toHaveBeenCalledTimes(1);
    expect(mocks.only).toHaveBeenCalledExactlyOnceWith("A", "active-member");
  });
  it("retains pre-billing denials on recovered rows and does not evaluate billing", async () => {
    mocks.join.mockRejectedValue(new Error("subscription unavailable"));
    for (const [row, verified, code] of [
      [
        { ...member(), role: "staff", permissions: [] },
        true,
        "missing_permission",
      ],
      [member(), false, "email_not_verified"],
      [{ ...member(), businessStatus: "closed" }, true, "business_closed"],
    ] as const) {
      mocks.only.mockResolvedValueOnce(row);
      mocks.auth.mockResolvedValueOnce(identity("A", verified));
      const req = request(),
        context = getBackofficeRequestContext(req),
        billing = vi.spyOn(context, "readBilling");
      expect(await requireApiPermission(req, "analytics")).toMatchObject({
        failure: { code },
      });
      expect(billing).not.toHaveBeenCalled();
    }
  });
  it("propagates original JOIN failure before PIN for an otherwise authorized caller", async () => {
    const req = request(),
      error = new Error("subscription unavailable");
    mocks.join.mockRejectedValue(error);
    mocks.only.mockResolvedValue({
      ...member(),
      role: "staff",
      permissions: ["analytics"],
      pinMustChange: true,
    });
    await expect(requireApiPermission(req, "analytics")).rejects.toBe(error);
    await expect(requireApiPermission(req, "analytics")).rejects.toBe(error);
    expect(mocks.auth).toHaveBeenCalledTimes(1);
    expect(mocks.join).toHaveBeenCalledTimes(1);
    expect(mocks.only).toHaveBeenCalledTimes(1);
  });
  it("memoizes a failed fallback too, preserving operational failure", async () => {
    const original = new Error("JOIN unavailable"),
      fallback = new Error("membership unavailable");
    mocks.join.mockRejectedValue(original);
    mocks.only.mockRejectedValue(fallback);
    const context = getBackofficeRequestContext(request()),
      pending = context.readMembership("active-member");
    await expect(pending).rejects.toBe(fallback);
    expect(context.readMembership("active-member")).toBe(pending);
    await expect(context.readMembership("active-member")).rejects.toBe(
      fallback,
    );
    expect(mocks.join).toHaveBeenCalledTimes(1);
    expect(mocks.only).toHaveBeenCalledTimes(1);
  });
  it("preserves billing provenance for two modes choosing the same business", async () => {
    const error = new Error("member JOIN unavailable");
    mocks.join.mockImplementation(async (_id: string, mode: string) => {
      if (mode === "active-member") throw error;
      return joined();
    });
    const context = getBackofficeRequestContext(request());
    await Promise.all([
      context.readMembership("active-member"),
      context.readMembership("active-owner"),
    ]);
    await expect(
      context.readBilling("business-A", "active-member"),
    ).rejects.toBe(error);
    expect(
      (await context.readBilling("business-A", "active-owner")).access,
    ).toBe("subscribed");
    await expect(
      context.readBilling("other-business", "active-owner"),
    ).rejects.toThrow("does not match");
    expect(mocks.join).toHaveBeenCalledTimes(2);
    expect(mocks.only).toHaveBeenCalledTimes(1);
  });
  it("permits a recovered owner only when its existing wrapper legitimately omits billing", async () => {
    mocks.join.mockRejectedValue(new Error("subscription unavailable"));
    expect(
      await requireApiOwner(request(), {}, { allowBlocked: true }),
    ).not.toHaveProperty("failure");
  });
  it("checklist reuses the guard's native session and keeps tours separate", async () => {
    const req = request();
    mocks.tours.mockResolvedValue([{ tourId: "catalog" }]);
    expect(await requireApiOwnerSinGateDeEmail(req)).not.toHaveProperty(
      "failure",
    );
    const facts = await checklistFacts(req, "business-A");
    expect(facts.emailVerified).toBe(true);
    expect([...facts.toursHechos]).toEqual(["catalog"]);
    expect(mocks.auth).toHaveBeenCalledTimes(1);
    expect(mocks.join).toHaveBeenCalledTimes(1);
    expect(mocks.tours).toHaveBeenCalledTimes(1);
  });
});
