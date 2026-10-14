import { afterEach, describe, expect, it, vi } from "vitest";
const retry = vi.hoisted(() =>
  vi.fn(async () => ({ claimed: 0, applied: 0, pending: 0, failed: 0 })),
);
vi.mock("./index", () => ({ retryModuleEvents: retry }));
import { GET } from "../../app/api/internal/module-events/retry/route";
const previous = process.env.CRON_SECRET;
afterEach(() => {
  vi.clearAllMocks();
  if (previous === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previous;
});
describe("generic retry cron authorization", () => {
  it("missing/wrong secret rejects before retry or DB", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(new Request("https://example.test"))).status).toBe(401);
    process.env.CRON_SECRET = "cron-secret";
    expect(
      (
        await GET(
          new Request("https://example.test", {
            headers: { authorization: "Bearer wrong" },
          }),
        )
      ).status,
    ).toBe(401);
    expect(retry).not.toHaveBeenCalled();
  });
  it("authorized empty returns only summary", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const response = await GET(
      new Request("https://example.test", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      claimed: 0,
      applied: 0,
      pending: 0,
      failed: 0,
    });
    expect(retry).toHaveBeenCalledOnce();
  });
  it("infrastructure failures are sanitized", async () => {
    process.env.CRON_SECRET = "cron-secret";
    retry.mockRejectedValueOnce(new Error("secret database detail"));
    const response = await GET(
      new Request("https://example.test", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      ok: false,
      code: "infrastructure_unavailable",
    });
  });
});
