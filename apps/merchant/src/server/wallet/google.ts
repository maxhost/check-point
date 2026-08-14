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
