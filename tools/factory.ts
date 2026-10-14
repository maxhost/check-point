/** Local pilot registry. Coordinator only; no push, deployment or DB operations. */
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  rmdirSync,
  existsSync,
  realpathSync,
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
  branch?: string;
  revisions?: Array<{
    sha: string;
    review?: "accepted" | "rejected";
    reason?: string;
  }>;
  continuations?: Array<{
    sha: string;
    base: string;
    paths: string[];
    resources: string[];
  }>;
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
  return realpathSync(resolve(common, ".."));
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
  head = task.sha,
) {
  if (
    task.state !== "integrated" ||
    !task.sha ||
    !contains ||
    !isClean ||
    head !== task.sha
  )
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
    if (command === "continue") {
      const [baseRef, paths, resources = ""] = rest;
      if (
        (task.state !== "delivered" && task.state !== "accepted") ||
        !task.sha ||
        !baseRef ||
        !paths
      )
        throw new Error(
          "continue requires a delivery, new base and explicit scope",
        );
      const original = registryRoot(root);
      if (registryRoot(task.worktree) !== original)
        throw new Error("Worktree belongs to another repo");
      clean(task);
      noProcesses(task);
      if (
        git(task.worktree, ["rev-parse", "HEAD"]) !== task.sha ||
        git(task.worktree, ["branch", "--show-current"]) !== task.branch
      )
        throw new Error("Checkout changed after delivery");
      const base = git(original, ["rev-parse", `${baseRef}^{commit}`]);
      git(original, ["merge-base", "--is-ancestor", task.sha, base]);
      git(original, ["merge-base", "--is-ancestor", base, "dev"]);
      const continued: Task = {
        ...task,
        base,
        paths: [...new Set([...task.paths, ...paths.split(",")])],
        resources: resources.split(",").filter(Boolean),
        state: "reserved",
      };
      reserve(
        registry.tasks.filter((other) => other.id !== id),
        continued,
      );
      // All checks precede the fast-forward; never discard an earlier revision.
      git(task.worktree, ["merge", "--ff-only", base]);
      task.continuations = [
        ...(task.continuations ?? []),
        {
          sha: task.sha,
          base: task.base,
          paths: task.paths,
          resources: task.resources,
        },
      ];
      task.base = continued.base;
      task.paths = continued.paths;
      task.resources = continued.resources;
      task.state = "reserved";
      delete task.sha;
    } else if (command === "resources") {
      if (task.state === "integrated" || task.state === "retired")
        throw new Error("Resource assignment requires an active task");
      const assigned = {
        ...task,
        resources: [...new Set((rest[0] ?? "").split(",").filter(Boolean))],
      };
      reserve(
        registry.tasks.filter((other) => other.id !== id),
        assigned,
      );
      task.resources = assigned.resources;
    } else if (command === "extend") {
      if (task.state !== "reserved" || task.sha)
        throw new Error("Scope extension requires an implementing task");
      if (!rest[0]) throw new Error("extend ID PATHS[,PATH]");
      const expanded = {
        ...task,
        paths: [...new Set([...task.paths, ...rest[0].split(",")])],
      };
      // Reuse every reservation check, including foreign scopes/resources.
      reserve(
        registry.tasks.filter((other) => other.id !== id),
        expanded,
      );
      task.paths = expanded.paths;
    } else if (command === "deliver") {
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
      task.branch = git(task.worktree, ["branch", "--show-current"]);
      task.revisions = [...(task.revisions ?? []), { sha: task.sha }];
      task.state = "delivered";
    } else if (command === "accept") {
      if (task.state !== "delivered" || rest[0] !== task.sha)
        throw new Error("QA approval must name the delivered SHA");
      task.state = "accepted";
      const revision = task.revisions?.at(-1);
      if (revision) revision.review = "accepted";
    } else if (command === "reject") {
      if (
        (task.state !== "delivered" && task.state !== "accepted") ||
        rest[0] !== task.sha ||
        !rest[1]
      )
        throw new Error("QA rejection must name delivered SHA and reason");
      const revision = task.revisions?.at(-1);
      if (revision) {
        revision.review = "rejected";
        revision.reason = rest.slice(1).join(" ");
      }
      task.state = "reserved";
      delete task.sha;
    } else if (command === "refresh") {
      if (task.state !== "reserved" || task.sha)
        throw new Error("Cannot change an active delivery base");
      clean(task);
      const base = git(task.worktree, ["rev-parse", rest[0] ?? "HEAD"]);
      if (git(task.worktree, ["rev-parse", "HEAD"]) !== base)
        throw new Error("Checkout must already be frozen on new base");
      git(task.worktree, ["merge-base", "--is-ancestor", task.base, base]);
      task.base = base;
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
      const present = existsSync(task.worktree);
      if (present) clean(task);
      assertRetirable(
        task,
        contains,
        true,
        present ? git(task.worktree, ["rev-parse", "HEAD"]) : task.sha,
      );
      if (present) noProcesses(task);
      const branch = task.branch;
      if (!branch || branch === "main" || branch === "dev")
        throw new Error("Ref protected");
      let branchExists = false;
      try {
        git(registryRoot(root), [
          "show-ref",
          "--verify",
          `refs/heads/${branch}`,
        ]);
        branchExists = true;
      } catch {
        /* already removed */
      }
      if (
        branchExists &&
        git(registryRoot(root), ["rev-parse", branch]) !== task.sha
      )
        throw new Error("Branch changed after accepted delivery");
      if (present)
        git(registryRoot(root), ["worktree", "remove", task.worktree]);
      if (branchExists) git(registryRoot(root), ["branch", "-d", branch]);
      task.state = "retired";
    } else
      throw new Error(
        "Use status/reserve/continue/extend/resources/deliver/accept/reject/refresh/integrate/cleanup",
      );
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
