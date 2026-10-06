import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gitEnv } from "./ui-guard.ts";
import { audit, offenders } from "./zone-audit.ts";

/** Spec 0164: detecta (no impide) commits sobre la zona de Claude sin su trailer. */
const TRAILER = "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>";

describe("offenders", () => {
  it("sin trailer y tocando la zona → aviso; con trailer o fuera de zona → nada", () => {
    expect(
      offenders([
        {
          sha: "a".repeat(40),
          subject: "kit",
          body: "kit\n",
          files: ["apps/merchant/src/ui/button.tsx"],
        },
        {
          sha: "b".repeat(40),
          subject: "ok",
          body: `ok\n\n${TRAILER}\n`,
          files: ["eslint.config.mjs"],
        },
        {
          sha: "c".repeat(40),
          subject: "pantalla",
          body: "x",
          files: ["apps/merchant/src/app/a.tsx"],
        },
        {
          sha: "d".repeat(40),
          subject: "guard",
          body: "x",
          files: ["tools/ui-guard.ts", "apps/merchant/src/app/a.tsx"],
        },
      ]),
    ).toEqual([
      "AVISO zona Claude: aaaaaaa kit (apps/merchant/src/ui/button.tsx) — avisale al owner",
      "AVISO zona Claude: ddddddd guard (tools/ui-guard.ts) — avisale al owner",
    ]);
  });
});

describe("audit (repo git temporal)", () => {
  let root: string;
  const git = (...args: string[]) => {
    const r = spawnSync("git", args, {
      cwd: root,
      encoding: "utf8",
      env: gitEnv(),
    });
    if (r.status !== 0) throw new Error(r.stderr);
  };
  const commit = (path: string, message: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), message);
    git("add", ".");
    git("commit", "-qm", message);
  };
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "zone-audit-"));
    git("init", "-q", "-b", "main");
    git("config", "user.email", "t@t");
    git("config", "user.name", "t");
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("sin tools/ui-guard.ts no hay ancla: nada", () => {
    commit("apps/merchant/src/ui/a.tsx", "kit sin trailer");
    expect(audit(root, "main")).toEqual([]);
  });

  it("solo los commits DESPUES del ancla y sin trailer", () => {
    commit("apps/merchant/src/ui/a.tsx", "viejo sin trailer");
    commit("tools/ui-guard.ts", `guard\n\n${TRAILER}`);
    commit("apps/merchant/src/ui/a.tsx", `con trailer\n\n${TRAILER}`);
    commit("apps/merchant/src/ui/b.tsx", "nuevo sin trailer");
    commit("apps/merchant/src/app/c.tsx", "pantalla sin trailer");
    const lines = audit(root, "main");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(
      /nuevo sin trailer \(apps\/merchant\/src\/ui\/b\.tsx\)/,
    );
  });
});
