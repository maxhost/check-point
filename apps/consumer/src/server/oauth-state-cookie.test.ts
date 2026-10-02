import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OAUTH_COOKIE,
  decodeOAuthState,
  encodeOAuthState,
  newOAuthState,
} from "@mi-pasaporte/domain/server/consumer/oauth/state-cookie";
import { pkceChallenge } from "@mi-pasaporte/domain/server/consumer/oauth/google";
import { GET as start } from "../app/api/public/auth/[provider]/start/route";

/**
 * Spec 0119 / ADR 0111 §10 — la cookie transitoria `__Host-cp_oauth`. ORACULO DE M6: los
 * atributos del `Set-Cookie` que emite `start`. `SameSite=None` es lo que deja que la cookie
 * viaje en el POST cross-site con que Apple vuelve; con `Lax` el callback de Apple veria
 * siempre «sin cookie» (eso ultimo solo se ve en el QA real).
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("state cookie — ida y vuelta", () => {
  it("codifica y decodifica el intento entero", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    const attempt = newOAuthState({
      provider: "google",
      programId: "prog-1",
      loc: "loc-9",
      now,
    });
    expect(attempt.verifier).toBeTruthy();
    expect(attempt.state).not.toBe(attempt.nonce);
    expect(attempt.exp).toBe(now.getTime() + 600_000);
    expect(decodeOAuthState(encodeOAuthState(attempt), now)).toEqual(attempt);
  });

  it("Apple no lleva verificador PKCE", () => {
    expect(newOAuthState({ provider: "apple" }).verifier).toBeUndefined();
  });

  it("vencida, rota o ausente → null", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    const attempt = newOAuthState({ provider: "apple", now });
    expect(
      decodeOAuthState(
        encodeOAuthState(attempt),
        new Date(now.getTime() + 600_001),
      ),
    ).toBeNull();
    expect(decodeOAuthState(undefined)).toBeNull();
    expect(decodeOAuthState("no-es-base64-json")).toBeNull();
    expect(
      decodeOAuthState(
        Buffer.from(JSON.stringify({ ...attempt, provider: "x" })).toString(
          "base64url",
        ),
        now,
      ),
    ).toBeNull();
  });
});

describe("GET auth/[provider]/start", () => {
  const call = (provider: string, query = "") =>
    start(
      new NextRequest(
        `https://my.checkpass.test/api/public/auth/${provider}/start${query}`,
      ),
      { params: Promise.resolve({ provider }) },
    );

  it("el Set-Cookie trae __Host-, Secure, HttpOnly, SameSite=None, Path=/ y sin Domain", async () => {
    vi.stubEnv("CONSUMER_GOOGLE_CLIENT_ID", "google-client.apps.test");
    vi.stubEnv("CONSUMER_GOOGLE_CLIENT_SECRET", "secret");
    const response = await call("google", "?programId=prog-1&loc=loc-9");
    expect(response.status).toBe(302);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie.startsWith(`${OAUTH_COOKIE}=`)).toBe(true);
    const attributes = setCookie
      .split(";")
      .slice(1)
      .map((part) => part.trim().toLowerCase());
    expect(attributes).toContain("secure");
    expect(attributes).toContain("httponly");
    expect(attributes).toContain("samesite=none");
    expect(attributes).toContain("path=/");
    expect(attributes).toContain("max-age=600");
    expect(attributes.some((a) => a.startsWith("domain="))).toBe(false);
  });

  it("Google: 302 al proveedor con state, nonce y el PKCE de la cookie", async () => {
    vi.stubEnv("CONSUMER_GOOGLE_CLIENT_ID", "google-client.apps.test");
    vi.stubEnv("CONSUMER_GOOGLE_CLIENT_SECRET", "secret");
    vi.stubEnv("CONSUMER_ORIGIN", "https://my.checkpass.club");
    const response = await call("google", "?programId=prog-1&loc=loc-9");
    const location = new URL(response.headers.get("location")!);
    expect(location.origin).toBe("https://accounts.google.com");
    const raw = /__Host-cp_oauth=([^;]+)/.exec(
      response.headers.get("set-cookie")!,
    )![1];
    const cookie = decodeOAuthState(raw)!;
    expect(cookie).toMatchObject({
      provider: "google",
      programId: "prog-1",
      loc: "loc-9",
    });
    const query = Object.fromEntries(location.searchParams);
    expect(query).toMatchObject({
      client_id: "google-client.apps.test",
      redirect_uri: "https://my.checkpass.club/api/public/auth/google/callback",
      scope: "openid email profile",
      state: cookie.state,
      nonce: cookie.nonce,
      code_challenge: pkceChallenge(cookie.verifier!),
      code_challenge_method: "S256",
      prompt: "select_account",
    });
  });

  it("proveedor desconocido → 404 sin cookie", async () => {
    const response = await call("facebook");
    expect(response.status).toBe(404);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("proveedor sin configurar → 303 de vuelta a la landing con ?error=auth", async () => {
    vi.stubEnv("CONSUMER_GOOGLE_CLIENT_ID", "");
    vi.stubEnv("CONSUMER_ORIGIN", "");
    const response = await call("google", "?programId=prog-1");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://my.checkpass.test/enroll/prog-1?error=auth",
    );
  });
});
