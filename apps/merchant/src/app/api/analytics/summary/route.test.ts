import { beforeEach, expect, it, vi } from "vitest";
const io = vi.hoisted(() => ({ auth: vi.fn(), scope: vi.fn(), read: vi.fn() }));
vi.mock("../../../../server/api-permission", () => ({
  requireApiPermissionSinGateDeEmail: io.auth,
}));
vi.mock("../../../../server/api-owner", () => ({
  apiOwnerFailureResponse: (f: {
    status: number;
    code: string;
    message: string;
  }) => Response.json({ code: f.code, error: f.message }, { status: f.status }),
}));
vi.mock("../../../../server/backoffice-scope-http", () => ({
  backofficeScopeFailure: io.scope,
  privateBackofficeResponse: (r: Response) => {
    r.headers.set("Cache-Control", "private, no-store");
    return r;
  },
}));
vi.mock("../../../../server/analytics/summary", () => ({
  readDashboardSummary: io.read,
}));
import { GET } from "./route";
const request = () =>
  new Request(
    "https://merchant.invalid/api/analytics/summary?businessId=foreign",
    { headers: { "X-Backoffice-Scope": "a".repeat(64) } },
  );
beforeEach(() => {
  vi.resetAllMocks();
  io.auth.mockResolvedValue({ business: { id: "guarded" } });
  io.scope.mockResolvedValue(null);
  io.read.mockResolvedValue({ version: 1 });
});
it.each([401, 402, 403])(
  "preserves guard failure %s before scope/domain with private responses",
  async (status) => {
    io.auth.mockResolvedValue({
      failure: { status, code: "denied", message: "Denied" },
    });
    const result = await GET(request());
    expect(result.status).toBe(status);
    expect(result.headers.get("Cache-Control")).toBe("private, no-store");
    expect(io.scope).not.toHaveBeenCalled();
    expect(io.read).not.toHaveBeenCalled();
  },
);
it("checks scope after guards and before reading the guarded tenant once", async () => {
  const req = request();
  const result = await GET(req);
  expect(result.status).toBe(200);
  expect(result.headers.get("Cache-Control")).toBe("private, no-store");
  expect(io.auth).toHaveBeenCalledWith(req, "analytics");
  expect(io.scope).toHaveBeenCalledWith(req, "guarded");
  expect(io.read).toHaveBeenCalledExactlyOnceWith("guarded");
  expect(io.auth.mock.invocationCallOrder[0]).toBeLessThan(
    io.scope.mock.invocationCallOrder[0]!,
  );
  expect(io.scope.mock.invocationCallOrder[0]).toBeLessThan(
    io.read.mock.invocationCallOrder[0]!,
  );
});
it("returns scope409 before projection and isolates operational failure", async () => {
  io.scope.mockResolvedValueOnce(
    Response.json({ code: "backoffice_context_changed" }, { status: 409 }),
  );
  expect((await GET(request())).status).toBe(409);
  expect(io.read).not.toHaveBeenCalled();
  io.read.mockRejectedValueOnce(new Error("projection offline"));
  const result = await GET(request());
  expect(result.status).toBe(503);
  expect(result.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await result.json()).not.toHaveProperty("todayRevenueMinor");
});
