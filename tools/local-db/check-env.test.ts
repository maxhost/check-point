import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

/**
 * Spec 0168: el candado de origenes de `check-env.ts` (ningun `*ORIGIN`/`*ORIGINS`/`*_URL` de las apps
 * apunta a PROD; merchant y consumer apuntan al tunel). Corre el script real contra un arbol temporal
 * (`CHECK_ENV_ROOT`) con `.env` FICTICIOS. El `local.ts` del arbol trae la huella de un endpoint
 * ficticio en vez del de PROD: con el real, el chequeo de `.env.prod.local` no podria pasar sin la URL de PROD.
 */
const SCRIPT = join(__dirname, "check-env.ts");
const tmp = mkdtempSync(join(tmpdir(), "check-env-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const sha12 = (v: string) =>
  createHash("sha256").update(v).digest("hex").slice(0, 12);
const PROD_FALSO = "ep-prod-falso-123";
const CENTINELA = "centinela-7f3a9c-no-debe-salir";

const R2 = {
  R2_ACCOUNT_ID: "cuenta",
  R2_BUCKET: "bucket-dev",
  R2_ENDPOINT: "https://cuenta.r2.cloudflarestorage.com",
  R2_REGION: "auto",
  R2_ACCESS_KEY_ID: "id",
  R2_SECRET_ACCESS_KEY: "secreto",
};
const LOCAL_DB =
  "postgresql://neondb_owner:local-solo-dev@db.localtest.me:5432/neondb";
const MERCHANT = {
  DATABASE_URL: LOCAL_DB,
  ...R2,
  EMAIL_PROVIDER: "console",
  BETTER_AUTH_URL: "https://dev-business.checkpass.club",
  CONSUMER_ORIGIN: "https://dev-my.checkpass.club",
  BETTER_AUTH_TRUSTED_ORIGINS: `https://dev-business.checkpass.club,https://${CENTINELA}.example.com`,
};
const CONSUMER = {
  DATABASE_URL: LOCAL_DB,
  ...R2,
  WALLET_PROVIDER: "fake",
  CONSUMER_ORIGIN: "https://dev-my.checkpass.club",
};

type Env = Record<string, string | undefined>;
function correr(merchant: Env, consumer: Env = CONSUMER) {
  const root = mkdtempSync(join(tmp, "raiz-"));
  const escribir = (rel: string, contenido: string) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), contenido);
  };
  const env = (vars: Env) =>
    Object.entries(vars)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n";
  escribir(
    "packages/db/src/local.ts",
    `export const PROD_DB_ENDPOINT_SHA12 = "${sha12(PROD_FALSO)}";\n`,
  );
  escribir("tools/local-db/.env.r2-dev", env(R2));
  escribir("apps/merchant/.env.local", env(merchant));
  escribir("apps/consumer/.env.local", env(consumer));
  escribir(
    "packages/db/.env.prod.local",
    env({
      DATABASE_URL_UNPOOLED: `postgresql://u:p@${PROD_FALSO}.c-1.us-east-2.aws.neon.tech/neondb`,
    }),
  );
  const r = spawnSync(process.execPath, [SCRIPT], {
    encoding: "utf8",
    env: { ...process.env, CHECK_ENV_ROOT: root },
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

describe("check-env.ts: origenes de las apps (spec 0168)", () => {
  it("(a) todo apuntando al tunel → exit 0", () => {
    const r = correr(MERCHANT);
    expect(r.out).not.toMatch(/^MAL/m);
    expect(r.code).toBe(0);
  });

  it("(b) merchant BETTER_AUTH_URL de PROD → exit 1", () => {
    const r = correr({
      ...MERCHANT,
      BETTER_AUTH_URL: "https://business.checkpass.club",
    });
    expect(r.out).toMatch(
      /^MAL .*apps\/merchant\/\.env\.local BETTER_AUTH_URL no apunta a PROD$/m,
    );
    expect(r.code).toBe(1);
  });

  it("(c) merchant sin CONSUMER_ORIGIN (el rewrite caeria a PROD) → exit 1", () => {
    const r = correr({ ...MERCHANT, CONSUMER_ORIGIN: undefined });
    expect(r.out).toMatch(
      /^MAL .*apps\/merchant\/\.env\.local CONSUMER_ORIGIN = /m,
    );
    expect(r.code).toBe(1);
  });

  it("(d) PROD como SEGUNDO elemento de una lista → exit 1", () => {
    const r = correr({
      ...MERCHANT,
      BETTER_AUTH_TRUSTED_ORIGINS:
        "https://dev-business.checkpass.club,https://www.checkpass.club",
    });
    expect(r.out).toMatch(
      /^MAL .*BETTER_AUTH_TRUSTED_ORIGINS no apunta a PROD$/m,
    );
    expect(r.code).toBe(1);
  });

  it("(e) la salida nunca contiene un valor sembrado", () => {
    const bien = correr(MERCHANT);
    const mal = correr({
      ...MERCHANT,
      BETTER_AUTH_TRUSTED_ORIGINS: `https://www.checkpass.club,https://${CENTINELA}.example.com`,
    });
    expect(mal.code).toBe(1);
    for (const r of [bien, mal]) expect(r.out).not.toContain(CENTINELA);
  });
});
