import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import type { PassLocation } from "./wallet/pass-locations";

/**
 * The CABLEADO of spec 0065 phase A4: the doors do not reach the pass by editing
 * `apple.ts`/`google-object.ts` — the input is filled field by field at THREE emission
 * call-sites, and `latestMessage?` being optional is exactly why two of the three never
 * passed it. `passLocations` is required, so `typecheck` already forbids omitting it; what
 * NO type can catch is a call-site that passes `[]`, a stale list, or the wrong
 * consumer's. That is what this file pins: each route calls the reader **with its own
 * consumer id** and hands the result through untouched.
 *
 * Everything around it is mocked (no DB, no signing): the assertion is on the input the
 * provider RECEIVES. The routes are imported dynamically inside the tests because a
 * `vi.mock` factory that closed over these arrays would run before they exist.
 */

const DOORS: PassLocation[] = [
  {
    locationId: "loc-1",
    latitude: -34.6083,
    longitude: -58.3712,
    relevantText: "Bar La Esquina: 2x1 en picadas",
    businessName: "Bar La Esquina",
    turn: { turnId: "turn-1", message: "2x1 en picadas" },
  },
];

const readerCalls: string[] = [];
const appleInputs: Record<string, unknown>[] = [];
const googleInputs: Record<string, unknown>[] = [];

vi.mock("./wallet/pass-locations-store", () => ({
  passLocationsForConsumer: async (consumerId: string) => {
    readerCalls.push(consumerId);
    return DOORS;
  },
  googleObjectPatchFor: async () => ({}),
}));

vi.mock("./wallet/provider", () => ({
  getWalletProvider: () => ({
    appleConfigured: true,
    googleConfigured: true,
    buildApplePass: async (input: Record<string, unknown>) => {
      appleInputs.push(input);
      return {
        bytes: Buffer.from("pkpass"),
        mime: "application/vnd.apple.pkpass" as const,
      };
    },
    buildGoogleSaveUrl: async (input: Record<string, unknown>) => {
      googleInputs.push(input);
      return "https://pay.google.com/gp/v/save/jwt";
    },
  }),
}));

vi.mock("./wallet/core", () => ({
  ensureWalletPass: async (consumerId: string, provider: string) => ({
    id: "pass-row",
    serialNumber: `serial-${provider}`,
    authToken: "auth-token-raw",
    consumerId,
  }),
}));

vi.mock("./consumer/session", () => ({
  resolveSession: async () => ({
    id: "consumer-session-id",
    qrToken: "QR",
    firstName: "Marcos",
    lastName: "Pérez",
    webViewToken: "WVT",
  }),
}));

vi.mock("./wallet/passkit", () => ({
  authorizePass: async () => ({ status: "ok" }) as const,
  passServeData: async () => ({
    consumerId: "consumer-serve-id",
    serialNumber: "serial-served",
    qrToken: "QR",
    firstName: "Marcos",
    lastName: "Pérez",
    webViewToken: "WVT",
    latestMessage: "Se acreditó 1 sello 🎉",
    messageUpdatedAt: null,
    authToken: "auth-token-raw",
  }),
}));

/** A `NextRequest` stand-in: a real `Request` plus the two Next-only members these
 * routes read (`cookies` for the consumer session, `nextUrl` for the pass origin). */
function request(url: string): NextRequest {
  return Object.assign(
    new Request(url, {
      headers: { authorization: "ApplePass auth-token-raw" },
    }),
    {
      cookies: { get: () => ({ value: "consumer-session-cookie" }) },
      nextUrl: new URL(url),
    },
  ) as unknown as NextRequest;
}

beforeEach(() => {
  readerCalls.length = 0;
  appleInputs.length = 0;
  googleInputs.length = 0;
});

describe("the three emission call-sites fill `passLocations` from pass_placement", () => {
  it("PassKit serve (the route an INSTALLED pass pulls) — by the served pass's consumer", async () => {
    const { GET } =
      await import("../app/api/public/wallet/passkit/v1/passes/[passTypeId]/[serialNumber]/route");
    const res = await GET(
      request("https://app.test/api/public/wallet/passkit/v1/passes/pt/s1"),
      { params: Promise.resolve({ serialNumber: "serial-served" }) },
    );
    expect(res.status).toBe(200);
    expect(readerCalls).toEqual(["consumer-serve-id"]);
    expect(appleInputs).toHaveLength(1);
    expect(appleInputs[0].passLocations).toEqual(DOORS);
  });

  it("apple.pkpass (first install) — by the session's consumer", async () => {
    const { GET } = await import("../app/api/public/wallet/apple.pkpass/route");
    const res = await GET(
      request("https://app.test/api/public/wallet/apple.pkpass"),
    );
    expect(res.status).toBe(200);
    expect(readerCalls).toEqual(["consumer-session-id"]);
    expect(appleInputs).toHaveLength(1);
    expect(appleInputs[0].passLocations).toEqual(DOORS);
  });

  it("google save URL — by the session's consumer", async () => {
    const { GET } = await import("../app/api/public/wallet/google/route");
    const res = await GET(request("https://app.test/api/public/wallet/google"));
    expect(res.status).toBe(302);
    expect(readerCalls).toEqual(["consumer-session-id"]);
    expect(googleInputs).toHaveLength(1);
    expect(googleInputs[0].passLocations).toEqual(DOORS);
  });
});
