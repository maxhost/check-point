/**
 * `pnpm verify` — los gates segun lo que cambio (spec 0133 / ADR 0113).
 *
 *   pnpm verify                         # cambiados contra origin/main (commits + arbol + sin seguimiento)
 *   pnpm verify --base <ref>            # otra base
 *   pnpm verify --files a.ts,b.tsx      # reemplaza el calculo de cambiados (pruebas)
 *   pnpm verify --full                  # todo, incluida la suite Neon entera
 *   pnpm verify --dry-run               # solo imprime el plan
 *
 * Solo docs (spec 0135): si TODO lo cambiado es `docs/**` o un `.md` de la raiz, corre SOLO
 * `format:check`.
 * Si no: typecheck, lint, ui-guard (si se toco `apps/merchant/src`, spec 0164), format:check, test
 * (unit), build. Despues e2e si se toco UI, y Neon:
 * selectivo (`vitest related`) si se toco servidor o `packages/domain`; completo ante lo que el
 * grafo de imports no ve (esquema, SQL, configuracion, lockfile, el propio `neon-test.sh`).
 * NO corta en el primer rojo: corre todo lo planeado y al final imprime la tabla.
 *
 * No imprime credenciales: las maneja `tools/neon-test.sh`, que solo imprime claves y largos.
 *
 * Autocontenido a proposito (Node 24 corre `.ts` quitando los tipos, pero no resuelve imports
 * sin extension de la app), igual que `tools/google-wallet-callback.ts`.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export type NeonMode = "none" | "related" | "full";

export type VerifyPlan = {
  docsOnly: boolean;
  e2e: boolean;
  uiGuard: boolean;
  neon: { mode: NeonMode; merchant: string[]; consumer: string[] };
  reasons: string[];
};

const basename = (file: string) => file.slice(file.lastIndexOf("/") + 1);

/** Docs: `docs/**` o un `.md` de la raiz (`AGENTS.md`, `CLAUDE.md`, `README.md`). */
function isDoc(file: string): boolean {
  return (
    file.startsWith("docs/") || (!file.includes("/") && file.endsWith(".md"))
  );
}

/** Lo que el grafo de imports no ve: Neon completo (y e2e). */
function isFullTrigger(file: string): boolean {
  const name = basename(file);
  return (
    file.startsWith("packages/db/") ||
    file.endsWith(".sql") ||
    name.startsWith("drizzle.config.") ||
    name.startsWith("vitest.config.") ||
    file.startsWith("vitest.workspace.") ||
    name === "package.json" ||
    file === "pnpm-lock.yaml" ||
    file === "pnpm-workspace.yaml" ||
    file === "tools/neon-test.sh"
  );
}

/** UI: pantallas fuera de `app/api/`, CSS, `public/`, e2e y config de Playwright. */
function isE2eTrigger(file: string): boolean {
  return (
    (/^apps\/[^/]+\/src\/app\//.test(file) &&
      !/^apps\/[^/]+\/src\/app\/api\//.test(file)) ||
    file.endsWith(".css") ||
    /^apps\/[^/]+\/public\//.test(file) ||
    file.startsWith("tests/e2e/") ||
    file.startsWith("playwright.config.")
  );
}

/** Las apps cuyas suites Neon pueden importar `file` (solo `.ts`/`.tsx`). */
function relatedApps(file: string): Array<"merchant" | "consumer"> {
  if (!/\.tsx?$/.test(file)) return [];
  if (file.startsWith("apps/merchant/src/")) return ["merchant"];
  if (file.startsWith("apps/consumer/src/")) return ["consumer"];
  if (file.startsWith("packages/domain/")) return ["merchant", "consumer"];
  return [];
}

/** PURO: que gates extra corren para `files` (rutas relativas a la raiz del repo). */
export function planVerify(files: string[]): VerifyPlan {
  const reasons: string[] = [];
  const docsOnly = files.length > 0 && files.every(isDoc);
  if (docsOnly) reasons.push("solo docs: solo format:check");
  const uiGuard = files.some((f) => f.startsWith("apps/merchant/src/"));
  const full = files.filter(isFullTrigger);
  const e2eFiles = files.filter(isE2eTrigger);
  for (const file of full) reasons.push(`neon full: ${file}`);
  for (const file of e2eFiles) reasons.push(`e2e: ${file}`);
  if (full.length > 0) {
    if (e2eFiles.length === 0) reasons.push("e2e: implicado por neon full");
    return {
      docsOnly,
      e2e: true,
      uiGuard,
      neon: { mode: "full", merchant: [], consumer: [] },
      reasons,
    };
  }
  const merchant: string[] = [];
  const consumer: string[] = [];
  for (const file of files) {
    for (const app of relatedApps(file)) {
      (app === "merchant" ? merchant : consumer).push(file);
      reasons.push(`neon related ${app}: ${file}`);
    }
  }
  const mode: NeonMode =
    merchant.length + consumer.length > 0 ? "related" : "none";
  return {
    docsOnly,
    e2e: e2eFiles.length > 0,
    uiGuard,
    neon: { mode, merchant, consumer },
    reasons,
  };
}

const ROOT = join(import.meta.dirname, "..");

function git(args: string[]): string[] {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")}: ${result.stderr.trim()}`);
  }
  return result.stdout.split("\n").filter((line) => line.length > 0);
}

