import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { git, run } from "./factory";

let fixture: string;
afterEach(() => {
  if (fixture) rmSync(fixture, { recursive: true, force: true });
});

it("continues a documentary delivery without false rejection or losing history", () => {
  fixture = mkdtempSync(join(tmpdir(), "factory-continuation-"));
  git(fixture, ["init", "-b", "main"]);
  git(fixture, ["config", "user.email", "fixture@example.test"]);
  git(fixture, ["config", "user.name", "Factory fixture"]);
  writeFileSync(join(fixture, ".gitignore"), ".factory\nworker\nother\n");
  writeFileSync(join(fixture, "spec.md"), "closed\n");
  git(fixture, ["add", "."]);
  git(fixture, ["commit", "-m", "base"]);
  const originalBase = git(fixture, ["rev-parse", "HEAD"]);
  git(fixture, ["checkout", "-b", "dev"]);
  const worker = join(fixture, "worker");
  git(fixture, ["worktree", "add", "-b", "task", worker, originalBase]);
  run(fixture, ["reserve", "task", worker, originalBase, "spec.md"]);
  writeFileSync(join(worker, "spec.md"), "accepted contract\n");
  git(worker, ["add", "spec.md"]);
  git(worker, ["commit", "-m", "spec"]);
  const delivery = git(worker, ["rev-parse", "HEAD"]);
  run(fixture, ["deliver", "task"]);
  expect(() =>
    run(fixture, ["continue", "task", originalBase, "feature.ts"]),
  ).toThrow();
  writeFileSync(join(worker, "pending.txt"), "preserve\n");
  expect(() =>
    run(fixture, ["continue", "task", delivery, "feature.ts"]),
  ).toThrow("dirty");
  rmSync(join(worker, "pending.txt"));
  git(fixture, ["merge", "--ff-only", delivery]);
  writeFileSync(join(fixture, "coordinator.md"), "reserved\n");
  git(fixture, ["add", "coordinator.md"]);
  git(fixture, ["commit", "-m", "reservation"]);
  const newBase = git(fixture, ["rev-parse", "HEAD"]);
  const other = join(fixture, "other");
  git(fixture, ["worktree", "add", "-b", "other-task", other, newBase]);
  run(fixture, ["reserve", "other", other, newBase, "foreign.ts", "db:ci"]);
  expect(() =>
    run(fixture, ["continue", "task", newBase, "foreign.ts"]),
  ).toThrow("Paths overlap");
  expect(() =>
    run(fixture, ["continue", "task", newBase, "feature.ts", "db:ci"]),
  ).toThrow("Resources overlap");
  expect(() =>
    run(fixture, ["continue", "task", newBase, "../escape"]),
  ).toThrow("explicit relative");
  expect(git(worker, ["rev-parse", "HEAD"])).toBe(delivery);
  run(fixture, ["continue", "task", newBase, "feature.ts", "port:43120"]);
  const saved = JSON.parse(
    readFileSync(join(fixture, ".factory/registry.json"), "utf8"),
  ).tasks[0];
  expect(saved).toMatchObject({
    state: "reserved",
    base: newBase,
    paths: ["spec.md", "feature.ts"],
    revisions: [{ sha: delivery }],
  });
  expect(saved.sha).toBeUndefined();
  expect(saved.continuations).toEqual([
    { sha: delivery, base: originalBase, paths: ["spec.md"], resources: [] },
  ]);
  expect(git(worker, ["rev-parse", "HEAD"])).toBe(newBase);
  expect(() => run(fixture, ["accept", "task", delivery])).toThrow(
    "delivered SHA",
  );
  expect(() => run(fixture, ["cleanup", "task"])).toThrow("Cleanup requires");
  writeFileSync(join(worker, "feature.ts"), "export const result = 1;\n");
  git(worker, ["add", "feature.ts"]);
  git(worker, ["commit", "-m", "implementation"]);
  run(fixture, ["deliver", "task"]);
  const implemented = git(worker, ["rev-parse", "HEAD"]);
  run(fixture, ["accept", "task", implemented]);
  expect(() => run(fixture, ["integrate", "task"])).toThrow();
}, 10000);

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
