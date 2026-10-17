import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

/**
 * Spec 0167: el candado de `tools/neon-test.sh` contra PROD es una copia en bash de
 * `neonEndpointId` (`packages/db/src/local.ts`) y no tenia test (la revision lo mostro quitando el
 * recorte de `-rvr`: 112 tests seguian verdes). Se prueba con un endpoint FICTICIO sumado como
 * bloqueado (`NEON_TEST_EXTRA_BLOCKED_SHA12`) y un `pnpm` falso en el PATH: nunca se conecta a nada.
 */
const ROOT = join(__dirname, "..");
const tmp = mkdtempSync(join(tmpdir(), "neon-test-guard-"));
const bin = join(tmp, "bin");
const pnpmFalso = join(bin, "pnpm");
mkdirSync(bin);
writeFileSync(
  pnpmFalso,
  `#!/bin/sh
node --input-type=module -e 'import { statSync } from "node:fs"; console.log("ENV MODE: " + (statSync(process.env.NEON_TEST_ENV_FILE).mode & 0o777).toString(8));'
echo "PNPM LLAMADO: $*"
if [ "\${NEON_TEST_FAKE_FAIL:-}" = "true" ] && [ "$*" != "db:migrate" ]; then exit 17; fi
exit 0
`,
);
chmodSync(pnpmFalso, 0o755);
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const BLOQUEADO = "ep-x-y-123";
const sha12 = (v: string) =>
  createHash("sha256").update(v).digest("hex").slice(0, 12);
const url = (host: string) =>
  `postgresql://u:p@${host}.c-1.us-east-2.aws.neon.tech/neondb?sslmode=require`;

function correr(vars: Record<string, string>) {
  const envFile = join(tmp, `ci-${Math.random().toString(36).slice(2)}.env`);
  writeFileSync(
    envFile,
    Object.entries(vars)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n",
  );
  const r = spawnSync("bash", [join(ROOT, "tools/neon-test.sh")], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      NEON_TEST_ENV_FILE: envFile,
      NEON_TEST_EXTRA_BLOCKED_SHA12: sha12(BLOQUEADO),
    },
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

const LIBRE = url("ep-otro-456");
const LOCAL =
  "postgresql://neondb_owner:local-solo-dev@db.localtest.me:5432/neondb";

describe("neon-test.sh: candado contra el endpoint bloqueado", () => {
  it("control: con la rama libre llega a pnpm", () => {
    const r = correr({
      NEON_CI_DATABASE_URL: LIBRE,
      NEON_CI_DATABASE_URL_UNPOOLED: LIBRE,
      DATABASE_URL: LOCAL,
    });
    expect(r.out).toContain("PNPM LLAMADO: db:migrate");
    expect(r.out).toContain(
      "PNPM LLAMADO: exec vitest run --exclude **/*migration*.neon.integration.test.ts",
    );
    expect(r.out).toContain("pos-migration-0079.neon.integration.test.ts");
    expect(r.out).toContain("--no-file-parallelism");
    const commands = r.out
      .split("\n")
      .filter((line) => line.startsWith("PNPM LLAMADO: exec vitest run"));
    expect(commands).toHaveLength(2);
    const injection =
      "apps/merchant/src/modules/pos/server/business-failures.neon.integration.test.ts";
    expect(commands[0]).toContain(
      "--exclude **/business-failures.neon.integration.test.ts",
    );
    expect(commands[0]).not.toContain("--no-file-parallelism");
    expect(commands[1]).toContain(injection);
    expect(commands[1]).not.toContain("--exclude");
    expect(commands[1]).not.toContain(
      "stock/stock-consumption.neon.integration.test.ts",
    );
    expect(r.code).toBe(0);
  });

  const variantes = [
    BLOQUEADO,
    `${BLOQUEADO}-pooler`,
    `${BLOQUEADO}-rvr`,
    `${BLOQUEADO}-rvr-pooler`,
    `${BLOQUEADO}-POOLER`.toUpperCase(),
  ];
  for (const host of variantes)
    for (const clave of [
      "NEON_CI_DATABASE_URL",
      "NEON_CI_DATABASE_URL_UNPOOLED",
      "NEON_CI_CONSUMER_DATABASE_URL",
    ])
      it(`aborta con ${host} en ${clave}`, () => {
        const r = correr({
          NEON_CI_DATABASE_URL: LIBRE,
          NEON_CI_DATABASE_URL_UNPOOLED: LIBRE,
          DATABASE_URL: LOCAL,
          [clave]: url(host),
        });
        expect(r.out).toContain(`ABORTADO: ${clave} apunta a la rama de PROD`);
        expect(r.out).not.toContain("PNPM LLAMADO");
        expect(r.code).toBe(1);
      });

  for (const comillas of ['"', "'"])
    it(`aborta con el valor entre comillas ${comillas}`, () => {
      const r = correr({
        NEON_CI_DATABASE_URL: `${comillas}${url(`${BLOQUEADO}-pooler`)}${comillas}`,
        NEON_CI_DATABASE_URL_UNPOOLED: LIBRE,
      });
      expect(r.out).toContain(
        "ABORTADO: NEON_CI_DATABASE_URL apunta a la rama de PROD",
      );
      expect(r.out).not.toContain("PNPM LLAMADO");
      expect(r.code).toBe(1);
    });

  it("falla cerrado si no reconoce el endpoint de Neon", () => {
    const r = correr({
      NEON_CI_DATABASE_URL: "esto-no-es-una-url",
      NEON_CI_DATABASE_URL_UNPOOLED: LIBRE,
    });
    expect(r.out).toContain(
      "ABORTADO: no reconozco el endpoint de Neon de NEON_CI_DATABASE_URL",
    );
    expect(r.out).not.toContain("esto-no-es-una-url");
    expect(r.out).not.toContain("PNPM LLAMADO");
    expect(r.code).toBe(1);
  });
});

describe("CI uses the guarded wrapper and ephemeral private credentials", () => {
  const workflow = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");
  const block = workflow
    .split("- name: Unit + integracion Neon\n")[1]
    .split("      # Los browsers")[0];
  const script = block
    .split("        run: |\n")[1]
    .split("\n")
    .map((line) => (line.startsWith("          ") ? line.slice(10) : line))
    .join("\n");
  it.each([false, true])(
    "runs both isolated phases and cleans the env file, failure=%s",
    (fail) => {
      const runnerTemp = mkdtempSync(join(tmp, "runner-"));
      const env = Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
      );
      const result = spawnSync("bash", ["-c", script], {
        cwd: ROOT,
        encoding: "utf8",
        env: {
          ...env,
          PATH: `${bin}:${process.env.PATH}`,
          RUNNER_TEMP: runnerTemp,
          NEON_CI_DATABASE_URL: LIBRE,
          NEON_CI_DATABASE_URL_UNPOOLED: LIBRE,
          NEON_CI_CONSUMER_DATABASE_URL: LIBRE,
          NEON_TEST_FAKE_FAIL: String(fail),
          NEON_TEST_EXTRA_BLOCKED_SHA12: sha12(BLOQUEADO),
        },
      });
      const output = `${result.stdout}${result.stderr}`;
      expect(output).not.toContain(LIBRE);
      expect(output).toContain("ENV MODE: 600");
      expect(result.status).toBe(fail ? 17 : 0);
      expect(readdirSync(runnerTemp)).toEqual([]);
      if (!fail) {
        expect(output).toContain(
          "--exclude **/*migration*.neon.integration.test.ts",
        );
        expect(output).toContain("business-failures.neon.integration.test.ts");
        expect(output).toContain("--no-file-parallelism");
      }
    },
  );
});
