import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConsumerAccountRow } from "./consumer/core";

/**
 * Spec 0050 / ADR 0048 — the per-consumer manifest takes its token from its OWN URL
 * (`?c=`), never from the session cookie: a `<link rel="manifest">` is fetched without
 * credentials, so the cookie mechanism resolved to "anonymous" every single time.
 */

const walletCore = vi.hoisted(() => ({ resolveWebViewToken: vi.fn() }));
const session = vi.hoisted(() => ({ resolveSession: vi.fn() }));
const nextHeaders = vi.hoisted(() => ({
  cookiesImpl: vi.fn((): unknown => {
    throw new Error("next/headers cookies() must not be read here");
  }),
  headersImpl: vi.fn(() => new Map()),
}));

vi.mock("./wallet/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./wallet/core")>()),
  ...walletCore,
}));
vi.mock("./consumer/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./consumer/session")>()),
  ...session,
}));
vi.mock("next/headers", () => ({
  cookies: () => nextHeaders.cookiesImpl(),
  headers: () => nextHeaders.headersImpl(),
}));

import { GET as manifestRoute } from "../app/(consumer)/wallet/manifest.webmanifest/route";
import { generateMetadata } from "../app/(consumer)/wallet/page";

const TOKEN = "WEB-VIEW-TOKEN-abc_123-xyz";
const account = { id: "acc-1", webViewToken: TOKEN } as ConsumerAccountRow;

/** A manifest request exactly as a browser makes it: no `cookie` header at all. */
function manifestRequest(query = "") {
  const request = new NextRequest(
    `https://checkpass.test/wallet/manifest.webmanifest${query}`,
  );
  expect(request.headers.get("cookie")).toBeNull();
  return request;
}

async function manifestBody(query = "") {
  const response = await manifestRoute(manifestRequest(query));
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain(
    "application/manifest+json",
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
  return (await response.json()) as { start_url: string; id: string };
}

describe("consumer PWA manifest start_url (spec 0050 / ADR 0048)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nextHeaders.cookiesImpl.mockImplementation(() => {
      throw new Error("next/headers cookies() must not be read here");
    });
  });

  it("resolves a valid ?c= token to the magic-link start_url, with no cookie in the request", async () => {
    walletCore.resolveWebViewToken.mockResolvedValue(account);

    const manifest = await manifestBody(`?c=${TOKEN}`);

    expect(walletCore.resolveWebViewToken).toHaveBeenCalledWith(TOKEN);
    expect(manifest.start_url).toBe(`/c/${TOKEN}`);
    // The cookie mock throws: reaching here proves the route never read the session.
    expect(nextHeaders.cookiesImpl).not.toHaveBeenCalled();
    expect(session.resolveSession).not.toHaveBeenCalled();
  });

  it("falls back to /wallet for an unknown token", async () => {
    walletCore.resolveWebViewToken.mockResolvedValue(null);
    expect((await manifestBody("?c=not-a-real-token")).start_url).toBe(
      "/wallet",
    );
    expect(walletCore.resolveWebViewToken).toHaveBeenCalledWith(
      "not-a-real-token",
    );
  });

  it("falls back to /wallet for a token rotated away by account recovery (0032)", async () => {
    // Rotation deletes the old token from the row: the lookup simply misses.
    walletCore.resolveWebViewToken.mockImplementation(async (t: string) =>
      t === "ROTATED-NEW" ? account : null,
    );
    expect((await manifestBody("?c=ROTATED-OLD")).start_url).toBe("/wallet");
  });

  it("falls back to /wallet when ?c= is absent", async () => {
    walletCore.resolveWebViewToken.mockResolvedValue(null);
    expect((await manifestBody()).start_url).toBe("/wallet");
    expect(walletCore.resolveWebViewToken).toHaveBeenCalledWith(undefined);
  });

  it("keeps id pinned at /wallet in every case (ADR 0048 §3)", async () => {
    walletCore.resolveWebViewToken.mockResolvedValue(account);
    expect((await manifestBody(`?c=${TOKEN}`)).id).toBe("/wallet");
    walletCore.resolveWebViewToken.mockResolvedValue(null);
    expect((await manifestBody("?c=dead")).id).toBe("/wallet");
    expect((await manifestBody()).id).toBe("/wallet");
  });

  it("never echoes the raw query into start_url — only the stored token", async () => {
    walletCore.resolveWebViewToken.mockResolvedValue(account);
    const manifest = await manifestBody("?c=%2Fevil%3Fx%3D1");
    expect(manifest.start_url).toBe(`/c/${TOKEN}`);
  });
});

describe("/wallet hands the token to the manifest URL (spec 0050)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nextHeaders.cookiesImpl.mockReturnValue(
      Promise.resolve({ get: () => ({ value: "session-cookie-raw" }) }),
    );
  });

  it("emits ?c=<webViewToken> when there is a session", async () => {
    session.resolveSession.mockResolvedValue(account);
    const metadata = await generateMetadata();
    expect(metadata.manifest).toBe(
      `/wallet/manifest.webmanifest?c=${encodeURIComponent(TOKEN)}`,
    );
    // The iOS standalone hook survives the switch to generateMetadata.
    expect(metadata.appleWebApp).toMatchObject({
      capable: true,
      title: "CheckPass Club",
    });
  });

  it("emits the bare manifest URL for an anonymous visitor", async () => {
    session.resolveSession.mockResolvedValue(null);
    const metadata = await generateMetadata();
    expect(metadata.manifest).toBe("/wallet/manifest.webmanifest");
  });

  it("URL-encodes the token instead of splicing it raw into the query", async () => {
    session.resolveSession.mockResolvedValue({
      ...account,
      webViewToken: "a b&c=d",
    } as ConsumerAccountRow);
    const metadata = await generateMetadata();
    expect(metadata.manifest).toBe(
      "/wallet/manifest.webmanifest?c=a%20b%26c%3Dd",
    );
  });
});
