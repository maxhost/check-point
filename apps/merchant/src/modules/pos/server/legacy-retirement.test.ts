import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const h = vi.hoisted(() => ({
  guard: vi.fn(),
  domain: vi.fn(),
  body: vi.fn(),
}));
vi.mock("../../../app/api/counter/_auth", () => ({
  requireOperator: h.guard,
  readJson: h.body,
  counterError: vi.fn(),
}));
vi.mock("../../../server/counter", () => ({
  resolveScan: h.domain,
  grantAccrual: h.domain,
  redeemReward: h.domain,
  getCouponState: h.domain,
  removeCoupon: h.domain,
}));
vi.mock("../../../server/backoffice-context", () => ({}));
const routes = [
  ["resolve", (await import("../../../app/api/counter/resolve/route")).POST],
  ["grant", (await import("../../../app/api/counter/grant/route")).POST],
  ["redeem", (await import("../../../app/api/counter/redeem/route")).POST],
  [
    "coupon-state",
    (await import("../../../app/api/counter/coupon-state/route")).GET,
  ],
  [
    "coupon-remove",
    (await import("../../../app/api/counter/coupon-remove/route")).POST,
  ],
] as const;
beforeEach(() => {
  vi.clearAllMocks();
  h.guard.mockResolvedValue({ business: { id: "b1" }, userId: "u1" });
});
describe.each(routes)("retired Counter %s", (path, handler) => {
  function request() {
    return new Request(
      `http://localhost/api/counter/${path}?membershipId=secret`,
      {
        method: path === "coupon-state" ? "GET" : "POST",
        ...(path === "coupon-state" ? {} : { body: "{" }),
      },
    );
  }
  it("guards then returns410 without parsing, redirect or domain effects", async () => {
    const req = request();
    const json = vi.spyOn(req, "json");
    const response = await handler(req);
    expect(h.guard).toHaveBeenCalledExactlyOnceWith(req);
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({
      code: "feature_retired",
      error: "Esta función ya no está disponible.",
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("location")).toBeNull();
    expect(json).not.toHaveBeenCalled();
    expect(h.body).not.toHaveBeenCalled();
    expect(h.domain).not.toHaveBeenCalled();
  });
  it.each([401, 403])(
    "preserves guard %i privately without disclosure",
    async (status) => {
      h.guard.mockResolvedValue({
        response: NextResponse.json({ code: "guard_denied" }, { status }),
      });
      const response = await handler(request());
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ code: "guard_denied" });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(h.body).not.toHaveBeenCalled();
      expect(h.domain).not.toHaveBeenCalled();
    },
  );
});
