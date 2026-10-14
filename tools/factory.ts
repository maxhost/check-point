/** Local pilot registry. Coordinator only; no push, deployment or DB operations. */
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  rmdirSync,
  existsSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

type State = "reserved" | "delivered" | "accepted" | "integrated" | "retired";
export type Task = {
  id: string;
  worktree: string;
  base: string;
  paths: string[];
  resources: string[];
  state: State;
  sha?: string;
};
type Registry = { version: 1; tasks: Task[] };

export function git(root: string, args: string[]): string {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );
  const result = spawnSync("git", args, { cwd: root, env, encoding: "utf8" });
  if (result.status !== 0)
    throw new Error(result.stderr.trim() || `git ${args[0]} failed`);
  return result.stdout.trim();
}

const overlaps = (a: string, b: string) =>
  a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
export function reserve(tasks: Task[], task: Task): Task[] {
  if (
    !/^[a-z0-9-]+$/.test(task.id) ||
    tasks.some((other) => other.id === task.id)
  )
    throw new Error("Task ID invalid or already reserved");
  if (
    !task.paths.length ||
    task.paths.some(
      (path) =>
        !path ||
        path.startsWith("/") ||
        path
          .split("/")
          .some((part) => part === ".." || part === "." || !part) ||
        /[*?]/.test(path),
    )
  )
    throw new Error("Paths must be explicit relative files or directories");
  const active = tasks.filter((other) => other.state !== "retired");
  if (active.length >= 3)
    throw new Error("Three operational worktrees already reserved");
  for (const other of active) {
    if (resolve(other.worktree) === resolve(task.worktree))
      throw new Error("Worktree already reserved");
    if (
      task.paths.some((path) =>
        other.paths.some((reserved) => overlaps(path, reserved)),
      )
    )
      throw new Error(`Paths overlap task ${other.id}`);
    if (task.resources.some((resource) => other.resources.includes(resource)))
      throw new Error(`Resources overlap task ${other.id}`);
  }
  return [...tasks, task];
}

export function assertScope(task: Task, files: string[]) {
  const foreign = files.filter(
    (file) =>
      !task.paths.some((path) => file === path || file.startsWith(`${path}/`)),
  );
  if (foreign.length)
    throw new Error(`Outside task scope: ${foreign.join(", ")}`);
}

function registryRoot(root: string) {
  // Every worktree resolves back to the original checkout, not its own registry.
  const common = resolve(root, git(root, ["rev-parse", "--git-common-dir"]));
  return resolve(common, "..");
}

function edit(root: string, action: (registry: Registry) => void) {
  const dir = join(registryRoot(root), ".factory");
  mkdirSync(dir, { recursive: true });
  const lock = join(dir, "write.lock");
  mkdirSync(lock); // Atomic exclusion; never steal an expired lock from a live writer.
  try {
    const file = join(dir, "registry.json");
    const registry: Registry = existsSync(file)
      ? JSON.parse(readFileSync(file, "utf8"))
      : { version: 1, tasks: [] };
    if (registry.version !== 1) throw new Error("Unsupported registry version");
    action(registry);
    const temp = `${file}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify(registry, null, 2) + "\n");
    renameSync(temp, file);
  } finally {
    rmdirSync(lock);
  }
}

function clean(task: Task) {
  if (git(task.worktree, ["status", "--porcelain"]))
    throw new Error("Worktree is dirty; preserve pending work");
}

function noProcesses(task: Task) {
  const result = spawnSync("lsof", ["-a", "-d", "cwd", "-Fpn"], {
    encoding: "utf8",
  });
  if (result.error || (result.status !== 0 && result.status !== 1))
    throw new Error("Cannot verify running processes");
  const prefix = resolve(task.worktree);
  if (
    result.stdout
      .split("\n")
      .some((line) => line === `n${prefix}` || line.startsWith(`n${prefix}/`))
  )
    throw new Error(
      "A process still uses this worktree; stop it before cleanup",
    );
}

export function assertRetirable(
  task: Task,
  contains: boolean,
  isClean: boolean,
) {
  if (task.state !== "integrated" || !task.sha || !contains || !isClean)
    throw new Error(
      "Cleanup requires accepted integration in local main and a clean worktree",
    );
}

export function run(root: string, args: string[]) {
  const [command, id, ...rest] = args;
  if (command === "status") {
    const file = join(registryRoot(root), ".factory/registry.json");
    return existsSync(file)
      ? readFileSync(file, "utf8")
      : "No tasks registered\n";
  }
  edit(root, (registry) => {
    if (command === "reserve") {
      const [worktree, base, paths, resources = ""] = rest;
      if (!worktree || !base || !paths)
        throw new Error("reserve ID WORKTREE BASE PATHS[,PATH] [RESOURCES]");
      const original = registryRoot(root);
      if (registryRoot(worktree) !== original)
        throw new Error("Worktree belongs to another repo");
      if ([original, resolve(root)].includes(resolve(worktree)))
        throw new Error("Cannot reserve integration checkout");
      const branch = git(worktree, ["branch", "--show-current"]);
      if (!branch || branch === "main" || branch === "dev")
        throw new Error("Worker requires its own local branch");
      const sha = git(worktree, ["rev-parse", base]);
      if (git(worktree, ["rev-parse", "HEAD"]) !== sha)
        throw new Error("Worker must start on the assigned base");
      registry.tasks = reserve(registry.tasks, {
        id,
        worktree: resolve(worktree),
        base: sha,
        paths: paths.split(","),
        resources: resources.split(",").filter(Boolean),
        state: "reserved",
      });
      return;
    }
    const task = registry.tasks.find((candidate) => candidate.id === id);
    if (!task) throw new Error("Unknown task");
    if (command === "deliver") {
      if (task.state !== "reserved")
        throw new Error("Task is not implementing");
      clean(task);
      const files = git(task.worktree, [
        "diff",
        "--name-only",
        `${task.base}..HEAD`,
      ])
        .split("\n")
        .filter(Boolean);
      assertScope(task, files);
      if (!files.length) throw new Error("No implementation changes delivered");
      task.sha = git(task.worktree, ["rev-parse", "HEAD"]);
      task.state = "delivered";
    } else if (command === "accept") {
      if (task.state !== "delivered" || rest[0] !== task.sha)
        throw new Error("QA approval must name the delivered SHA");
      task.state = "accepted";
    } else if (command === "integrate") {
      if (task.state !== "accepted" || !task.sha)
        throw new Error("QA acceptance required");
      git(registryRoot(root), [
        "merge-base",
        "--is-ancestor",
        task.sha,
        "main",
      ]);
      task.state = "integrated";
    } else if (command === "cleanup") {
      clean(task);
      let contains = false;
      try {
        git(registryRoot(root), [
          "merge-base",
          "--is-ancestor",
          task.sha ?? "",
          "main",
        ]);
        contains = true;
      } catch {
        /* fail closed below */
      }
      assertRetirable(task, contains, true);
      noProcesses(task);
      const branch = git(task.worktree, ["branch", "--show-current"]);
      if (!branch || branch === "main" || branch === "dev")
        throw new Error("Ref protected");
      git(registryRoot(root), ["worktree", "remove", task.worktree]);
      git(registryRoot(root), ["branch", "-d", branch]);
      task.state = "retired";
    } else
      throw new Error("Use status/reserve/deliver/accept/integrate/cleanup");
  });
  return "OK\n";
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    process.stdout.write(run(process.cwd(), process.argv.slice(2)));
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : "Factory failed");
    process.exitCode = 1;
  }
}
