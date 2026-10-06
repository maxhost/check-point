/**
 * `node tools/ui-guard.ts` — guardias de UI del merchant (spec 0164, Fase 0c del ADR 0123).
 *
 *   node tools/ui-guard.ts                 # trinquete contra el merge-base con origin/main
 *   node tools/ui-guard.ts --base <ref>    # otra base
 *   node tools/ui-guard.ts --report        # totales de todo el merchant (medida de la Fase 1)
 *
 * Trinquete SIN baseline: por cada archivo cambiado de `apps/merchant/src`, ninguna categoria puede
 * contar mas que en la base (renombrado → la ruta vieja; nuevo → 0). Que cuenta cada categoria:
 * `ui-guard-tsx.ts` (ESLint) y `ui-guard-counts.ts` (clases y CSS).
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  CATEGORIES,
  countCss,
  MERCHANT,
  type Category,
  type Counts,
} from "./ui-guard-counts.ts";
import { countSource } from "./ui-guard-tsx.ts";

/** Lo que mira el guard (rutas relativas a la raiz del repo). */
export function isGuarded(path: string): boolean {
  if (!path.startsWith(MERCHANT) || !/\.(tsx?|css)$/.test(path)) return false;
  const rel = path.slice(MERCHANT.length);
  return !(
    rel.startsWith("ui/") ||
    rel.startsWith("server/") ||
    rel.startsWith("app/api/") ||
    /\.test\.tsx?$/.test(rel)
  );
}

/** ADR 0123 §2: pintan los colores DEL COMERCIO. */
function isStyleExempt(path: string): boolean {
  const rel = path.slice(MERCHANT.length);
  return (
    rel.startsWith("app/backoffice/brand/kit/templates/") ||
    rel.endsWith("/poster-preview.tsx")
  );
}

const STYLE_CATEGORIES: Category[] = [
  "native-style",
  "dangerous-html",
  "raw-palette",
  "arbitrary-value",
  "type-scale",
  "css-color",
];

/** Conteos de un archivo vigilado, sin las categorias exentas por ruta. */
export function countFile(path: string, text: string): Counts {
  const counts = path.endsWith(".css")
    ? countCss(path, text)
    : countSource(path, text);
  if (isStyleExempt(path)) {
    for (const category of STYLE_CATEGORIES) delete counts[category];
  }
  return counts;
}

export type Change = { path: string; basePath: string | null };

/** PURO: `git diff -M --name-status -z` + no seguidos → cambios a comparar (sin borrados). */
export function parseChanges(
  nameStatusZ: string,
  untrackedZ: string,
): Change[] {
  const parts = nameStatusZ.split("\0").filter((p) => p.length > 0);
  const changes: Change[] = [];
  for (let i = 0; i < parts.length; i++) {
    const status = parts[i];
    if (status.startsWith("R") || status.startsWith("C")) {
      const from = parts[++i];
      const to = parts[++i];
      changes.push({
        path: to,
        basePath: status.startsWith("R") ? from : null,
      });
    } else if (status === "D") {
      i++;
    } else {
      const path = parts[++i];
      changes.push({ path, basePath: status === "A" ? null : path });
    }
  }
  for (const path of untrackedZ.split("\0")) {
    if (path.length > 0) changes.push({ path, basePath: null });
  }
  return changes.filter((c) => isGuarded(c.path));
}

export type Violation = {
  path: string;
  category: Category;
  base: number;
  head: number;
  lines: number[];
};

/**
 * PURO: por archivo y categoria, la cabeza no puede contar mas que la base. El «total por categoria
 * ≤ base» del ADR 0123 sale solo: una suma de desigualdades `≤` es `≤`.
 */
export function compare(
  entries: Array<{ path: string; base: Counts; head: Counts }>,
): Violation[] {
  const violations: Violation[] = [];
  for (const { path, base, head } of entries) {
    for (const category of CATEGORIES) {
      const before = base[category]?.length ?? 0;
      const after = head[category]?.length ?? 0;
      if (after > before) {
        violations.push({
          path,
          category,
          base: before,
          head: after,
          lines: head[category] ?? [],
        });
      }
    }
  }
  return violations;
}

