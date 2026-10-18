import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  member: vi.fn(),
  owner: vi.fn(),
  billing: vi.fn(),
  page: vi.fn(),
  tours: vi.fn(),
}));
vi.mock("./auth", () => ({
  getMerchantAuth: () => ({ api: { getSession: mocks.auth } }),
}));
vi.mock("./staff", () => ({
  membershipContext: mocks.member,
  ownerContext: mocks.owner,
}));
vi.mock("./billing-gate", () => ({ readBusinessBilling: mocks.billing }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@mi-pasaporte/db", () => ({
  getDb: () => ({
    select: (projection: Record<string, unknown>) => {
      let where: SQL;
      const chain = {
        from: () => chain,
        innerJoin: () => chain,
        where: (value: SQL) => {
          where = value;
          return chain;
        },
        orderBy: () => chain,
        limit: (limit: number) => mocks.page(projection, where, limit),
        then: (resolve: (rows: unknown[]) => unknown) =>
          Promise.resolve(mocks.tours(where)).then(resolve),
      };
      return chain;
    },
  }),
}));
import { getBackofficeRequestContext } from "./backoffice-context";
import { requireApiPermission } from "./api-permission";
import { requireApiOwnerSinGateDeEmail } from "./api-owner";
import { checklistFacts } from "./onboarding/checklist-facts";
const request = (cookie = "A") =>
  new Request("https://merchant.test/api", { headers: { cookie } });
