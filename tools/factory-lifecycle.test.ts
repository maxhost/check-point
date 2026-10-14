import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { git, run } from "./factory";

let fixture: string;
afterEach(() => {
  if (fixture) rmSync(fixture, { recursive: true, force: true });
});

it("QA rejection preserves history and can deliver a corrected revision; stale approval cannot approve it", () => {
  fixture = mkdtempSync(join(tmpdir(), "factory-lifecycle-"));
  git(fixture, ["init", "-b", "main"]);
  git(fixture, ["config", "user.email", "fixture@example.test"]);
  git(fixture, ["config", "user.name", "Factory fixture"]);
  writeFileSync(join(fixture, ".gitignore"), ".factory\nworker\n");
  writeFileSync(join(fixture, "feature.ts"), "export const result = 0;\n");
  git(fixture, ["add", "."]);
  git(fixture, ["commit", "-m", "fixture"]);
  const base = git(fixture, ["rev-parse", "HEAD"]);
  const worker = join(fixture, "worker");
  git(fixture, ["worktree", "add", "-b", "task", worker, base]);
  run(fixture, ["reserve", "task", worker, base, "feature.ts"]);
  expect(() => run(fixture, ["extend", "task", "../foreign"])).toThrow(
    "explicit relative",
  );
  run(fixture, ["extend", "task", "feature.ts,extra.ts"]);
  expect(
    JSON.parse(readFileSync(join(fixture, ".factory/registry.json"), "utf8"))
      .tasks[0].paths,
  ).toEqual(["feature.ts", "extra.ts"]);
  run(fixture, ["resources", "task", "db:ci"]);
  const secondWorker = join(fixture, "second-worker");
  git(fixture, ["worktree", "add", "-b", "second-task", secondWorker, base]);
  run(fixture, ["reserve", "second-task", secondWorker, base, "second.ts"]);
  expect(() => run(fixture, ["resources", "second-task", "db:ci"])).toThrow(
    "Resources overlap",
  );
  run(fixture, ["resources", "task", ""]);
  run(fixture, ["resources", "second-task", "db:ci"]);
  const commit = (value: number) => {
    writeFileSync(
      join(worker, "feature.ts"),
      `export const result = ${value};\n`,
    );
    git(worker, ["add", "feature.ts"]);
    git(worker, ["commit", "-m", "implementation"]);
    return git(worker, ["rev-parse", "HEAD"]);
  };
  const first = commit(1);
  run(fixture, ["deliver", "task"]);
  expect(() => run(fixture, ["extend", "task", "late.ts"])).toThrow(
    "implementing task",
  );
  run(fixture, ["reject", "task", first, "wrong result"]);
  const second = commit(2);
  run(fixture, ["deliver", "task"]);
  expect(() => run(fixture, ["accept", "task", first])).toThrow(
    "delivered SHA",
  );
  run(fixture, ["accept", "task", second]);
  expect(() => run(fixture, ["cleanup", "task"])).toThrow("Cleanup requires");
  git(fixture, ["merge", "--ff-only", "task"]);
  run(fixture, ["integrate", "task"]);
  commit(3);
  expect(() => run(fixture, ["cleanup", "task"])).toThrow("Cleanup requires");
  const saved = JSON.parse(
    readFileSync(join(fixture, ".factory/registry.json"), "utf8"),
  );
  expect(saved.tasks[0].revisions).toEqual([
    { sha: first, review: "rejected", reason: "wrong result" },
    { sha: second, review: "accepted" },
  ]);
}, 10000);
