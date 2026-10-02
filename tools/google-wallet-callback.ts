/**
 * Configura `callbackOptions.url` en la clase de Google Wallet (spec 0107 §4 / ADR 0099 §2):
 * sin eso Google nunca avisa el `save` y en Android no hay regalo de bienvenida.
 *
 *   GOOGLE_WALLET_ISSUER_ID=… node tools/google-wallet-callback.ts <url>            # dry-run
 *   GOOGLE_WALLET_ISSUER_ID=… GOOGLE_WALLET_SA_JSON=… \
 *     node tools/google-wallet-callback.ts <url> --apply                            # aplica
 *
 * <url> = `https://my.checkpass.club/api/public/wallet/google/callback` (la ruta vive en la app
 * del cliente; host exacto: Google no sigue redirecciones de callback).
 *
 * El PATCH lleva `reviewStatus: "UNDER_REVIEW"`: Google rechaza editar una clase aprobada sin
 * eso (HTTP 400 `Invalid review status "APPROVED"`) y la re-aprueba sola (spec 0128).
 *
 * POR DEFECTO ES DRY-RUN: imprime la clase y el PATCH que haria, sin credenciales ni red.
 * Con `--apply` usa la MISMA service account que emite el pase, lee la clase y solo hace
 * PATCH si la url es otra (idempotente). NUNCA imprime la service account ni el token.
 * Lo corre el orquestador, con OK del owner, despues del deploy de la E3.
 *
 * Autocontenido a proposito (Node 24 corre `.ts` quitando los tipos, pero no resuelve los
 * imports sin extension de la app): la clase replica `GOOGLE_CLASS_SUFFIX` y su test la
 * compara con la de la app (`google-wallet-callback.test.ts`).
 */

import { createSign } from "node:crypto";
import { pathToFileURL } from "node:url";

export const CLASS_SUFFIX = "mipasaporte_identity";
const API =
  "https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass";

export function classIdOf(issuerId: string): string {
  return `${issuerId}.${CLASS_SUFFIX}`;
}

type ClassCallback = { callbackOptions?: { url?: string } } | null;

/** PURO: `noop` si la clase ya apunta a `url`; si no, el cuerpo del PATCH. */
export function planCallback(
  current: ClassCallback,
  url: string,
):
  | { action: "noop" }
  | {
      action: "patch";
      body: { callbackOptions: { url: string }; reviewStatus: "UNDER_REVIEW" };
    } {
  if (current?.callbackOptions?.url === url) return { action: "noop" };
  return {
    action: "patch",
    body: { callbackOptions: { url }, reviewStatus: "UNDER_REVIEW" },
  };
}

/** El `error.message` del cuerpo de Google, si es JSON; nunca credenciales (no las trae). */
async function googleError(response: Response): Promise<string> {
  try {
    const json = (await response.json()) as { error?: { message?: unknown } };
    const message = json?.error?.message;
    return typeof message === "string" ? ` — ${message}` : "";
  } catch {
    return "";
  }
}

async function accessToken(sa: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const b64 = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const input = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/wallet_object.issuer",
    aud: "https://oauth2.googleapis.com/token",
    iat,
    exp: iat + 3600,
  })}`;
  const signature = createSign("RSA-SHA256")
    .update(input)
    .sign(sa.private_key)
    .toString("base64url");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${input}.${signature}`,
    }),
  });
  if (!response.ok) throw new Error(`token: HTTP ${response.status}`);
  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("token: sin access_token");
  return json.access_token;
}

async function main(argv: string[]): Promise<number> {
  const url = argv.find((arg) => !arg.startsWith("--"));
  const apply = argv.includes("--apply");
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  if (!url || !url.startsWith("https://") || !issuerId) {
    console.error(
      "uso: GOOGLE_WALLET_ISSUER_ID=… node tools/google-wallet-callback.ts <https-url> [--apply]",
    );
    return 1;
  }
  const classId = classIdOf(issuerId);
  const endpoint = `${API}/${encodeURIComponent(classId)}`;
  if (!apply) {
    console.log(`[dry-run] clase: ${classId}`);
    console.log(`[dry-run] GET ${endpoint}`);
    console.log(
      `[dry-run] PATCH ${endpoint} ${JSON.stringify(planCallback(null, url))}`,
    );
    console.log("[dry-run] nada enviado. Agregá --apply para aplicarlo.");
    return 0;
  }
  const raw = process.env.GOOGLE_WALLET_SA_JSON;
  if (!raw) {
    console.error("falta GOOGLE_WALLET_SA_JSON (solo se necesita con --apply)");
    return 1;
  }
  const token = await accessToken(JSON.parse(raw));
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
  const current = await fetch(endpoint, { headers });
  if (!current.ok) {
    console.error(
      `GET clase: HTTP ${current.status}${await googleError(current)}`,
    );
    return 1;
  }
  const plan = planCallback((await current.json()) as ClassCallback, url);
  if (plan.action === "noop") {
    console.log(`sin cambios: ${classId} ya apunta a ${url}`);
    return 0;
  }
  const patched = await fetch(endpoint, {
    method: "PATCH",
    headers,
    body: JSON.stringify(plan.body),
  });
  if (!patched.ok) {
    console.error(
      `PATCH ${classId}: HTTP ${patched.status}${await googleError(patched)}`,
    );
    return 1;
  }
  console.log(`PATCH ${classId}: HTTP ${patched.status}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    },
  );
