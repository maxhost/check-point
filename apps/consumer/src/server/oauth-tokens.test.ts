import { beforeAll, describe, expect, it } from "vitest";
import {
  APPLE_ISSUER,
  GOOGLE_ISSUERS,
  OAuthFailure,
  verifyIdToken,
} from "@mi-pasaporte/domain/server/consumer/oauth/tokens";
import {
  GOOGLE_CLIENT_ID,
  type TestProvider,
  testProvider,
} from "./oauth-test-support";

/**
 * Spec 0119 — `verifyIdToken`: firma contra el JWKS, `iss`, `aud`, `exp` y el `nonce` de la
 * cookie. ORACULO DE M3 (`aud` ajeno) y de M4 (`nonce` distinto): en los dos casos el token es
 * del MISMO emisor y de la MISMA clave, asi que el unico control que lo rechaza es el atacado.
 */

let google: TestProvider;
let other: TestProvider;

beforeAll(async () => {
  google = await testProvider();
  other = await testProvider();
});

const verify = (token: string, overrides: { nonce?: string } = {}) =>
  verifyIdToken({
    token,
    jwks: google.jwks,
    issuer: GOOGLE_ISSUERS,
    audience: GOOGLE_CLIENT_ID,
    nonce: overrides.nonce ?? "nonce-1",
  });

const claims = {
  sub: "google-sub-1",
  nonce: "nonce-1",
  email: "ana@example.test",
  email_verified: true,
  given_name: "Ana",
  family_name: "Pérez",
};

async function reason(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "ACEPTADO";
  } catch (error) {
    return error instanceof OAuthFailure ? error.reason : String(error);
  }
}

describe("verifyIdToken", () => {
  it("firma valida → los claims de identidad", async () => {
    expect(await verify(await google.sign(claims))).toEqual({
      sub: "google-sub-1",
      email: "ana@example.test",
      emailVerified: true,
      givenName: "Ana",
      familyName: "Pérez",
    });
  });

  it("acepta los dos issuers de Google", async () => {
    const token = await google.sign(claims, { issuer: "accounts.google.com" });
    expect((await verify(token)).sub).toBe("google-sub-1");
  });

  it("`aud` ajeno (token de OTRO cliente OAuth, mismo emisor y misma clave) → rechazo", async () => {
    const token = await google.sign(claims, { audience: "otro-cliente" });
    expect(await reason(verify(token))).toBe(
      "id_token_ERR_JWT_CLAIM_VALIDATION_FAILED",
    );
  });

  it("`iss` ajeno → rechazo", async () => {
    const token = await google.sign(claims, { issuer: APPLE_ISSUER });
    expect(await reason(verify(token))).toBe(
      "id_token_ERR_JWT_CLAIM_VALIDATION_FAILED",
    );
  });

  it("vencido → rechazo", async () => {
    const token = await google.sign(claims, { expiresIn: "-1m" });
    expect(await reason(verify(token))).toBe("id_token_ERR_JWT_EXPIRED");
  });

  it("`nonce` distinto (token de OTRO intento) → rechazo", async () => {
    const token = await google.sign({ ...claims, nonce: "nonce-de-otro" });
    expect(await reason(verify(token))).toBe("id_token_nonce");
  });

  it("sin `nonce` → rechazo", async () => {
    const { nonce: _omit, ...withoutNonce } = claims;
    void _omit;
    expect(await reason(verify(await google.sign(withoutNonce)))).toBe(
      "id_token_nonce",
    );
  });

  it("firmado con OTRA clave → rechazo", async () => {
    const token = await other.sign(claims);
    expect(await reason(verify(token))).toMatch(
      /^id_token_ERR_JWKS_NO_MATCHING_KEY|^id_token_ERR_JWS_SIGNATURE_VERIFICATION_FAILED/,
    );
  });

  it("Apple manda `email_verified` como string", async () => {
    const token = await google.sign({ ...claims, email_verified: "true" });
    expect((await verify(token)).emailVerified).toBe(true);
    const unverified = await google.sign({ ...claims, email_verified: false });
    expect((await verify(unverified)).emailVerified).toBe(false);
  });
});
