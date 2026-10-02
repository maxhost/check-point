import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConsumerError,
  type ConsumerAccountRow,
  type MembershipRow,
  walletManifestPathFor,
} from "@mi-pasaporte/domain/server/consumer/core";

/**
 * Spec 0119 / ADR 0111 §7 — `POST /api/public/enroll/<id>` es el ALTA DE UN TOQUE: la cuenta
 * es la de la sesion y el cuerpo solo trae `loc`. Sin sesion → 401 sin llamar al alta. El 201
 * trae SOLO la membresia: la sesion ya existia (no hay Set-Cookie) y el manifest por cuenta lo
 * emite la confirmacion `/enroll/<id>/ready` desde la sesion (ADR 0049), no este JSON.
 */

const enrollment = vi.hoisted(() => ({ enrollAccount: vi.fn() }));
const session = vi.hoisted(() => ({ resolveSession: vi.fn() }));
const welcome = vi.hoisted(() => ({ issueWelcomeGiftsSafely: vi.fn() }));

vi.mock(
  "@mi-pasaporte/domain/server/consumer/enrollment",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@mi-pasaporte/domain/server/consumer/enrollment")
    >()),
    ...enrollment,
  }),
);
vi.mock(
  "@mi-pasaporte/domain/server/consumer/session",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@mi-pasaporte/domain/server/consumer/session")
    >()),
    ...session,
  }),
);
vi.mock("@mi-pasaporte/domain/server/marketing/welcome-issue", () => welcome);

import { POST as enrollRoute } from "../app/api/public/enroll/[programId]/route";

const TOKEN = "WEB-VIEW-TOKEN-abc_123-xyz";

const account: ConsumerAccountRow = {
  id: "acc-1",
  phoneE164: null,
  phoneVerifiedAt: null,
  firstName: "Ana",
  lastName: "Pérez",
  email: "ana@example.test",
  countryIso: null,
  qrToken: "QR-TOKEN-secret",
  webViewToken: TOKEN,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const membership: MembershipRow = {
  id: "mem-1",
  programId: "prog-1",
  businessId: "biz-1",
  enrolledAt: new Date("2026-01-01T00:00:00Z"),
};

function post(init: { cookie?: boolean; body?: string } = {}) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (init.cookie !== false) headers.cookie = "consumer_session=session-token";
  const request = new NextRequest(
    "https://my.checkpass.test/api/public/enroll/prog-1",
    { method: "POST", body: init.body ?? "{}", headers },
  );
  return enrollRoute(request, {
    params: Promise.resolve({ programId: "prog-1" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  session.resolveSession.mockImplementation(async (token?: string) =>
    token === "session-token" ? account : null,
  );
  enrollment.enrollAccount.mockResolvedValue(membership);
  welcome.issueWelcomeGiftsSafely.mockResolvedValue(undefined);
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

  it("is the single builder: the confirmation and /wallet's generateMetadata call it", () => {
    // Static pin — the shape must not fork between the two producers.
    for (const relative of [
      "../app/(consumer)/enroll/[programId]/ready/page.tsx",
      "../app/(consumer)/wallet/page.tsx",
    ]) {
      const text = readFileSync(join(import.meta.dirname, relative), "utf8");
      expect(text.length, `${relative} looks empty`).toBeGreaterThan(400);
      expect(text, relative).toContain("walletManifestPathFor(");
      expect(text, relative).not.toContain("manifest.webmanifest?c=");
    }
  });
});

describe("POST enroll — el alta de un toque (spec 0119)", () => {
  it("con sesion: 201 con SOLO la membresia, el alta es de la cuenta de la sesion, con su loc", async () => {
    const response = await post({ body: JSON.stringify({ loc: "loc-9" }) });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      membership: {
        id: "mem-1",
        programId: "prog-1",
        businessId: "biz-1",
        enrolledAt: "2026-01-01T00:00:00.000Z",
      },
    });
    expect(enrollment.enrollAccount).toHaveBeenCalledWith(
      "prog-1",
      "acc-1",
      "loc-9",
    );
    expect(welcome.issueWelcomeGiftsSafely).toHaveBeenCalledWith("acc-1");
    // La sesion ya existia: el toque no emite otra.
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("sin cuerpo tambien anda (el toque no manda datos)", async () => {
    const response = await post({ body: "" });
    expect(response.status).toBe(201);
    expect(enrollment.enrollAccount).toHaveBeenCalledWith(
      "prog-1",
      "acc-1",
      null,
    );
  });

  it("sin sesion: 401 `unauthenticated` y el alta NO se llama", async () => {
    const response = await post({ cookie: false });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "unauthenticated" });
    expect(enrollment.enrollAccount).not.toHaveBeenCalled();
  });

  it("409 already_member, 404 y 503 salen con su codigo y sin la membresia", async () => {
    enrollment.enrollAccount.mockRejectedValueOnce(
      new ConsumerError(409, "already_member", "Ya formás parte."),
    );
    const conflict = await post();
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ code: "already_member" });

    enrollment.enrollAccount.mockRejectedValueOnce(
      new ConsumerError(404, "program_unavailable", "No disponible."),
    );
    expect((await post()).status).toBe(404);

    enrollment.enrollAccount.mockRejectedValueOnce(new Error("db down"));
    const down = await post();
    expect(down.status).toBe(503);
    expect(JSON.stringify(await down.json())).not.toContain("membership");
  });

  it("un cuerpo que no es JSON es un 400 sin alta", async () => {
    expect((await post({ body: "{not json" })).status).toBe(400);
    expect(enrollment.enrollAccount).not.toHaveBeenCalled();
  });
});
