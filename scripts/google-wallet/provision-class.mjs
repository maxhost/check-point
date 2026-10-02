#!/usr/bin/env node
// Provisions the CheckPass Club identity Loyalty Class (spec 0122).
// --inspect is read-only; --apply creates or patches. --class-suffix isolates QA.

import { createSign } from "node:crypto";
import { readFileSync as readFile } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const CLASS_SUFFIX = "mipasaporte_identity"; // keep in sync with google-object.ts
const API =
  "https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const LOGO_URL = "https://my.checkpass.club/wallet-logo-trama-v1.png";
const HERO_URL = "https://my.checkpass.club/wallet-trama-hero-v1.png";
const CARD_TEMPLATE = {
  cardRowTemplateInfos: [
    {
      oneItem: {
        item: { firstValue: { fields: [{ fieldPath: "object.accountName" }] } },
      },
    },
  ],
};
const LIST_TEMPLATE = {
  firstRowOption: {
    fieldOption: { fields: [{ fieldPath: "class.programName" }] },
  },
  secondRowOption: { fields: [{ fieldPath: "object.accountName" }] },
};

function arg(name, envKey) {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return envKey ? process.env[envKey] : undefined;
}

async function accessToken(sa) {
  const iat = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  ).toString("base64url");
  const claims = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/wallet_object.issuer",
      aud: TOKEN_URL,
      iat,
      exp: iat + 3600,
    }),
  ).toString("base64url");
  const signingInput = `${header}.${claims}`;
  const signature = createSign("RSA-SHA256")
    .update(signingInput)
    .sign(sa.private_key)
    .toString("base64url");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${signingInput}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed (${res.status})`);
  const body = await res.json();
  if (!body.access_token)
    throw new Error("token exchange returned no access_token");
  return body.access_token;
}

const image = (uri) => ({ sourceUri: { uri } });

/** Complete visual contract for newly created classes. */
export function classBody(
  issuerId,
  logoUrl = LOGO_URL,
  heroUrl = HERO_URL,
  suffix = CLASS_SUFFIX,
) {
  return {
    id: `${issuerId}.${suffix}`,
    issuerName: "CheckPass Club",
    programName: "Mi CheckPass",
    programLogo: image(logoUrl),
    heroImage: image(heroUrl),
    reviewStatus: "UNDER_REVIEW",
    hexBackgroundColor: "#0f2a3a",
    accountNameLabel: "Miembro",
    classTemplateInfo: {
      cardTemplateOverride: CARD_TEMPLATE,
      listTemplateOverride: LIST_TEMPLATE,
    },
  };
}

/** Patch owned fields, preserving unrelated and nested template fields. */
export function classPatch(current, desired) {
  const patch = {};
  for (const key of [
    "issuerName",
    "programName",
    "hexBackgroundColor",
    "accountNameLabel",
  ]) {
    if (current[key] !== desired[key]) patch[key] = desired[key];
  }
  for (const key of ["programLogo", "heroImage"]) {
    const uri = desired[key].sourceUri.uri;
    if (current[key]?.sourceUri?.uri !== uri) {
      patch[key] = {
        ...current[key],
        sourceUri: { ...current[key]?.sourceUri, uri },
      };
    }
  }
  const oldTemplate = current.classTemplateInfo ?? {};
  const template = {
    ...oldTemplate,
    cardTemplateOverride: {
      ...oldTemplate.cardTemplateOverride,
      cardRowTemplateInfos:
        desired.classTemplateInfo.cardTemplateOverride.cardRowTemplateInfos,
    },
    listTemplateOverride: {
      ...oldTemplate.listTemplateOverride,
      firstRowOption:
        desired.classTemplateInfo.listTemplateOverride.firstRowOption,
      secondRowOption:
        desired.classTemplateInfo.listTemplateOverride.secondRowOption,
    },
  };
  if (!isDeepStrictEqual(oldTemplate, template))
    patch.classTemplateInfo = template;
  return Object.keys(patch).length
    ? { ...patch, reviewStatus: "UNDER_REVIEW" }
    : null;
}

/** Presentation-only snapshot for inspection and rollback; no consumer/token data. */
export function classPresentation(current) {
  return Object.fromEntries(
    [
      "id",
      "issuerName",
      "programName",
      "programLogo",
      "heroImage",
      "hexBackgroundColor",
      "accountNameLabel",
      "classTemplateInfo",
      "reviewStatus",
    ].map((key) => [key, current[key]]),
  );
}

async function verifyAsset(url) {
  const res = await fetch(url);
  if (
    !res.ok ||
    !res.headers.get("content-type")?.toLowerCase().startsWith("image/png")
  ) {
    throw new Error(`PNG público no disponible: ${url} (${res.status})`);
  }
  await res.body?.cancel();
}

async function main() {
  const inspect = process.argv.includes("--inspect");
  const apply = process.argv.includes("--apply");
  if (inspect === apply)
    throw new Error("Elegí exactamente una operación: --inspect o --apply.");
  const saPath = arg("sa", "GOOGLE_WALLET_SA_JSON_FILE");
  const issuerId = arg("issuer", "GOOGLE_WALLET_ISSUER_ID");
  const logoUrl = arg("logo") ?? LOGO_URL;
  const heroUrl = arg("hero") ?? HERO_URL;
  const suffix = arg("class-suffix") ?? CLASS_SUFFIX;
  if (!/^[A-Za-z0-9_-]+$/.test(suffix))
    throw new Error("--class-suffix inválido");
  if (!issuerId || (!saPath && !process.env.GOOGLE_WALLET_SA_JSON)) {
    throw new Error(
      "Faltan --issuer y --sa (o GOOGLE_WALLET_ISSUER_ID y GOOGLE_WALLET_SA_JSON).",
    );
  }
  if (
    apply &&
    [logoUrl, heroUrl].some((url) => new URL(url).protocol !== "https:")
  ) {
    throw new Error("Las imágenes del pase deben usar HTTPS.");
  }
  const sa = JSON.parse(
    saPath ? readFile(saPath, "utf8") : process.env.GOOGLE_WALLET_SA_JSON,
  );
  if (!sa.client_email || !sa.private_key) {
    throw new Error(
      "El JSON de la service account no tiene client_email/private_key.",
    );
  }
  const token = await accessToken(sa);
  const desired = classBody(issuerId, logoUrl, heroUrl, suffix);
  const url = `${API}/${encodeURIComponent(desired.id)}`;
  const headers = { authorization: `Bearer ${token}` };
  const getRes = await fetch(url, { headers });
  if (inspect) {
    if (!getRes.ok) throw new Error(`get class failed (${getRes.status})`);
    console.log(
      JSON.stringify(classPresentation(await getRes.json()), null, 2),
    );
    return;
  }
  if (!getRes.ok && getRes.status !== 404)
    throw new Error(`get class failed (${getRes.status})`);
  const current = getRes.ok ? await getRes.json() : null;
  const patch = current ? classPatch(current, desired) : null;
  if (current && !patch) {
    console.log(`✓ Loyalty Class sin cambios: ${desired.id}`);
    return;
  }
  await Promise.all([verifyAsset(logoUrl), verifyAsset(heroUrl)]);
  const res = await fetch(current ? url : API, {
    method: current ? "PATCH" : "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify(current ? patch : desired),
  });
  if (!res.ok)
    throw new Error(`${current ? "patch" : "create"} failed (${res.status})`);
  const body = await res.json();
  console.log(
    `✓ Loyalty Class ${current ? "actualizada" : "creada"}: ${body.id} (reviewStatus=${body.reviewStatus})`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exitCode = 1;
  });
}
