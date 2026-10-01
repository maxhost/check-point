import { generateKeyPairSync } from "node:crypto";
import { buildGoogleSaveJwt } from "./google";
import type { PassBuildInput } from "./provider";

/**
 * Dev/test Google provider without real secrets. Produces a **structurally valid**
 * "Add to Google Wallet" URL: a well-formed RS256 JWT signed by an ephemeral key
 * (so it does NOT verify against Google, but is byte-for-byte a real save JWT).
 * Apple's fake path is `selfSignedSigner()` in `apple.ts`.
 */
const FAKE_ISSUER_ID = "3388000000022222222";

let fakeKey: { privateKey: string } | null = null;
function ephemeralKey() {
  if (!fakeKey) {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    fakeKey = { privateKey };
  }
  return fakeKey;
}

export async function fakeBuildGoogleSaveUrl(
  input: PassBuildInput,
): Promise<string> {
  const jwt = buildGoogleSaveJwt(input, {
    clientEmail: "fake-sa@mipasaporte.dev.gserviceaccount.com",
    privateKeyPem: ephemeralKey().privateKey,
    issuerId: FAKE_ISSUER_ID,
  });
  return `https://pay.google.com/gp/v/save/${jwt}`;
}
