import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// Keep the route's rate-limit branch off the DB: stub the passkit lookups so a request
// that passes the limiter returns 404 (never touching getDb), and the one over the
// limit returns 429 before auth runs at all.
vi.mock("./wallet/passkit", () => ({
  authorizePass: async () => ({ status: "not_found" }) as const,
  passServeData: async () => null,
}));

const SERIAL = "serial-rate-limit";

function serveRequest(): NextRequest {
  return new Request(
    "https://example.test/api/public/wallet/passkit/v1/passes/pt/serial",
    {
      headers: { authorization: "ApplePass whatever" },
    },
  ) as unknown as NextRequest;
}

async function loadRoute(max: number) {
  vi.resetModules();
  vi.stubEnv("WALLET_PASSKIT_RATE_MAX", String(max));
  vi.stubEnv("WALLET_PASSKIT_RATE_WINDOW_MS", "60000");
  return import("../app/api/public/wallet/passkit/v1/passes/[passTypeId]/[serialNumber]/route");
}

describe("PassKit serve route enforces the per-serial rate limit (spec 0033 Fix 3)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows up to the max per serial, then returns 429 over the limit", async () => {
    const { GET } = await loadRoute(2);
    const params = { params: Promise.resolve({ serialNumber: SERIAL }) };

    // Within the limit → the limiter passes and the (stubbed) lookup 404s.
    const first = await GET(serveRequest(), params);
    expect(first.status).toBe(404);
    const second = await GET(serveRequest(), params);
    expect(second.status).toBe(404);

    // Over the limit for the SAME serial → 429, before auth even runs.
    const third = await GET(serveRequest(), params);
    expect(third.status).toBe(429);

    // A different serial has its own budget.
    const other = await GET(serveRequest(), {
      params: Promise.resolve({ serialNumber: "other-serial" }),
    });
    expect(other.status).toBe(404);
  });
});