function changedFiles(base: string): string[] {
  const mergeBase = git(["merge-base", base, "HEAD"])[0];
  const all = [
    ...git(["diff", "--name-only", mergeBase]),
    ...git(["diff", "--name-only", "HEAD"]),
    ...git([
      "ls-files",
      "--others",
      "--exclude-standard",
      "--",
      ".",
      ":!.pnpm-store",
    ]),
  ];
  return [...new Set(all)].filter((f) => !f.startsWith(".pnpm-store/"));
}

type Gate = { name: string; cmd: string[]; skip?: string };
type Result = { name: string; ran: string; status: string; seconds: string };

function gates(plan: VerifyPlan, base: string): Gate[] {
  const list: Gate[] = [
    "typecheck",
    "lint",
    "format:check",
    "test",
    "build",
  ].map((script) => ({
    name: script,
    cmd: ["pnpm", "run", script],
    skip: plan.docsOnly && script !== "format:check" ? "solo docs" : undefined,
  }));
  list.splice(2, 0, {
    name: "ui-guard",
    cmd: ["node", "tools/ui-guard.ts", "--base", base],
    skip: plan.docsOnly
      ? "solo docs"
      : plan.uiGuard
        ? undefined
        : "no se toco el merchant",
  });
  list.push({
    name: "test:e2e",
    cmd: ["pnpm", "run", "test:e2e"],
    skip: plan.e2e ? undefined : plan.docsOnly ? "solo docs" : "no se toco UI",
  });
  const neon = join(ROOT, "tools/neon-test.sh");
  if (plan.neon.mode === "full") {
    // Sin archivos, `neon-test.sh` corre `pnpm run test` de root: TODOS los projects,
    // consumer incluido. Una segunda corrida `--app consumer` repetiria la suite entera.
    list.push({ name: "neon (full)", cmd: [neon] });
  } else {
    for (const app of ["merchant", "consumer"] as const) {
      // Un archivo borrado no tiene grafo: `vitest related` solo recibe los que existen.
      const files = plan.neon[app]
        .map((f) => join(ROOT, f))
        .filter((f) => existsSync(f));
      list.push({
        name: `neon related ${app}`,
        cmd: [neon, "--app", app, "--related", ...files],
        skip:
          files.length === 0
            ? plan.docsOnly
              ? "solo docs"
              : plan.neon.mode === "none"
                ? "no se toco servidor"
                : plan.neon[app].length > 0
                  ? `los archivos de ${app} ya no existen`
                  : `nada de ${app}`
            : undefined,
      });
    }
  }
  return list;
}

function run(gate: Gate): Result {
  if (gate.skip) {
    return {
      name: gate.name,
      ran: `salteado (${gate.skip})`,
      status: "-",
      seconds: "-",
    };
  }
  console.log(
    `\n=== ${gate.name}: ${gate.cmd.map((c) => c.replace(ROOT + "/", "")).join(" ")}`,
  );
  const start = Date.now();
  const result = spawnSync(gate.cmd[0], gate.cmd.slice(1), {
    cwd: ROOT,
    stdio: "inherit",
  });
  const seconds = ((Date.now() - start) / 1000).toFixed(1);
  return {
    name: gate.name,
    ran: "corrio",
    status: result.status === 0 ? "ok" : "ROJO",
    seconds,
  };
}

function table(results: Result[]): string {
  const rows = [["gate", "corrio/salteado (motivo)", "ok/ROJO", "segundos"]];
  for (const r of results) rows.push([r.name, r.ran, r.status, r.seconds]);
  const widths = rows[0].map((_, i) =>
    Math.max(...rows.map((row) => row[i].length)),
  );
  return rows
    .map((row) => row.map((cell, i) => cell.padEnd(widths[i])).join(" | "))
    .join("\n");
}

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function main(argv: string[]): number {
  const filesArg = flag(argv, "--files");
  const base = flag(argv, "--base") ?? "origin/main";
  const files = filesArg
    ? filesArg
        .split(",")
        .map((f) => f.trim())
        .filter((f) => f.length > 0)
    : changedFiles(base);
  const plan: VerifyPlan = argv.includes("--full")
    ? {
        docsOnly: false,
        e2e: true,
        uiGuard: true,
        neon: { mode: "full", merchant: [], consumer: [] },
        reasons: ["--full"],
      }
    : planVerify(files);

  console.log(
    `archivos cambiados (${files.length}${filesArg ? ", de --files" : `, contra ${base}`}):`,
  );
  for (const f of files) console.log(`  ${f}`);
  console.log(
    `plan: docsOnly=${plan.docsOnly} e2e=${plan.e2e} uiGuard=${plan.uiGuard} neon=${plan.neon.mode}`,
  );
  for (const reason of plan.reasons) console.log(`  - ${reason}`);
  const list = gates(plan, base);
  if (argv.includes("--dry-run")) {
    for (const g of list) {
      console.log(
        `  ${g.skip ? `[salteado: ${g.skip}]` : "[corre]"} ${g.name}`,
      );
    }
    return 0;
  }

  const results = list.map(run);
  console.log(`\n${table(results)}`);
  const red = results.some((r) => r.status === "ROJO");
  console.log(red ? "\nverify: ROJO" : "\nverify: ok");
  return red ? 1 : 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = main(process.argv.slice(2));
}
