import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 0120 — `POST /api/public/session/logout`: revoca en la base y recien despues borra la
 * cookie. ORACULO DE LA M2: si la base falla, 503 y la cookie se queda.
 */

const session = vi.hoisted(() => ({ revokeSession: vi.fn() }));
vi.mock(
  "@mi-pasaporte/domain/server/consumer/session",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@mi-pasaporte/domain/server/consumer/session")
    >()),
    ...session,
  }),
);

import { POST } from "../app/api/public/session/logout/route";

function request(cookie?: string) {
  return new NextRequest(
    "https://my.checkpass.test/api/public/session/logout",
    {
      method: "POST",
      headers: cookie ? { cookie: `consumer_session=${cookie}` } : {},
    },
  );
}

beforeEach(() => {
  session.revokeSession.mockReset();
  session.revokeSession.mockResolvedValue(undefined);
});

describe("POST /api/public/session/logout", () => {
  it("con cookie: revoca ESE token, 204 y borra la cookie", async () => {
    const response = await POST(request("tok-123"));
    expect(response.status).toBe(204);
    expect(session.revokeSession).toHaveBeenCalledWith("tok-123");
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/^consumer_session=;/);
    expect(setCookie.toLowerCase()).toContain("max-age=0");
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
  });

  it("sin cookie: 204 igual (idempotente)", async () => {
    const response = await POST(request());
    expect(response.status).toBe(204);
    expect(session.revokeSession).toHaveBeenCalledWith(undefined);
  });

  it("la base falla: 503 y SIN Set-Cookie (la sesion sigue viva, no se miente)", async () => {
    session.revokeSession.mockRejectedValue(new Error("db down"));
    const response = await POST(request("tok-123"));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "logout_failed" });
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