/**
 * El entorno de `git` SIN las variables `GIT_*`: dentro de un hook (el pre-push corre `pnpm verify`) git exporta
 * `GIT_DIR`/`GIT_INDEX_FILE`, que le ganan a `cwd`. Heredadas, un `git` lanzado sobre otra carpeta opera sobre el repo
 * del hook: el 2026-10-05 los tests de este guard, corriendo desde el pre-push, hicieron `git init`/`commit`/
 * `checkout` sobre el repo real (`core.bare = true`, un `[user]` falso, la rama del worktree movida). Que decida `cwd`.
 */
export function gitEnv(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );
}

function git(root: string, args: string[]): string {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    env: gitEnv(),
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")}: ${result.stderr.trim()}`);
  }
  return result.stdout;
}

export function runGuard(
  root: string,
  base: string,
): { files: number; violations: Violation[] } {
  const mergeBase = git(root, ["merge-base", base, "HEAD"]).trim();
  const changes = parseChanges(
    git(root, ["diff", "-M", "--name-status", "-z", mergeBase]),
    git(root, ["ls-files", "-z", "--others", "--exclude-standard"]),
  );
  const entries = changes.map(({ path, basePath }) => ({
    path,
    base:
      basePath === null
        ? {}
        : countFile(basePath, git(root, ["show", `${mergeBase}:${basePath}`])),
    head: countFile(path, readFileSync(join(root, path), "utf8")),
  }));
  return { files: changes.length, violations: compare(entries) };
}

/** Totales de todo el merchant vigilado (arbol de trabajo). */
export function reportAll(root: string): string {
  const files = [
    ...new Set(
      git(root, [
        "ls-files",
        "-z",
        "--cached",
        "--others",
        "--exclude-standard",
        "--",
        MERCHANT,
      ])
        .split("\0")
        .filter((p) => p.length > 0 && isGuarded(p)),
    ),
  ];
  const totals = new Map<Category, number>();
  const perFile: Array<[string, number]> = [];
  for (const path of files) {
    let text: string;
    try {
      text = readFileSync(join(root, path), "utf8");
    } catch {
      continue; // borrado en el arbol de trabajo
    }
    const counts = countFile(path, text);
    let sum = 0;
    for (const category of CATEGORIES) {
      const n = counts[category]?.length ?? 0;
      totals.set(category, (totals.get(category) ?? 0) + n);
      sum += n;
    }
    if (sum > 0) perFile.push([path, sum]);
  }
  const lines = [`ui-guard --report: ${files.length} archivos`, ""];
  for (const category of CATEGORIES) {
    lines.push(`${category.padEnd(18)} ${totals.get(category) ?? 0}`);
  }
  lines.push("", "archivos con mas conteo:");
  perFile.sort((a, b) => b[1] - a[1]);
  for (const [path, n] of perFile.slice(0, 10)) {
    lines.push(`  ${String(n).padStart(5)}  ${path}`);
  }
  return lines.join("\n");
}

function main(argv: string[]): number {
  const root = join(import.meta.dirname, "..");
  if (argv.includes("--report")) {
    console.log(reportAll(root));
    return 0;
  }
  const i = argv.indexOf("--base");
  const base = i >= 0 ? argv[i + 1] : "origin/main";
  const { files, violations } = runGuard(root, base);
  if (violations.length === 0) {
    console.log(`ui-guard: ${files} archivos, sin aumentos`);
    return 0;
  }
  console.log(
    `ui-guard: ROJO — ${violations.length} aumento(s) contra ${base} (ADR 0123; docs/design-system.md §Guardia)\n`,
  );
  for (const v of violations) {
    console.log(`${v.path}  ${v.category}  ${v.base} → ${v.head}`);
    for (const line of v.lines) console.log(`    ${v.path}:${line}`);
  }
  return 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = main(process.argv.slice(2));
}
