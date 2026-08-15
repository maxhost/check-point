import { createSign } from "node:crypto";
import { WALLET_BRAND } from "./core";
import type { PassBuildInput } from "./provider";

/** Class suffix under the issuer — the single Mi Pasaporte identity Loyalty Class. */
export const GOOGLE_CLASS_SUFFIX = "mipasaporte_identity";

/** Fully-qualified Loyalty Class id (`<issuerId>.<suffix>`). */
export function loyaltyClassId(issuerId: string): string {
  return `${issuerId}.${GOOGLE_CLASS_SUFFIX}`;
}

/**
 * Loyalty Object id = `<issuerId>.<serialNumber>`. The serialNumber is base64url
 * (`A-Za-z0-9-_`), all valid Google object-id characters — no `.`/`+`/`/` to escape.
 */
export function loyaltyObjectId(
  issuerId: string,
  serialNumber: string,
): string {
  return `${issuerId}.${serialNumber}`;
}

/** Builds the Loyalty Object for one consumer (barcode = qrToken; link "Ver mis programas"). */
export function buildLoyaltyObject(
  input: PassBuildInput,
  issuerId: string,
): Record<string, unknown> {
  const programsUrl = `${input.origin}/c/${input.webViewToken}`;
  const holder = `${input.firstName} ${input.lastName}`.trim();
  return {
    id: loyaltyObjectId(issuerId, input.serialNumber),
    classId: loyaltyClassId(issuerId),
    state: "ACTIVE",
    accountName: holder || WALLET_BRAND.organizationName,
    accountId: input.serialNumber,
    barcode: {
      type: "QR_CODE",
      value: input.qrToken,
    },
    // The single "Última novedad" slot (ADR 0033), mirrored on the Google object.
    textModulesData: input.latestMessage
      ? [
          {
            id: "latest",
            header: "Última novedad",
            body: input.latestMessage,
          },
        ]
      : [],
    linksModuleData: {
      uris: [
        {
          uri: programsUrl,
          description: "Ver mis programas",
          id: "programs",
        },
      ],
    },
  };
}

const WALLETOBJECTS = "https://walletobjects.googleapis.com/walletobjects/v1";

/**
 * The `addMessage` request for one Loyalty Object (spec 0033): a POST that appends a
 * dated message to the object so Google Wallet raises a notification. Pure so the
 * URL/body can be asserted without a network call (the fake channel uses this shape).
 */
export function buildAddMessageRequest(
  issuerId: string,
  serialNumber: string,
  message: { header: string; body: string },
): { url: string; body: Record<string, unknown> } {
  const objectId = loyaltyObjectId(issuerId, serialNumber);
  return {
    url: `${WALLETOBJECTS}/loyaltyObject/${objectId}/addMessage`,
    body: {
      message: {
        header: message.header,
        body: message.body,
        id: `msg-${Date.now()}`,
      },
    },
  };
}

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

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

/**
 * Signs the "Add to Google Wallet" JWT (RS256) with the service-account private
 * key using node:crypto directly (no JWT lib). The JWT references the Mi Pasaporte
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
