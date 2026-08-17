#!/usr/bin/env node
// One-time provisioning of the CheckPass Club "identity" Loyalty Class in Google
// Wallet (spec 0029 / ADR 0033). The app's google.ts creates a Loyalty *Object*
// per consumer via the "Save to Wallet" JWT, but Google requires the *Class* to
// exist first. Run this ONCE per issuer (re-run is idempotent: it PATCHes the
// existing class). No app dependency — pure Node built-ins (global fetch + crypto).
//
// The class id must match google.ts: `<issuerId>.mipasaporte_identity`.
//
// Usage:
//   node scripts/google-wallet/provision-class.mjs \
//     --sa ./sa.json \                 # path to the service-account JSON key
//     --issuer 3388000000022... \      # your Google Wallet Issuer ID
//     --logo https://.../logo.png      # public HTTPS logo (Google requires programLogo)
//
// Env fallbacks: GOOGLE_WALLET_SA_JSON_FILE, GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_LOGO_URL.

import { createSign } from "node:crypto";
import { readFileSync as readFile } from "node:fs";

const CLASS_SUFFIX = "mipasaporte_identity"; // keep in sync with google.ts GOOGLE_CLASS_SUFFIX
const SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass";

function arg(name, envKey) {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return envKey ? process.env[envKey] : undefined;
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

async function accessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claims}`;
  const signature = createSign("RSA-SHA256")
    .update(signingInput)
    .sign(sa.private_key)
    .toString("base64url");
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = await res.json();
  if (!res.ok)
    throw new Error(`token exchange failed (${res.status}): ${JSON.stringify(body)}`);
  return body.access_token;
}

function classBody(issuerId, logoUrl) {
  return {
    id: `${issuerId}.${CLASS_SUFFIX}`,
    issuerName: "CheckPass Club",
    programName: "CheckPass Club",
    programLogo: { sourceUri: { uri: logoUrl } },
    reviewStatus: "UNDER_REVIEW",
    hexBackgroundColor: "#0f2a3a",
  };
}

async function main() {
  const saPath = arg("sa", "GOOGLE_WALLET_SA_JSON_FILE");
  const issuerId = arg("issuer", "GOOGLE_WALLET_ISSUER_ID");
  const logoUrl = arg("logo", "GOOGLE_WALLET_LOGO_URL");
  if (!saPath || !issuerId || !logoUrl) {
    console.error(
      "Faltan argumentos. Uso:\n  node scripts/google-wallet/provision-class.mjs --sa ./sa.json --issuer <ISSUER_ID> --logo <https URL de logo>",
    );
    process.exit(2);
  }
  const sa = JSON.parse(readFile(saPath, "utf8"));
  if (!sa.client_email || !sa.private_key)
    throw new Error("El JSON de la service account no tiene client_email/private_key.");

  const token = await accessToken(sa);
  const classId = `${issuerId}.${CLASS_SUFFIX}`;
  const authHeader = { authorization: `Bearer ${token}` };

  const getRes = await fetch(`${API}/${encodeURIComponent(classId)}`, {
    headers: authHeader,
  });

  if (getRes.status === 404) {
    const res = await fetch(API, {
      method: "POST",
      headers: { ...authHeader, "content-type": "application/json" },
      body: JSON.stringify(classBody(issuerId, logoUrl)),
    });
    const body = await res.json();
    if (!res.ok) {
      if (res.status === 403)
        console.error(
          "403: la service account no tiene acceso al issuer. En el Pay & Wallet console -> Users, agregá el email de la SA (client_email) con rol Developer/Admin.",
        );
      throw new Error(`create failed (${res.status}): ${JSON.stringify(body)}`);
    }
    console.log(`✓ Loyalty Class creada: ${body.id} (reviewStatus=${body.reviewStatus})`);
    return;
  }

  if (getRes.ok) {
    const res = await fetch(`${API}/${encodeURIComponent(classId)}`, {
      method: "PATCH",
      headers: { ...authHeader, "content-type": "application/json" },
      body: JSON.stringify(classBody(issuerId, logoUrl)),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`patch failed (${res.status}): ${JSON.stringify(body)}`);
    console.log(`✓ Loyalty Class ya existía; actualizada: ${body.id}`);
    return;
  }

  const body = await getRes.text();
  if (getRes.status === 403)
    console.error(
      "403: la service account no tiene acceso al issuer. Agregá su email en Pay & Wallet console -> Users (Developer/Admin).",
    );
  throw new Error(`get class failed (${getRes.status}): ${body}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