const identity = (id: string, verified = true) => ({
  user: { id, emailVerified: verified },
});
const member = (role = "owner", status = "active") => ({
  id: "business-A",
  slug: "synthetic",
  countryCode: "EC",
  currencyCode: "USD",
  status,
  suspensionReason: null,
  role,
  permissions: ["analytics"],
  pinMustChange: false,
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockImplementation(async ({ headers }: { headers: Headers }) =>
    identity(headers.get("cookie")!),
  );
  mocks.member.mockResolvedValue(member());
  mocks.owner.mockResolvedValue(member());
  mocks.page.mockResolvedValue([]);
  mocks.tours.mockReturnValue([]);
  mocks.billing.mockResolvedValue({
    access: "trial",
    trialEndsAt: null,
    failure: null,
  });
});
describe("backoffice context owned by Request (A2a)", () => {
  it("shares same Request auth, same-mode membership and billing promises, with one clock", async () => {
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
    expect(a.readBilling("business-A")).toBe(b.readBilling("business-A"));
    await Promise.all([
      a.readSession(),
      a.readMembership("active-member"),
      a.readBilling("business-A"),
    ]);
    expect(mocks.auth).toHaveBeenCalledTimes(1);
    expect(mocks.member).toHaveBeenCalledTimes(1);
    expect(mocks.billing).toHaveBeenCalledExactlyOnceWith("business-A", a.now);
  });
  it("revalidates another Request even with identical cookie/user, including revocation", async () => {
    const a = getBackofficeRequestContext(request()),
      b = getBackofficeRequestContext(request());
    expect(a).not.toBe(b);
    expect(a.bootId).not.toBe(b.bootId);
    expect(await a.readSession()).not.toBeNull();
    mocks.auth.mockResolvedValueOnce(null);
    expect(await b.readSession()).toBeNull();
    expect(await b.readMembership("active-member")).toBeNull();
    expect(mocks.auth).toHaveBeenCalledTimes(2);
    expect(mocks.member).not.toHaveBeenCalled();
  });
  it("rechecks membership revocation for the same authenticated user on a later Request", async () => {
    expect(
      await requireApiPermission(request(), "analytics"),
    ).not.toHaveProperty("failure");
    mocks.member.mockResolvedValueOnce(null);
    expect(await requireApiPermission(request(), "analytics")).toMatchObject({
      failure: { code: "not_member" },
    });
    expect(mocks.auth).toHaveBeenCalledTimes(2);
    expect(mocks.member).toHaveBeenCalledTimes(2);
    expect(mocks.billing).toHaveBeenCalledTimes(1);
  });
  it("never crosses interleaved identities when the second session resolves first", async () => {
    let resolveA!: (value: ReturnType<typeof identity>) => void;
    const waitingA = new Promise<ReturnType<typeof identity>>((resolve) => {
      resolveA = resolve;
    });
    mocks.auth.mockImplementation(({ headers }: { headers: Headers }) =>
      headers.get("cookie") === "A" ? waitingA : Promise.resolve(identity("B")),
    );
    mocks.member.mockImplementation(async (id: string) => ({
      ...member(),
      id: `business-${id}`,
    }));
    const a = getBackofficeRequestContext(request("A")),
      b = getBackofficeRequestContext(request("B"));
    const pendingA = a.readMembership("active-member");
    expect((await b.readMembership("active-member"))?.id).toBe("business-B");
    resolveA(identity("A"));
    expect((await pendingA)?.id).toBe("business-A");
    expect(mocks.member.mock.calls.map(([id]) => id)).toEqual(["B", "A"]);
  });
  it("keeps page, active-member and active-owner selections separate", async () => {
    mocks.page.mockResolvedValue([{ id: "page-business" }]);
    mocks.member.mockResolvedValue({ ...member(), id: "member-business" });
    mocks.owner.mockResolvedValue({ ...member(), id: "owner-business" });
    const context = getBackofficeRequestContext(request());
    expect((await context.readMembership("page"))?.id).toBe("page-business");
    expect((await context.readMembership("active-member"))?.id).toBe(
      "member-business",
    );
    expect((await context.readMembership("active-owner"))?.id).toBe(
      "owner-business",
    );
    expect(mocks.owner).toHaveBeenCalledExactlyOnceWith("A");
    expect(mocks.member).toHaveBeenCalledExactlyOnceWith("A");
    const [, where, limit] = mocks.page.mock.calls[0];
    const query = new PgDialect().sqlToQuery(where);
    expect(query.params).toEqual(["A"]);
    expect(limit).toBe(1);
  });
  it("memoizes auth rejection within Request, without converting it to missing session", async () => {
    const error = new Error("auth unavailable");
    mocks.auth.mockRejectedValue(error);
    const context = getBackofficeRequestContext(request()),
      first = context.readSession();
    await expect(first).rejects.toBe(error);
    expect(context.readSession()).toBe(first);
    await expect(context.readMembership("active-member")).rejects.toBe(error);
    expect(mocks.auth).toHaveBeenCalledTimes(1);
    expect(mocks.member).not.toHaveBeenCalled();
    await expect(
      getBackofficeRequestContext(request()).readSession(),
    ).rejects.toBe(error);
    expect(mocks.auth).toHaveBeenCalledTimes(2);
  });
  it("shares membership/billing rejections and separates billing by selected business", async () => {
    const error = new Error("billing unavailable");
    mocks.billing.mockRejectedValue(error);
    const context = getBackofficeRequestContext(request()),
      first = context.readBilling("business-A");
    await expect(first).rejects.toBe(error);
    expect(context.readBilling("business-A")).toBe(first);
    await expect(context.readBilling("business-B")).rejects.toBe(error);
    expect(mocks.billing).toHaveBeenCalledTimes(2);
    mocks.member.mockRejectedValue(error);
    const membership = context.readMembership("active-member");
    await expect(membership).rejects.toBe(error);
    expect(context.readMembership("active-member")).toBe(membership);
    expect(mocks.member).toHaveBeenCalledTimes(1);
  });
  it("does not eagerly read billing before permission, email or status denials", async () => {
    mocks.member.mockResolvedValueOnce({ ...member("staff"), permissions: [] });
    expect(await requireApiPermission(request(), "analytics")).toMatchObject({
      failure: { code: "missing_permission" },
    });
    mocks.auth.mockResolvedValueOnce(identity("A", false));
    expect(await requireApiPermission(request(), "analytics")).toMatchObject({
      failure: { code: "email_not_verified" },
    });
    mocks.member.mockResolvedValueOnce(member("owner", "closed"));
    expect(await requireApiPermission(request(), "analytics")).toMatchObject({
      failure: { code: "business_closed" },
    });
    expect(mocks.billing).not.toHaveBeenCalled();
  });
  it("propagates billing failure before PIN and shares auth/membership across guards", async () => {
    const req = request(),
      error = new Error("billing unavailable");
    mocks.member.mockResolvedValue({ ...member("staff"), pinMustChange: true });
    mocks.billing.mockRejectedValue(error);
    await expect(requireApiPermission(req, "analytics")).rejects.toBe(error);
    await expect(requireApiPermission(req, "analytics")).rejects.toBe(error);
    expect(mocks.auth).toHaveBeenCalledTimes(1);
    expect(mocks.member).toHaveBeenCalledTimes(1);
    expect(mocks.billing).toHaveBeenCalledTimes(1);
  });
  it("checklist reuses native session already resolved by the owner guard", async () => {
    const req = request();
    mocks.tours.mockReturnValue([{ tourId: "catalog" }]);
    const auth = await requireApiOwnerSinGateDeEmail(req);
    expect("failure" in auth).toBe(false);
    const facts = await checklistFacts(req, "business-A");
    expect(facts.emailVerified).toBe(true);
    expect([...facts.toursHechos]).toEqual(["catalog"]);
    expect(mocks.auth).toHaveBeenCalledTimes(1);
    expect(mocks.owner).toHaveBeenCalledTimes(1);
    expect(mocks.tours).toHaveBeenCalledTimes(1);
  });
});
