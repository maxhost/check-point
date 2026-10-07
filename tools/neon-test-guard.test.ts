import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
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
writeFileSync(pnpmFalso, '#!/bin/sh\necho "PNPM LLAMADO: $*"\nexit 0\n');
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
