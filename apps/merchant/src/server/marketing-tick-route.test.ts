import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./marketing/tick", () => ({ runMarketingTick: vi.fn() }));

import { GET } from "../app/api/internal/marketing-tick/route";
import { runMarketingTick } from "./marketing/tick";

const tick = vi.mocked(runMarketingTick);

/**
 * The tick endpoint's door (spec 0065 DoD: «el tick sin `CRON_SECRET` → 401»). The tick
 * itself is mocked: what is under test is the guard, and the guard has to reject BEFORE
 * any work — an endpoint that queues turns and then answers 401 has already run.
 */

function request(authorization?: string): Request {
  return new Request("https://example.test/api/internal/marketing-tick", {
    headers: authorization ? { authorization } : {},
  });
}

describe("GET /api/internal/marketing-tick", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    tick.mockReset();
  });

  it("rejects when the secret is not configured, even with a Bearer", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await GET(request("Bearer whatever"));
    expect(response.status).toBe(401);
    expect(tick).not.toHaveBeenCalled();
  });

  it("rejects a wrong or missing Bearer WITHOUT running the tick", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("Bearer otro"))).status).toBe(401);
    expect((await GET(request("s3cret"))).status).toBe(401);
    expect(tick).not.toHaveBeenCalled();
  });

  it("runs the tick and answers its summary", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    tick.mockResolvedValue({
      campaigns: 2,
      enqueued: 5,
      activated: 0,
      holdouts: 0,
      expired: 0,
      cancelled: 0,
      consumers: 0,
      refreshes: 0,
    });
    const response = await GET(request("Bearer s3cret"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      campaigns: 2,
      enqueued: 5,
    });
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it("answers 200 when another run holds the lock: a skip is not a failure", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    tick.mockResolvedValue({ skipped: "tick_in_flight" });
    const response = await GET(request("Bearer s3cret"));
    // A 4xx/5xx here would turn the workflow red for doing exactly the right thing.
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      skipped: "tick_in_flight",
    });
  });
});
