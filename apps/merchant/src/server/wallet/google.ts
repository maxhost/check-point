import { createSign } from "node:crypto";
import {
  buildAddMessageRequest,
  buildLoyaltyObject,
  buildPatchObjectRequest,
} from "./google-object";
import type { PassBuildInput } from "./provider";

// The pure constructors live in `google-object.ts` (no network, no secrets, and the half
// that spec 0065 phase A4 grew with the pass locations); re-exported here so every
// existing importer of `./google` keeps working.
export {
  GOOGLE_CLASS_SUFFIX,
  buildAddMessageRequest,
  buildLoyaltyObject,
  buildPatchObjectRequest,
  loyaltyClassId,
  loyaltyObjectId,
} from "./google-object";

/**
 * Mints an OAuth2 access token for the walletobjects scope from the service account
 * (JWT-bearer grant, RS256 via node:crypto). Same SA that emits the pass (0029) — no
 * new secret. Real-channel only; the fake channel never calls Google.
 */
export async function googleAccessToken(
  sa: { client_email: string; private_key: string },
  now = new Date(),
): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/wallet_object.issuer",
    aud: "https://oauth2.googleapis.com/token",
    iat,
    exp: iat + 3600,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(claims),
  )}`;
  const assertion = `${signingInput}.${createSign("RSA-SHA256")
    .update(signingInput)
    .sign(sa.private_key)
    .toString("base64url")}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Google token: no access_token");
  return json.access_token;
}

/**
 * Pushes one notice to a consumer's Loyalty Object via `addMessage`. Real-channel
 * path; authenticated with the emission service account.
 */
export async function postGoogleMessage(
  opts: { saJson: string; issuerId: string },
  serialNumber: string,
  message: { header: string; body: string },
): Promise<void> {
  const sa = JSON.parse(opts.saJson) as {
    client_email: string;
    private_key: string;
  };
  const token = await googleAccessToken(sa);
  const req = buildAddMessageRequest(opts.issuerId, serialNumber, message);
  const res = await fetch(req.url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(req.body),
  });
  if (!res.ok) throw new Error(`Google addMessage failed: ${res.status}`);
}

/**
 * Silently updates a consumer's Loyalty Object (spec 0065 `pass_refresh`): same service
 * account as `addMessage`, but `PATCH` on the object, so Google merges the fields and
 * does not notify.
 */
export async function patchGoogleLoyaltyObject(
  opts: { saJson: string; issuerId: string },
  serialNumber: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const sa = JSON.parse(opts.saJson) as {
    client_email: string;
    private_key: string;
  };
  const token = await googleAccessToken(sa);
  const req = buildPatchObjectRequest(opts.issuerId, serialNumber, patch);
  const res = await fetch(req.url, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(req.body),
  });
  if (!res.ok) throw new Error(`Google object PATCH failed: ${res.status}`);
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

/**
 * Signs the "Add to Google Wallet" JWT (RS256) with the service-account private
 * key using node:crypto directly (no JWT lib). The JWT references the CheckPass Club
 * Loyalty Class and carries the per-consumer Loyalty Object.
 */
export function buildGoogleSaveJwt(
  input: PassBuildInput,
  opts: { clientEmail: string; privateKeyPem: string; issuerId: string },
  now = new Date(),
): string {
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: opts.clientEmail,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(now.getTime() / 1000),
    payload: {
      loyaltyObjects: [buildLoyaltyObject(input, opts.issuerId)],
    },
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(claims),
  )}`;
  const signature = createSign("RSA-SHA256")
    .update(signingInput)
    .sign(opts.privateKeyPem)
    .toString("base64url");
  return `${signingInput}.${signature}`;
}

/** Returns the `https://pay.google.com/gp/v/save/<jwt>` URL from the SA secret. */
export async function buildGoogleSaveUrl(
  input: PassBuildInput,
  opts: { saJson: string; issuerId: string },
): Promise<string> {
  let sa: { client_email?: string; private_key?: string };
  try {
    sa = JSON.parse(opts.saJson) as typeof sa;
  } catch {
    throw new Error("GOOGLE_WALLET_SA_JSON is not valid JSON");
  }
  if (!sa.client_email || !sa.private_key)
    throw new Error("GOOGLE_WALLET_SA_JSON missing client_email/private_key");
  const jwt = buildGoogleSaveJwt(input, {
    clientEmail: sa.client_email,
    privateKeyPem: sa.private_key,
    issuerId: opts.issuerId,
  });
  return `https://pay.google.com/gp/v/save/${jwt}`;
}
