import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const h = vi.hoisted(() => ({
  access: vi.fn(),
  ownerAccess: vi.fn(),
  session: vi.fn(),
  domain: vi.fn(),
  legacy: vi.fn(),
}));
vi.mock("../../../server/backoffice-context", () => ({
  getBackofficeRequestContext: () => ({ readSession: h.session }),
}));
vi.mock("../../../server/backoffice-scope", () => ({
  backofficeScopeKey: () => "a".repeat(64),
}));
vi.mock("../../guard", () => ({
  requireModuleAccess: h.access,
  requireModuleOwnerAccess: h.ownerAccess,
}));
vi.mock("../../../server/api-owner", () => ({
  requireApiOwner: vi.fn(),
  apiOwnerFailureResponse: vi.fn(),
}));
vi.mock("../../activation", () => ({ setModuleEnabled: vi.fn() }));
vi.mock("../../server-registry", async () => ({
  SERVER_MODULES: { pos: (await import("./routes")).server },
}));
vi.mock("./metrics", () => ({ metricTranslators: [] }));
vi.mock("./payment-resources", () => ({ paymentResourceProviders: [] }));
vi.mock("./module", () => ({ posBeforeDisable: vi.fn() }));
vi.mock("../../../server/counter", () => ({
  getCouponState: h.domain,
  removeCoupon: h.domain,
  resolveScan: h.legacy,
}));
vi.mock("./measured-catalog", () => ({ readPosCatalog: h.domain }));
vi.mock("./measured-create", () => ({ createPosOrderV2: h.domain }));
vi.mock("./measured-update", () => ({ updatePosOrderV2: h.domain }));
vi.mock("./measured-resolve", () => ({ resolveMeasuredScan: h.domain }));
vi.mock("./measured-close", () => ({ closeMeasuredPosOrder: h.domain }));
vi.mock("./measured-void", () => ({ voidMeasuredPosOrder: h.domain }));
vi.mock("./list", () => ({ listPosOrders: h.domain }));
vi.mock("./read", () => ({ getPosOrderV2: h.domain, getPosOrder: h.legacy }));
vi.mock("./close", () => ({ closePosOrder: h.legacy }));
vi.mock("./orders", () => ({
  createPosOrder: h.legacy,
  updatePosOrder: h.legacy,
  voidPosOrder: h.legacy,
}));
vi.mock("./tables", () => ({ listPosTables: h.domain }));
vi.mock("./payment-methods", () => ({ listPaymentMethods: h.domain }));
vi.mock("./ticket-settings", () => ({
  parseTicketSettings: h.domain,
  readTicketSettings: h.domain,
  saveTicketSettings: h.domain,
}));

const { server } = await import("./routes");
const { dispatchModuleRequest } = await import("../../dispatch");
const inventory = [
  "GET payment-methods",
  "GET catalog",
  "GET orders",
  "POST orders",
  "GET orders/:id",
  "PUT orders/:id",
  "POST orders/:id/close",
  "POST orders/:id/void",
  "POST resolve",
  "GET coupon-state",
  "POST coupon-remove",
  "GET tables",
  "GET ticket",
  "GET ticket-settings",
  "PUT ticket-settings",
];
const business = { id: "b1", currencyCode: "USD", status: "active" };
const cases = server.routes.map((route) => ({
  ...route,
  label: `${route.method} ${route.path}`,
}));
function call(
  route: (typeof cases)[number],
  contract: string | null,
  scope: string | null = "a".repeat(64),
  body = "{",
) {
  const path = route.path.replace(
    ":id",
    "10000000-0000-4000-8000-000000000001",
  );
  const request = new Request(`http://localhost/api/modules/pos/${path}`, {
    method: route.method,
    headers: {
      ...(contract === null ? {} : { "X-Pos-Contract": contract }),
      ...(scope === null ? {} : { "X-Backoffice-Scope": scope }),
    },
    ...(route.method === "GET" ? {} : { body }),
  });
  const json = vi.spyOn(request, "json");
  return {
    request,
    json,
    response: () =>
      dispatchModuleRequest(route.method, request, {
        moduleId: "pos",
        path: path.split("/"),
      }),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  h.access.mockResolvedValue({ business, userId: "u1" });
  h.ownerAccess.mockResolvedValue({ business, userId: "u1" });
  h.session.mockResolvedValue({ session: { id: "s1" }, user: { id: "u1" } });
  h.domain.mockResolvedValue({ ok: true });
});
describe("P3a POS HTTP barrier: real dispatcher and complete route table, no DB", () => {
  it("covers all fifteen routes with required scope", () => {
    expect(cases.map((route) => route.label)).toEqual(inventory);
    expect(cases.every((route) => route.backofficeScope === "required")).toBe(
      true,
    );
  });
  describe.each(cases)("$label", (route) => {
    it.each([null, "1", "3", "", "02"])(
      "rejects contract %s before body and domain",
      async (contract) => {
        const request = call(route, contract);
        const response = await request.response();
        expect(response.status).toBe(409);
        expect((await response.json()).code).toBe(
          "pos_client_upgrade_required",
        );
        expect(response.headers.get("cache-control")).toBe("private, no-store");
        expect(request.json).not.toHaveBeenCalled();
        expect(h.domain).not.toHaveBeenCalled();
        expect(h.legacy).not.toHaveBeenCalled();
        expect(route.owner ? h.ownerAccess : h.access).toHaveBeenCalledOnce();
      },
    );
    it.each([null, "bad", "b".repeat(64)])(
      "scope %s precedes missing contract",
      async (scope) => {
        const request = call(route, null, scope);
        const response = await request.response();
        expect(response.status).toBe(409);
        expect((await response.json()).code).toBe("backoffice_context_changed");
        expect(response.headers.get("cache-control")).toBe("private, no-store");
        expect(request.json).not.toHaveBeenCalled();
        expect(h.domain).not.toHaveBeenCalled();
      },
    );
    it.each([401, 403])(
      "guard %i precedes scope/contract without disclosure",
      async (status) => {
        (route.owner ? h.ownerAccess : h.access).mockResolvedValue({
          response: NextResponse.json({ code: "guard_denied" }, { status }),
        });
        const request = call(route, null, "bad");
        const response = await request.response();
        expect(response.status).toBe(status);
        expect(await response.json()).toEqual({ code: "guard_denied" });
        expect(response.headers.get("cache-control")).toBe("private, no-store");
        expect(h.session).not.toHaveBeenCalled();
        expect(request.json).not.toHaveBeenCalled();
        expect(h.domain).not.toHaveBeenCalled();
      },
    );
    it("contract2 with matching scope reaches domain and never dispatches legacy", async () => {
      const response = await call(route, "2", "a".repeat(64), "{}").response();
      expect(response.status).toBe(
        route.method === "POST" && route.path === "orders" ? 201 : 200,
      );
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(h.domain).toHaveBeenCalled();
      expect(h.legacy).not.toHaveBeenCalled();
    });
  });
});
