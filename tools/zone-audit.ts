/**
 * `node tools/zone-audit.ts` — al arrancar la sesion de Claude (hook `SessionStart`, spec 0164).
 *
 * El kit, el lint y las guardias de UI son zona de Claude (ADR 0123, decision 3). Nada impide que otro
 * los edite: esto lo DETECTA. Lista los commits de `origin/main` desde que existe `tools/ui-guard.ts`
 * que tocan esos archivos sin el trailer `Co-Authored-By: Claude`. Exit 0 siempre.
 */

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const CLAUDE_ZONE = [
  "apps/merchant/src/ui/",
  "eslint.config.mjs",
  "tools/ui-guard.ts",
  "tools/ui-guard-counts.ts",
  "tools/ui-guard-tsx.ts",
  "tools/ui-guard.test.ts",
  "tools/ui-guard-rules.test.ts",
  "tools/zone-audit.ts",
  "tools/zone-audit.test.ts",
];

export type Commit = {
  sha: string;
  subject: string;
  body: string;
  files: string[];
};

/** PURO: los commits sin trailer de Claude, con los archivos de su zona que tocan. */
export function offenders(commits: Commit[]): string[] {
  return commits
    .filter((c) => !/^Co-Authored-By: Claude/im.test(c.body))
    .map((c) => {
      const touched = c.files.filter((f) =>
        CLAUDE_ZONE.some((z) => (z.endsWith("/") ? f.startsWith(z) : f === z)),
      );
      return { c, touched };
    })
    .filter(({ touched }) => touched.length > 0)
    .map(
      ({ c, touched }) =>
        `AVISO zona Claude: ${c.sha.slice(0, 7)} ${c.subject} (${touched.join(", ")}) — avisale al owner`,
    );
}

function git(root: string, args: string[]): string | null {
  // Sin `GIT_*` heredadas de un hook: que decida `cwd` (ver `gitEnv` en `ui-guard.ts`).
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8", env });
  return r.status === 0 ? r.stdout : null;
}

const SEP = "\x1e";

export function audit(root: string, ref = "origin/main"): string[] {
  const added = git(root, [
    "log",
    ref,
    "--diff-filter=A",
    "--format=%H",
    "--",
    "tools/ui-guard.ts",
  ]);
  const anchor = added?.trim().split("\n").at(-1);
  if (!anchor) return [];
  const log = git(root, [
    "log",
    `${anchor}..${ref}`,
    `--format=${SEP}%H%x00%s%x00%B%x00`,
    "--name-only",
    "--",
    ...CLAUDE_ZONE,
  ]);
  if (!log) return [];
  const commits = log
    .split(SEP)
    .filter((chunk) => chunk.trim().length > 0)
    .map((chunk) => {
      const [sha, subject, body, files] = chunk.split("\0");
      return {
        sha,
        subject,
        body,
        files: files.split("\n").filter((f) => f.length > 0),
      };
    });
  return offenders(commits);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  for (const line of audit(join(import.meta.dirname, ".."))) console.log(line);
}
