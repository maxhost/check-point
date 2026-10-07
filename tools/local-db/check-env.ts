/**
 * `node tools/local-db/check-env.ts` — verifica que los `.env` locales quedaron como pide la spec 0167 §7,
 * imprimiendo SOLO claves, largos y veredictos. Nunca un valor ni un prefijo (CLAUDE.md §Verificacion).
 *
 * Exit 0 si: ninguna `DATABASE_URL*` de las apps es PROD, las dos apps usan la base local, las 6 claves R2
 * coinciden con `tools/local-db/.env.r2-dev`, y `packages/db/.env.prod.local` tiene la URL directa de PROD.
 * Spec 0168: ningun origen (`*ORIGIN`, `*ORIGINS`, `*_URL`) de las apps apunta a PROD, y los del tunel
 * (`dev-business.` / `dev-my.`) estan donde el codigo cae a PROD si faltan. `CHECK_ENV_ROOT` cambia la raiz (test).
 * Autocontenido (Node 24 corre `.ts` quitando tipos, sin resolver imports del repo).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const ROOT =
  process.env.CHECK_ENV_ROOT ??
  join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PROD_HOSTS = new Set([
  "checkpass.club",
  "www.checkpass.club",
  "business.checkpass.club",
  "my.checkpass.club",
]);
const TUNNEL_MERCHANT = "https://dev-business.checkpass.club";
const TUNNEL_CONSUMER = "https://dev-my.checkpass.club";
const LOCAL_HOSTS = new Set(["db.localtest.me", "localhost", "127.0.0.1"]);
const R2_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_BUCKET",
  "R2_ENDPOINT",
  "R2_REGION",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
];
const PROD_SHA12 = /PROD_DB_ENDPOINT_SHA12 = "([0-9a-f]{12})"/.exec(
  readFileSync(join(ROOT, "packages/db/src/local.ts"), "utf8"),
)?.[1];

const sha12 = (v: string) =>
  createHash("sha256").update(v).digest("hex").slice(0, 12);
function host(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}
function endpointSha(url: string): string | null {
  let id = host(url)?.split(".")[0];
  if (!id) return null;
  for (let next = id; ; id = next) {
    next = id.replace(/-(pooler|rvr)$/, "");
    if (next === id) break;
  }
  return sha12(id);
}
function load(rel: string): Record<string, string> | null {
  const file = join(ROOT, rel);
  return existsSync(file)
    ? (parseEnv(readFileSync(file, "utf8")) as Record<string, string>)
    : null;
}

let failures = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? "ok  " : "MAL "} ${msg}`);
  if (!ok) failures++;
};

if (!PROD_SHA12)
  throw new Error(
    "no pude leer PROD_DB_ENDPOINT_SHA12 de packages/db/src/local.ts",
  );
const r2 = load("tools/local-db/.env.r2-dev");
check(
  !!r2 && R2_KEYS.every((k) => r2[k]),
  "tools/local-db/.env.r2-dev tiene las 6 claves R2",
);

for (const app of ["apps/merchant/.env.local", "apps/consumer/.env.local"]) {
  const env = load(app);
  if (!env) {
    check(false, `${app} existe`);
    continue;
  }
  for (const [k, v] of Object.entries(env))
    if (/DATABASE_URL/.test(k) && v)
      check(endpointSha(v) !== PROD_SHA12, `${app} ${k} no es PROD`);
  for (const [k, v] of Object.entries(env))
    if (/(ORIGIN|ORIGINS|_URL)$/.test(k) && !/DATABASE/.test(k))
      check(
        v.split(",").every((o) => {
          const h = host(o.trim());
          return h !== null && !PROD_HOSTS.has(h);
        }),
        `${app} ${k} no apunta a PROD`,
      );
  check(
    LOCAL_HOSTS.has(host(env.DATABASE_URL ?? "") ?? ""),
    `${app} DATABASE_URL es la base local`,
  );
  for (const k of R2_KEYS)
    check(
      !!r2 && env[k] === r2[k],
      `${app} ${k} = el de .env.r2-dev (largo ${env[k]?.length ?? 0})`,
    );
  if (app.includes("merchant")) {
    check(env.EMAIL_PROVIDER === "console", `${app} EMAIL_PROVIDER=console`);
    check(
      env.BETTER_AUTH_URL === TUNNEL_MERCHANT,
      `${app} BETTER_AUTH_URL = ${TUNNEL_MERCHANT}`,
    );
    // Sin ella el rewrite de `/api/public/*` cae a PROD (`apps/merchant/next.config.ts`).
    check(
      env.CONSUMER_ORIGIN === TUNNEL_CONSUMER,
      `${app} CONSUMER_ORIGIN = ${TUNNEL_CONSUMER}`,
    );
  }
  if (app.includes("consumer")) {
    check(env.WALLET_PROVIDER === "fake", `${app} WALLET_PROVIDER=fake`);
    check(
      env.CONSUMER_ORIGIN === TUNNEL_CONSUMER,
      `${app} CONSUMER_ORIGIN = ${TUNNEL_CONSUMER}`,
    );
    for (const k of [
      "APPLE_PASS_CERT_P12",
      "APPLE_WWDR_CERT",
      "GOOGLE_WALLET_SA_JSON",
      "APPLE_APNS_KEY_P8",
    ])
      check(!env[k], `${app} sin ${k}`);
    for (const k of Object.keys(env))
      if (/^(CLICKSEND_|TWILIO_|OTP_PROVIDER$)/.test(k))
        check(false, `${app} sin ${k}`);
  }
}

const prod = load("packages/db/.env.prod.local");
const prodUrl = prod?.DATABASE_URL_UNPOOLED ?? "";
check(
  endpointSha(prodUrl) === PROD_SHA12,
  "packages/db/.env.prod.local DATABASE_URL_UNPOOLED es PROD",
);
check(
  !!prodUrl && !(host(prodUrl) ?? "").includes("-pooler"),
  "packages/db/.env.prod.local usa el host directo",
);

console.log(
  failures
    ? `${failures} chequeo(s) MAL`
    : "ok: variables locales como piden las specs 0167 y 0168",
);
process.exitCode = failures ? 1 : 0;
