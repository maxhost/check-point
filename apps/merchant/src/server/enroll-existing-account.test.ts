import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConsumerError,
  type ConsumerAccountRow,
  type MembershipRow,
} from "./consumer/core";

/**
 * Spec 0054 / ADR 0051 — the 201 of the enroll POST carries `existingAccount` so the
 * confirmation can show the "ya tienes una cuenta" toast when the profile was reused
 * as-is. Invariants under test:
 *
 * 1. The boolean travels ONLY in the 201 (same criterion as `walletManifestPath`):
 *    true on a reused phone, false on a fresh alta, absent from EVERY error status.
 * 2. The toast renders ONLY under `existingAccount` — a fresh alta shows no notice.
 *    There is no jsdom in this package (vitest `environment: "node"`), so that part is
 *    a static pin of the sources, written to fail loudly rather than pass vacuously
 *    (each file read is asserted non-trivial, the enroll tree is asserted non-empty).
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

const account: ConsumerAccountRow = {
  id: "acc-1",
  phoneE164: "+593987654321",
  phoneVerifiedAt: null,
  firstName: "Ana",
  lastName: "Pérez",
  countryIso: "EC",
  qrToken: "QR-TOKEN-secret",
  webViewToken: "WEB-VIEW-TOKEN-abc",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

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
function wireSuccess(existingAccount: boolean) {
  validation.validateEnrollInput.mockReturnValue(VALID_INPUT);
  rateLimit.enforceEnrollRateLimit.mockResolvedValue(undefined);
  enrollment.enroll.mockResolvedValue({ account, membership, existingAccount });
  session.issueSession.mockResolvedValue("session-token");
}

async function bodyOf(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the enroll 201 carries existingAccount (spec 0054 / ADR 0051)", () => {
  it("true when the phone already had an account (profile reused as-is)", async () => {
    wireSuccess(true);
    const response = await post();
    expect(response.status).toBe(201);
    const body = await bodyOf(response);
    expect(body.existingAccount).toBe(true);
    // Same response that issues the session — the ADR's safety argument.
    expect(session.issueSession).toHaveBeenCalledWith("acc-1");
    expect(response.headers.get("set-cookie")).toContain("consumer_session=");
  });

  it("false on a fresh alta — present, not merely absent", async () => {
    wireSuccess(false);
    const response = await post();
    expect(response.status).toBe(201);
    const body = await bodyOf(response);
    expect(body).toHaveProperty("existingAccount");
    expect(body.existingAccount).toBe(false);
  });
});

describe("no error status ever includes existingAccount (spec 0054)", () => {
  async function expectNoFlag(response: Response, status: number) {
    expect(response.status).toBe(status);
    const body = await bodyOf(response);
    expect(body).not.toHaveProperty("existingAccount");
    // Belt and braces: the flag must not hide in another field either.
    expect(JSON.stringify(body)).not.toContain("existingAccount");
    expect(session.issueSession).not.toHaveBeenCalled();
  }

  it("400 malformed JSON body", async () => {
    wireSuccess(true);
    await expectNoFlag(await post("{not json"), 400);
    expect(enrollment.enroll).not.toHaveBeenCalled();
  });

  it("400 invalid input (validation throws)", async () => {
    wireSuccess(true);
    validation.validateEnrollInput.mockImplementation(() => {
      throw new ConsumerError(400, "invalid_input", "Revisá los datos.");
    });
    await expectNoFlag(await post(), 400);
    expect(enrollment.enroll).not.toHaveBeenCalled();
  });

  it("429 rate-limited", async () => {
    wireSuccess(true);
    rateLimit.enforceEnrollRateLimit.mockRejectedValue(
      new ConsumerError(429, "rate_limited", "Demasiados intentos."),
    );
    await expectNoFlag(await post(), 429);
    expect(enrollment.enroll).not.toHaveBeenCalled();
  });

  it("409 already a member", async () => {
    wireSuccess(true);
    enrollment.enroll.mockRejectedValue(
      new ConsumerError(409, "already_member", "Ya formás parte."),
    );
    await expectNoFlag(await post(), 409);
  });

  it("404 program unavailable", async () => {
    wireSuccess(true);
    enrollment.enroll.mockRejectedValue(
      new ConsumerError(404, "program_unavailable", "No disponible."),
    );
    await expectNoFlag(await post(), 404);
  });

  it("503 unexpected failure", async () => {
    wireSuccess(true);
    enrollment.enroll.mockRejectedValue(new Error("db down"));
    await expectNoFlag(await post(), 503);
  });
});

// ---------------------------------------------------------------------------
// Static pin of the client side (no jsdom in this package).

const CONSUMER = join(import.meta.dirname, "../app/(consumer)");

/** Exact copy decided by the owner (ADR 0051). */
const NOTICE =
  "Ya tienes una cuenta con ese teléfono: te enrolaste en el programa con tus datos.";

function source(relative: string): string {
  const text = readFileSync(join(CONSUMER, relative), "utf8");
  // A truncated/empty read must not pass as "nothing here".
  expect(text.length, `${relative} looks empty`).toBeGreaterThan(400);
  return text;
}

describe("the confirmation shows the toast only under existingAccount (spec 0054)", () => {
  const confirmation = source("enroll/[programId]/enroll-confirmation.tsx");
  const enrollForm = source("enroll/[programId]/enroll-form.tsx");

  it("carries the exact copy the owner decided, defined exactly once", () => {
    expect(confirmation).toContain(NOTICE);
    expect(confirmation.split(NOTICE)).toHaveLength(2);
  });

  it("renders the notice ONLY inside the existingAccount conditional", () => {
    // The constant holding the copy is rendered once, and that render sits inside
    // `{existingAccount ? (…)}` — an unconditional render would show the notice on
    // every fresh alta.
    const renders = confirmation.match(/\{EXISTING_ACCOUNT_NOTICE\}/g) ?? [];
    expect(renders).toHaveLength(1);
    expect(confirmation).toMatch(
      /\{existingAccount \? \([\s\S]{0,700}\{EXISTING_ACCOUNT_NOTICE\}/,
    );
  });

  it("is non-blocking: an aviso, not a gate on the rest of the screen", () => {
    // The felicitación and the install/wallet blocks stay outside the conditional:
    // the notice block closes (`) : null}`) before the <h2> greeting renders.
    expect(confirmation).toMatch(
      /\{existingAccount \? \([\s\S]{0,900}\) : null\}[\s\S]{0,200}<h2/,
    );
    expect(confirmation).toContain('role="status"');
  });

  it("the form passes the flag taken ONLY from the 201 response, explicit-true only", () => {
    expect(enrollForm).toMatch(
      /if \(res\.status === 201\) \{[\s\S]{0,700}existingAccount/,
    );
    // A malformed/absent field degrades to false (older server → no toast).
    expect(enrollForm).toContain("data?.existingAccount === true");
    expect(enrollForm).toContain("existingAccount={screen.existingAccount}");
  });

  it("no other file in the enroll tree renders the notice", () => {
    const files = readdirSync(join(CONSUMER, "enroll/[programId]")).filter(
      (f) => f.endsWith(".tsx"),
    );
    // Floor: an empty listing (moved/renamed tree) must not pass as "clean".
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const file of files) {
      if (file === "enroll-confirmation.tsx") continue;
      const text = source(`enroll/[programId]/${file}`);
      expect(text, file).not.toContain("Ya tienes una cuenta");
    }
  });
});
