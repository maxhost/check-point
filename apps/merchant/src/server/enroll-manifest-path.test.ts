import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConsumerError,
  type ConsumerAccountRow,
  type MembershipRow,
  walletManifestPathFor,
} from "./consumer/core";

/**
 * Spec 0051 / ADR 0049 — the 201 of the enroll POST carries `walletManifestPath` so the
 * client-side confirmation can inject the per-consumer manifest and the icon installed
 * from THAT screen opens the wallet. Invariant under test: the path travels ONLY in the
 * 201 — the same response that issues the session cookie. No error status (400/404/409/
 * 429/503) ever includes it, because none of them issues a session.
 */

const validation = vi.hoisted(() => ({ validateEnrollInput: vi.fn() }));
const rateLimit = vi.hoisted(() => ({ enforceEnrollRateLimit: vi.fn() }));
const enrollment = vi.hoisted(() => ({ enroll: vi.fn() }));
const session = vi.hoisted(() => ({ issueSession: vi.fn() }));

vi.mock("./consumer/validation", () => validation);
vi.mock("./consumer/rate-limit", () => rateLimit);
vi.mock("./consumer/enrollment", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./consumer/enrollment")>()),
  ...enrollment,
}));
vi.mock("./consumer/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./consumer/session")>()),
  ...session,
}));

import { POST as enrollRoute } from "../app/api/public/enroll/[programId]/route";

const TOKEN = "WEB-VIEW-TOKEN-abc_123-xyz";

function accountWith(webViewToken: string): ConsumerAccountRow {
  return {
    id: "acc-1",
    phoneE164: "+593987654321",
    phoneVerifiedAt: null,
    firstName: "Ana",
    lastName: "Pérez",
    countryIso: "EC",
    qrToken: "QR-TOKEN-secret",
    webViewToken,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

const membership: MembershipRow = {
  id: "mem-1",
  programId: "prog-1",
  businessId: "biz-1",
  enrolledAt: new Date("2026-01-01T00:00:00Z"),
};

const VALID_INPUT = {
  firstName: "Ana",
  lastName: "Pérez",
  phoneE164: "+593987654321",
  countryIso: "EC",
};

function post(body: string = JSON.stringify(VALID_INPUT)) {
  const request = new NextRequest(
    "https://checkpass.test/api/public/enroll/prog-1",
    { method: "POST", body, headers: { "content-type": "application/json" } },
  );
  return enrollRoute(request, {
    params: Promise.resolve({ programId: "prog-1" }),
  });
}

/** Reusable "happy path" wiring; individual tests break one link at a time. */
function wireSuccess(webViewToken = TOKEN) {
  validation.validateEnrollInput.mockReturnValue(VALID_INPUT);
  rateLimit.enforceEnrollRateLimit.mockResolvedValue(undefined);
  enrollment.enroll.mockResolvedValue({
    account: accountWith(webViewToken),
    membership,
  });
  session.issueSession.mockResolvedValue("session-token");
}

async function bodyOf(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("walletManifestPathFor (shared helper)", () => {
  it("builds the manifest path with the token URL-encoded", () => {
    expect(walletManifestPathFor(TOKEN)).toBe(
      `/wallet/manifest.webmanifest?c=${encodeURIComponent(TOKEN)}`,
    );
    expect(walletManifestPathFor("a b&c=d")).toBe(
      "/wallet/manifest.webmanifest?c=a%20b%26c%3Dd",
    );
  });

  it("is the single builder: both the enroll 201 and /wallet's generateMetadata call it", () => {
    // Static pin — the shape must not fork between the two producers.
    for (const relative of [
      "../app/api/public/enroll/[programId]/route.ts",
      "../app/(consumer)/wallet/page.tsx",
    ]) {
      const text = readFileSync(join(import.meta.dirname, relative), "utf8");
      expect(text.length, `${relative} looks empty`).toBeGreaterThan(400);
      expect(text, relative).toContain("walletManifestPathFor(");
      // No inline re-implementation of the tokened path next to the helper call.
      expect(text, relative).not.toContain("manifest.webmanifest?c=");
    }
  });
});

describe("enroll 201 carries walletManifestPath (spec 0051 / ADR 0049)", () => {
  it("includes the path built from the account's webViewToken", async () => {
    wireSuccess();
    const response = await post();
    expect(response.status).toBe(201);
    const body = await bodyOf(response);
    expect(body.walletManifestPath).toBe(
      `/wallet/manifest.webmanifest?c=${encodeURIComponent(TOKEN)}`,
    );
    // Same response that issues the session — the ADR's safety argument.
    expect(session.issueSession).toHaveBeenCalledWith("acc-1");
    expect(response.headers.get("set-cookie")).toContain("consumer_session=");
  });

  it("URL-encodes a token with reserved characters instead of splicing it raw", async () => {
    wireSuccess("a b&c=d");
    const body = await bodyOf(await post());
    expect(body.walletManifestPath).toBe(
      "/wallet/manifest.webmanifest?c=a%20b%26c%3Dd",
    );
  });

  it("keeps the account DTO an allow-list: the raw token only travels inside the path", async () => {
    wireSuccess();
    const body = await bodyOf(await post());
    expect(body.account).not.toHaveProperty("webViewToken");
    expect(body.account).not.toHaveProperty("qrToken");
    expect(JSON.stringify(body.account)).not.toContain(TOKEN);
  });
});

describe("no error status ever includes walletManifestPath (ADR 0049 invariant)", () => {
  async function expectNoPath(response: Response, status: number) {
    expect(response.status).toBe(status);
    const body = await bodyOf(response);
    expect(body).not.toHaveProperty("walletManifestPath");
    // Belt and braces: the path (or any token) must not hide in another field.
    expect(JSON.stringify(body)).not.toContain("manifest");
    expect(session.issueSession).not.toHaveBeenCalled();
  }

  it("400 malformed JSON body", async () => {
    wireSuccess();
    await expectNoPath(await post("{not json"), 400);
    expect(enrollment.enroll).not.toHaveBeenCalled();
  });

  it("400 invalid input (validation throws)", async () => {
    wireSuccess();
    validation.validateEnrollInput.mockImplementation(() => {
      throw new ConsumerError(400, "invalid_input", "Revisá los datos.");
    });
    await expectNoPath(await post(), 400);
    expect(enrollment.enroll).not.toHaveBeenCalled();
  });

  it("429 rate-limited", async () => {
    wireSuccess();
    rateLimit.enforceEnrollRateLimit.mockRejectedValue(
      new ConsumerError(429, "rate_limited", "Demasiados intentos."),
    );
    await expectNoPath(await post(), 429);
    expect(enrollment.enroll).not.toHaveBeenCalled();
  });

  it("409 already a member", async () => {
    wireSuccess();
    enrollment.enroll.mockRejectedValue(
      new ConsumerError(409, "already_member", "Ya formás parte."),
    );
    await expectNoPath(await post(), 409);
  });

  it("404 program unavailable", async () => {
    wireSuccess();
    enrollment.enroll.mockRejectedValue(
      new ConsumerError(404, "program_unavailable", "No disponible."),
    );
    await expectNoPath(await post(), 404);
  });

  it("503 unexpected failure", async () => {
    wireSuccess();
    enrollment.enroll.mockRejectedValue(new Error("db down"));
    await expectNoPath(await post(), 503);
  });
});
