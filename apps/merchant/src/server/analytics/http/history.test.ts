import { beforeEach, expect, it, vi } from "vitest";
const io = vi.hoisted(() => ({ auth: vi.fn(), scope: vi.fn(), read: vi.fn() }));
vi.mock("../../api-permission", () => ({
  requireApiPermissionSinGateDeEmail: io.auth,
}));
vi.mock("../../api-owner", () => ({
  apiOwnerFailureResponse: (f: {
    status: number;
    code: string;
    message: string;
  }) => Response.json({ code: f.code, error: f.message }, { status: f.status }),
}));
vi.mock("../../backoffice-scope-http", () => ({
  backofficeScopeFailure: io.scope,
  privateBackofficeResponse: (r: Response) => {
    r.headers.set("Cache-Control", "private, no-store");
    return r;
  },
}));
vi.mock("../queries", () => ({
  readHistory: io.read,
  readDay: vi.fn(),
  AnalyticsError: class extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("../lifecycle", () => ({
  readInbox: vi.fn(),
  decideInboxCard: vi.fn(),
  cleanupInbox: vi.fn(),
}));
vi.mock("../evaluation", () => ({
  evaluateBusiness: vi.fn(),
  evaluateDueBusinesses: vi.fn(),
}));
import { historyGET } from "./index";
const request = (period = "month") =>
  new Request(
    `https://merchant.invalid/api/analytics/history?businessId=foreign&period=${period}&locationId=selected`,
    { headers: { "X-Backoffice-Scope": "a".repeat(64) } },
  );
beforeEach(() => {
  vi.resetAllMocks();
  io.auth.mockResolvedValue({ business: { id: "guarded" } });
  io.scope.mockResolvedValue(null);
  io.read.mockResolvedValue({ recentMovements: [] });
});
it.each([401, 402, 403])(
  "denies %s before scope or reading money",
  async (status) => {
    io.auth.mockResolvedValue({
      failure: { status, code: "denied", message: "Denied" },
    });
    const r = await historyGET(request());
    expect(r.status).toBe(status);
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
    expect(io.scope).not.toHaveBeenCalled();
    expect(io.read).not.toHaveBeenCalled();
  },
);
it("checks scope before querying and uses the guarded tenant and selected local", async () => {
  const req = request("3m"),
    r = await historyGET(req);
  expect(r.status).toBe(200);
  expect(io.auth).toHaveBeenCalledWith(req, "analytics");
  expect(io.scope).toHaveBeenCalledWith(req, "guarded");
  expect(io.read).toHaveBeenCalledExactlyOnceWith("guarded", "3m", "selected");
  expect(io.scope.mock.invocationCallOrder[0]).toBeLessThan(
    io.read.mock.invocationCallOrder[0]!,
  );
  expect(r.headers.get("Cache-Control")).toBe("private, no-store");
});
it("returns scope409 without exposing rows", async () => {
  io.scope.mockResolvedValue(
    Response.json({ code: "backoffice_context_changed" }, { status: 409 }),
  );
  const r = await historyGET(request());
  expect(r.status).toBe(409);
  expect(io.read).not.toHaveBeenCalled();
  expect(r.headers.get("Cache-Control")).toBe("private, no-store");
});
it("keeps invalid periods and failed reads private", async () => {
  expect((await historyGET(request("unsupported"))).status).toBe(400);
  expect(io.read).not.toHaveBeenCalled();
  io.read.mockRejectedValueOnce(new Error("private SQL"));
  const r = await historyGET(request());
  expect(r.status).toBe(503);
  expect(r.headers.get("Cache-Control")).toBe("private, no-store");
  expect(JSON.stringify(await r.json())).not.toContain("private SQL");
});
