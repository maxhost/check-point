import { decodeProtectedHeader, jwtVerify } from "jose";
import { describe, expect, it } from "vitest";
import {
  appleAuthorizeUrl,
  appleClientSecret,
  appleConfigFromEnv,
  parseAppleUser,
} from "@mi-pasaporte/domain/server/consumer/oauth/apple";
import { APPLE_SERVICE_ID, appleTestKey } from "./oauth-test-support";

/** Spec 0119 — Sign in with Apple: el `client_secret` ES256, la `.p8` del env y el `user`. */

describe("appleClientSecret", () => {
  it("es un JWT ES256 que verifica con la publica: iss=team, sub=service id, aud=Apple, kid, exp ≤ 5 min", async () => {
    const { pem, publicKey } = await appleTestKey();
    const now = new Date("2026-10-01T12:00:00Z");
    const secret = await appleClientSecret(
      {
        serviceId: APPLE_SERVICE_ID,
        keyId: "KEY123",
        teamId: "TEAM456",
        privateKey: pem,
      },
      now,
    );
    expect(decodeProtectedHeader(secret)).toEqual({
      alg: "ES256",
      kid: "KEY123",
    });
    const { payload } = await jwtVerify(secret, publicKey, {
      currentDate: now,
      algorithms: ["ES256"],
    });
    expect(payload).toMatchObject({
      iss: "TEAM456",
      sub: APPLE_SERVICE_ID,
      aud: "https://appleid.apple.com",
    });
    const issuedAt = Math.floor(now.getTime() / 1000);
    expect(payload.iat).toBe(issuedAt);
    expect(payload.exp! - issuedAt).toBeGreaterThan(0);
    expect(payload.exp! - issuedAt).toBeLessThanOrEqual(5 * 60);
  });
});

describe("appleConfigFromEnv — la clave .p8", () => {
  const base = {
    APPLE_SIGNIN_SERVICE_ID: APPLE_SERVICE_ID,
    APPLE_SIGNIN_KEY_ID: "KEY123",
    APPLE_TEAM_ID: "TEAM456",
  };

  it("acepta saltos de linea reales y `\\n` literales, y las dos firman", async () => {
    const { pem } = await appleTestKey();
    const literal = pem.trim().replace(/\n/g, "\\n");
    expect(literal).not.toContain("\n");
    const real = appleConfigFromEnv({
      ...base,
      APPLE_SIGNIN_PRIVATE_KEY: pem,
    });
    const escaped = appleConfigFromEnv({
      ...base,
      APPLE_SIGNIN_PRIVATE_KEY: literal,
    });
    expect(escaped?.privateKey).toBe(real?.privateKey);
    expect(escaped?.privateKey).toContain("\n");
    await expect(appleClientSecret(escaped!)).resolves.toMatch(/^ey/);
  });

  it("si falta algo → null", () => {
    expect(appleConfigFromEnv(base)).toBeNull();
    expect(
      appleConfigFromEnv({
        ...base,
        APPLE_TEAM_ID: " ",
        APPLE_SIGNIN_PRIVATE_KEY: "x",
      }),
    ).toBeNull();
  });
});

describe("appleAuthorizeUrl", () => {
  it("pide `name email` por form_post, con state y nonce", () => {
    const url = new URL(
      appleAuthorizeUrl({
        serviceId: APPLE_SERVICE_ID,
        redirectUri: "https://my.test/api/public/auth/apple/callback",
        state: "S",
        nonce: "N",
      }),
    );
    expect(url.origin + url.pathname).toBe(
      "https://appleid.apple.com/auth/authorize",
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: APPLE_SERVICE_ID,
      redirect_uri: "https://my.test/api/public/auth/apple/callback",
      response_type: "code",
      response_mode: "form_post",
      scope: "name email",
      state: "S",
      nonce: "N",
    });
  });
});

describe("parseAppleUser", () => {
  it("JSON valido → el nombre", () => {
    expect(
      parseAppleUser(
        JSON.stringify({
          name: { firstName: "Ana", lastName: "Pérez" },
          email: "x@privaterelay.appleid.com",
        }),
      ),
    ).toEqual({ firstName: "Ana", lastName: "Pérez" });
  });

  it("ausente, roto o sin nombre → null, sin lanzar", () => {
    expect(parseAppleUser(null)).toBeNull();
    expect(parseAppleUser(undefined)).toBeNull();
    expect(parseAppleUser("")).toBeNull();
    expect(parseAppleUser("{no es json")).toBeNull();
    expect(parseAppleUser("null")).toBeNull();
    expect(parseAppleUser(JSON.stringify({ email: "x@y" }))).toBeNull();
    expect(parseAppleUser(JSON.stringify({ name: "Ana" }))).toBeNull();
  });
});
