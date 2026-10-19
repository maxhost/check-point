/** Protected M1 launcher. Import is pure; all resources are explicit per invocation. */
import { createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  lstatSync,
  realpathSync,
  readdirSync,
  existsSync,
  symlinkSync,
  chmodSync,
  openSync,
  closeSync,
  cpSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";
import { rng, SEED } from "./m1-analyze.mjs";

export const CONTROL_SOURCE = "6f8e1e9cecdd33930c5f055db43641d805dbe3c2";
export const CONTROL_BUILD = "VLV2fFFeM_dUWKnxvv7iY";
export const CONTROL_ARCHIVE =
  "54cbc567143f7d3e2af43309810c14da6bea647ab50926534ecb4b78109ec5fe";
export const BUILD_HASH_POLICY = Object.freeze({
  version: 1,
  runtimeMutable: ["cache/fetch-cache/**", "cache/images/**", "trace"],
});
export function buildPathKind(path) {
  if (
    path.startsWith("/") ||
    path.split("/").some((p) => ["..", ".", ""].includes(p))
  )
    throw Error("Build-relative file path required");
  return path === "trace" ||
    path.startsWith("cache/fetch-cache/") ||
    path.startsWith("cache/images/")
    ? "runtime"
    : "compiled";
}
export function snapshotBuild(directory) {
  return {
    buildFiles: treeHashes(directory, "", "compiled"),
    runtimeFiles: treeHashes(directory, "", "runtime"),
  };
}
export function compareBuildIdentity(initial, current) {
  if (JSON.stringify(initial.buildFiles) !== JSON.stringify(current.buildFiles))
    throw Error("Compiled build drift");
  const before = initial.runtimeFiles,
    after = current.runtimeFiles;
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .sort()
    .filter((path) => before[path] !== after[path])
    .map((path) => ({
      path,
      initial: before[path] ?? null,
      current: after[path] ?? null,
    }));
}
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PRIVATE = "/private/tmp/checkpass-pos-0242/private";
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export const git = (...args) =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
export function metadataProvenance(prepare, execution) {
  let before, after;
  try {
    before = JSON.parse(prepare);
    after = JSON.parse(execution);
  } catch {
    throw Error("Private pnpm metadata must be comparable JSON");
  }
  return {
    prepareSha256: hash(prepare),
    executionSha256: hash(execution),
    changedKeys: [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .sort()
      .filter(
        (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
      ),
  };
}
export function assertMetadataIdentity(expected, current) {
  if (hash(current) !== expected)
    throw Error("Dependency execution metadata drift");
}
export function assertDependencyIdentity(expected, current) {
  if (JSON.stringify(expected) !== JSON.stringify(current))
    throw Error("Installed dependency identity drift");
}
function dependencyIdentity() {
  const pnpm = realpathSync(
    execFileSync("which", ["pnpm"], { encoding: "utf8" }).trim(),
  );
  const packages = [
    "node_modules/@playwright/test/package.json",
    "node_modules/typescript/package.json",
    "node_modules/drizzle-orm/package.json",
    "node_modules/@neondatabase/serverless/package.json",
    ...["next", "react", "react-dom", "better-auth"].map(
      (name) => `apps/merchant/node_modules/${name}/package.json`,
    ),
  ];
  return {
    node: process.version,
    nodePath: realpathSync(process.execPath),
    pnpmPath: pnpm,
    pnpmBinarySha256: hash(readFileSync(pnpm)),
    lockSha256: hash(readFileSync(join(ROOT, "pnpm-lock.yaml"))),
    installedLockSha256: hash(
      readFileSync(join(ROOT, "node_modules/.pnpm/lock.yaml")),
    ),
    packages: packages.map((path) => {
      const raw = readFileSync(join(ROOT, path));
      return {
        path,
        realpath: realpathSync(join(ROOT, path)),
        version: JSON.parse(raw).version,
        sha256: hash(raw),
      };
    }),
    paths: git("ls-files", "*package.json")
      .split("\n")
      .map((file) => join(ROOT, dirname(file), "node_modules"))
      .filter((file) => existsSync(file))
      .map((path) => ({ path, realpath: realpathSync(path) })),
  };
}
export function privateDirectory(path) {
  const full = realpathSync(path),
    s = lstatSync(path);
  if (
    full !== resolve(path) ||
    !full.startsWith("/private/tmp/checkpass-pos-0242/m1-") ||
    !s.isDirectory() ||
    s.isSymbolicLink() ||
    s.mode & 0o077
  )
    throw Error("Exclusive private M1 namespace0700 required");
  return full;
}
export function privateFile(path) {
  const s = lstatSync(path);
  if (
    !s.isFile() ||
    s.isSymbolicLink() ||
    s.mode & 0o077 ||
    realpathSync(path) !== resolve(path)
  )
    throw Error("Private regular file0600 required");
  return readFileSync(path);
}
export function exclusive(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
}
export function validateEndpoint(url, blocked, expected) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    throw Error("Protected CI URL required");
  }
  if (!/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(host))
    throw Error("Protected Neon host required");
  let id = host.split(".")[0];
  for (;;) {
    const next = id.replace(/-(pooler|rvr)$/, "");
    if (next === id) break;
    id = next;
  }
  const fingerprint = hash(id).slice(0, 12);
  if (fingerprint === blocked || fingerprint !== expected)
    throw Error("Protected CI identity mismatch");
  return fingerprint;
}
export function selected() {
  const raw = privateFile(`${PRIVATE}/selected.json`),
    config = JSON.parse(raw);
  const blocked = readFileSync(
    join(ROOT, "packages/db/src/local.ts"),
    "utf8",
  ).match(/PROD_DB_ENDPOINT_SHA12 = "([a-f0-9]{12})"/)?.[1];
  if (!blocked) throw Error("Missing unconditional antiPROD constant");
  for (const key of ["NEON_CI_DATABASE_URL", "NEON_CI_DATABASE_URL_UNPOOLED"])
    validateEndpoint(
      config[key],
      blocked,
      config.POS_MEASUREMENT_ENDPOINT_SHA12,
    );
  if (
    config.BETTER_AUTH_URL !== "http://localhost:43242" ||
    config.BETTER_AUTH_SECRET?.length < 32
  )
    throw Error("Unexpected local selected auth");
  privateFile(`${PRIVATE}/ci.env`);
  return {
    config,
    sha256: hash(raw),
    ciSha256: hash(privateFile(`${PRIVATE}/ci.env`)),
  };
}
export function environment(directory) {
  const { config } = selected();
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NVM_DIR: process.env.NVM_DIR,
    CI: "1",
    ...config,
    DATABASE_URL: config.NEON_CI_DATABASE_URL,
    EMAIL_PROVIDER: "console",
    AI_PROVIDER: "fake",
    CONSUMER_ORIGIN: "http://localhost:43243",
    NEON_TEST_ENV_FILE: `${PRIVATE}/ci.env`,
    POS_MEASUREMENT_DIR: privateDirectory(directory),
    POS_M1_DIR: directory,
    POS_M1_FIXTURE: "true",
  };
}
function clean() {
  if (!process.version.startsWith("v24.") || git("status", "--porcelain"))
    throw Error("Node24 and clean runner source required");
  return git("rev-parse", "HEAD");
}
export function authorization(directory, action) {
  const file = process.env.POS_M1_AUTHORIZATION;
  if (!file || dirname(resolve(file)) !== privateDirectory(directory))
    throw Error("Coordinator resource authorization required");
  const a = JSON.parse(privateFile(file));
  if (
    a.kind !== "pos-m1-resource-authorization-v1" ||
    a.runnerSHA !== clean() ||
    a.namespace !== directory ||
    !a.actions?.includes(action) ||
    a.configSha256 !== selected().sha256 ||
    a.exclusiveDB !== true ||
    a.port !== 43242 ||
    !a.reference
  )
    throw Error("Incompatible/absent coordinator resource authorization");
  return a;
}
export function schedule() {
  const random = rng(SEED),
    out = [];
  for (const role of ["owner", "staff"]) {
    const blocks = Array.from({ length: 15 }, (_, i) => i);
    for (let i = blocks.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    }
    const add = (population, pair, sources, which = "normal") => {
      for (const source of sources)
        out.push({
          id: `${role}-${population}-${pair}-${source}`,
          role,
          population,
          pair,
          source,
          case: which,
        });
    };
    for (const block of blocks) {
      add("normal-full", block * 2, ["control", "candidate"]);
      add("normal-full", block * 2 + 1, ["candidate", "control"]);
    }
    for (let i = 0; i < 10; i++)
      add(
        "new-assets",
        i,
        i % 2 ? ["candidate", "control"] : ["control", "candidate"],
      );
    for (const population of [
      "list-to-detail",
      "detail-to-list",
      "empty",
      "volume",
    ])
      for (let i = 0; i < 5; i++)
        add(
          population,
          i,
          (i + (role === "staff" ? 1 : 0)) % 2
            ? ["candidate", "control"]
            : ["control", "candidate"],
          ["empty", "volume"].includes(population) ? population : "normal",
        );
  }
  return out;
}
export function diagnosticSchedule() {
  return ["control", "candidate"].map((source) => ({
    id: `d1-owner-${source}`,
    source,
    role: "owner",
    case: "normal",
    population: "prefetch-diagnostic",
    inferential: false,
  }));
}
function treeHashes(directory, prefix = "", kind = "all") {
  const result = {};
  for (const name of readdirSync(directory).sort()) {
    const p = join(directory, name),
      rel = join(prefix, name),
      s = lstatSync(p);
    if (s.isSymbolicLink()) throw Error("Unexpected symlink in build archive");
    if (s.isDirectory()) Object.assign(result, treeHashes(p, rel, kind));
    else if (s.isFile()) {
      if (kind === "all" || buildPathKind(rel) === kind)
        result[rel] = hash(readFileSync(p));
    } else throw Error("Unexpected archive file type");
  }
  return result;
}
function linkDependencies(runtime) {
  const files = git("ls-files", "*package.json").split("\n");
  for (const file of ["package.json", ...files]) {
    const dir = dirname(file),
      original = join(ROOT, dir, "node_modules"),
      target = join(runtime, dir, "node_modules");
    if (existsSync(original) && !existsSync(target))
      symlinkSync(realpathSync(original), target, "dir");
  }
}
function protectTree(directory) {
  chmodSync(directory, 0o700);
  for (const name of readdirSync(directory)) {
    const path = join(directory, name),
      s = lstatSync(path);
    if (s.isSymbolicLink()) continue;
    if (s.isDirectory()) protectTree(path);
    else if (s.isFile()) chmodSync(path, 0o600);
  }
}
function reusableCandidate(directory, runnerSHA) {
  if (!directory) return null;
  const namespace = privateDirectory(directory),
    raw = privateFile(join(namespace, "freeze.json")),
    f = JSON.parse(raw),
    p = JSON.parse(privateFile(join(namespace, "plan.json")));
  if (
    namespace !== "/private/tmp/checkpass-pos-0242/m1-r12-1fd427d2" ||
    hash(raw) !==
      "1617de3cf21db2403f351f4e3753856a870fcecc331b3e1005000ce9589b6436" ||
    f.candidate.buildSource !== "1fd427d248e41cd6087fb93018f5c251c1bcd844" ||
    f.candidate.buildId !== "mQAEivzHwhRenkWFyULLz" ||
    f.configSha256 !== selected().sha256
  )
    throw Error("Only explicitly authorized frozen candidate may be copied");
  assertDependencyIdentity(p.dependencyIdentity, dependencyIdentity());
  const productDiff = git(
    "diff",
    "--name-only",
    f.candidate.buildSource,
    runnerSHA,
    "--",
    "apps",
    "packages",
    "pnpm-lock.yaml",
    "package.json",
    "pnpm-workspace.yaml",
    ".nvmrc",
    "tests/e2e/support/pos-measurement-preload.mjs",
  )
    .split("\n")
    .filter(Boolean);
  if (productDiff.length)
    throw Error(
      "Candidate reuse requires empty product/instrumentation/dependency diff",
    );
  const next = join(p.candidate.runtime, "apps/merchant/.next"),
    snapshot = snapshotBuild(next);
  compareBuildIdentity(f.candidate, snapshot);
  if (Object.keys(snapshot.runtimeFiles).some((path) => path !== "trace"))
    throw Error("Reused candidate must have no fetch/image runtime cache");
  return {
    namespace,
    next,
    freezeSha256: hash(raw),
    buildSource: f.candidate.buildSource,
    buildId: f.candidate.buildId,
    buildFiles: f.candidate.buildFiles,
    productDiff,
    configSha256: f.configSha256,
    dependencyIdentity: p.dependencyIdentity,
  };
}
function prepare(directory, reuseDirectory) {
  const runnerSHA = clean();
  const reuse = reusableCandidate(reuseDirectory, runnerSHA),
    candidateSource = reuse?.buildSource ?? runnerSHA;
  for (const file of [
    "pnpm-lock.yaml",
    "package.json",
    "apps/merchant/package.json",
    "apps/merchant/next.config.ts",
  ]) {
    const original = execFileSync(
      "git",
      ["show", `${CONTROL_SOURCE}:${file}`],
      { cwd: ROOT },
    );
    if (hash(original) !== hash(readFileSync(join(ROOT, file))))
      throw Error(
        "Control dependency/config identity differs; explicit runtime review required before prepare",
      );
  }
  if (
    !/^m1-[a-z0-9-]{1,70}$/.test(directory.split("/").at(-1)) ||
    dirname(resolve(directory)) !== "/private/tmp/checkpass-pos-0242"
  )
    throw Error("New M1 namespace required");
  mkdirSync(directory, { mode: 0o700 });
  privateDirectory(directory);
  // Historical archive is0644 inside its protected0700 parent. Preserve it verbatim;
  // only the new owned copy must satisfy the namespace's0600 file contract.
  const originalArchive = `${PRIVATE}/control-build-6f.tar.gz`;
  const originalStat = lstatSync(originalArchive),
    parentStat = lstatSync(PRIVATE);
  if (
    !originalStat.isFile() ||
    originalStat.isSymbolicLink() ||
    realpathSync(originalArchive) !== originalArchive ||
    !parentStat.isDirectory() ||
    parentStat.isSymbolicLink() ||
    parentStat.mode & 0o077
  )
    throw Error(
      "Original control must be regular and inside protected private parent",
    );
  const archiveBytes = readFileSync(originalArchive);
  if (hash(archiveBytes) !== CONTROL_ARCHIVE)
    throw Error("Original control archive changed");
  const archive = join(directory, "control-build-6f.tar.gz");
  writeFileSync(archive, archiveBytes, { flag: "wx", mode: 0o600 });
  if (hash(privateFile(archive)) !== CONTROL_ARCHIVE)
    throw Error("Owned control copy mismatch");
  const names = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" })
    .trim()
    .split("\n");
  if (names.some((n) => !n.startsWith(".next/") || n.split("/").includes("..")))
    throw Error("Unsafe archive path");
  const control = join(directory, "control"),
    candidate = join(directory, "candidate");
  for (const [runtime, source] of [
    [control, CONTROL_SOURCE],
    [candidate, candidateSource],
  ]) {
    mkdirSync(runtime, { mode: 0o700 });
    // Archive can exceed100MB; stream stdout to an exclusive private file rather
    // than buffering the repository in execFileSync's bounded stdout capture.
    const sourceArchive = join(directory, `source-${source}.tar`);
    const sourceFd = openSync(sourceArchive, "wx", 0o600);
    try {
      execFileSync("git", ["archive", source], {
        cwd: ROOT,
        stdio: ["ignore", sourceFd, "pipe"],
      });
    } finally {
      closeSync(sourceFd);
    }
    execFileSync("tar", ["-xf", sourceArchive, "-C", runtime]);
    linkDependencies(runtime);
  }
  execFileSync("tar", ["-xzf", archive, "-C", join(control, "apps/merchant")]);
  if (reuse) {
    const next = join(candidate, "apps/merchant/.next");
    cpSync(reuse.next, next, {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
    compareBuildIdentity(
      { buildFiles: reuse.buildFiles, runtimeFiles: {} },
      snapshotBuild(next),
    );
    if (readFileSync(join(next, "BUILD_ID"), "utf8").trim() !== reuse.buildId)
      throw Error("Reused candidate BUILD_ID drift");
  }
  protectTree(control);
  protectTree(candidate);
  const controlNext = join(control, "apps/merchant/.next");
  if (
    readFileSync(join(controlNext, "BUILD_ID"), "utf8").trim() !== CONTROL_BUILD
  )
    throw Error("Archived BUILD_ID mismatch");
  const pnpmVersion = execFileSync("pnpm", ["--version"], {
    cwd: ROOT,
    encoding: "utf8",
  }).trim();
  const dependencies = dependencyIdentity(),
    prepareMetadata = readFileSync(join(ROOT, "node_modules/.modules.yaml"));
  writeFileSync(join(directory, "modules-prepare.yaml"), prepareMetadata, {
    flag: "wx",
    mode: 0o600,
  });
  exclusive(join(directory, "plan.json"), {
    kind: "pos-m1-list-plan-v1",
    buildHashPolicy: BUILD_HASH_POLICY,
    runnerSHA,
    recipeSha256: hash(
      readFileSync(join(ROOT, "docs/factory/0242-m1-receta.md")),
    ),
    node: process.version,
    pnpm: pnpmVersion,
    next: JSON.parse(
      readFileSync(join(ROOT, "apps/merchant/node_modules/next/package.json")),
    ).version,
    dependencyMetadataSha256: hash(prepareMetadata),
    dependencyIdentity: dependencies,
    dependencyPaths: dependencies.paths,
    configSha256: selected().sha256,
    lockSha256: hash(readFileSync(join(ROOT, "pnpm-lock.yaml"))),
    control: {
      runtime: control,
      buildSource: CONTROL_SOURCE,
      buildId: CONTROL_BUILD,
      archiveSha256: CONTROL_ARCHIVE,
      archivePath: archive,
      originalArchivePath: originalArchive,
      sourceArchivePath: join(directory, `source-${CONTROL_SOURCE}.tar`),
      sourceArchiveSha256: hash(
        privateFile(join(directory, `source-${CONTROL_SOURCE}.tar`)),
      ),
      buildFiles: treeHashes(controlNext, "", "compiled"),
      runtimeFiles: treeHashes(controlNext, "", "runtime"),
    },
    candidate: {
      runtime: candidate,
      buildSource: candidateSource,
      reuse,
      sourceArchivePath: join(directory, `source-${candidateSource}.tar`),
      sourceArchiveSha256: hash(
        privateFile(join(directory, `source-${candidateSource}.tar`)),
      ),
    },
    schedule: schedule(),
    diagnosticSchedule: diagnosticSchedule(),
    ready: false,
  });
  console.log(
    "Offline plan/control runtime prepared; no DB/build/server started.",
  );
}
function run(command, args, options) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, options);
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0
        ? resolvePromise()
        : reject(Error(`Child failed (${code ?? signal})`)),
    );
  });
}
export function verifyFreeze(directory) {
  const f = JSON.parse(privateFile(join(directory, "freeze.json"))),
    plan = JSON.parse(privateFile(join(directory, "plan.json")));
  if (
    f.runnerSHA !== clean() ||
    JSON.stringify(f.buildHashPolicy) !== JSON.stringify(BUILD_HASH_POLICY) ||
    JSON.stringify(plan.buildHashPolicy) !==
      JSON.stringify(BUILD_HASH_POLICY) ||
    f.recipeSha256 !==
      hash(readFileSync(join(ROOT, "docs/factory/0242-m1-receta.md"))) ||
    f.configSha256 !== selected().sha256 ||
    f.ciSha256 !== selected().ciSha256 ||
    f.planSha256 !== hash(privateFile(join(directory, "plan.json"))) ||
    f.fixtureSha256 !== hash(privateFile(join(directory, "fixture.json"))) ||
    f.schemaSha256 !==
      hash(privateFile(join(directory, "schema-preflight.json")))
  )
    throw Error("Frozen campaign identity drift");
  const runtimeDeltas = {},
    currentRuntimeFiles = {};
  for (const source of ["control", "candidate"]) {
    const next = join(plan[source].runtime, "apps/merchant/.next");
    const current = snapshotBuild(next);
    runtimeDeltas[source] = compareBuildIdentity(f[source], current);
    currentRuntimeFiles[source] = current.runtimeFiles;
  }
  for (const [file, digest] of Object.entries(f.files))
    if (hash(readFileSync(join(ROOT, file))) !== digest)
      throw Error("Runner/product/instrumentation drift");
  for (const [file, digest] of Object.entries(f.cookies))
    if (hash(privateFile(join(directory, file))) !== digest)
      throw Error("Frozen real-login cookies drift");
  assertDependencyIdentity(plan.dependencyIdentity, dependencyIdentity());
  assertMetadataIdentity(
    f.dependencyMetadataSha256,
    readFileSync(join(ROOT, "node_modules/.modules.yaml")),
  );
  assertMetadataIdentity(
    f.dependencyMetadataSha256,
    privateFile(join(directory, "modules-execution.yaml")),
  );
  assertMetadataIdentity(
    plan.dependencyMetadataSha256,
    privateFile(join(directory, "modules-prepare.yaml")),
  );
  return { freeze: f, plan, runtimeDeltas, currentRuntimeFiles };
}
async function main() {
  process.umask(0o077);
  const [mode, input, argument] = process.argv.slice(2),
    directory = resolve(input ?? "");
  if (mode === "prepare") return prepare(directory, argument);
  privateDirectory(directory);
  if (mode === "fixture") {
    authorization(directory, "fixture");
    if (!["setup", "inspect", "login", "cleanup"].includes(argument))
      throw Error("Explicit M1 operation required");
    return run(
      "bash",
      [
        "tools/neon-test.sh",
        "src/modules/pos/server/m1-fixture.neon.integration.test.ts",
        "--no-file-parallelism",
      ],
      {
        cwd: ROOT,
        env: { ...environment(directory), POS_M1_OPERATION: argument },
        stdio: "inherit",
      },
    );
  }
  const plan = JSON.parse(privateFile(join(directory, "plan.json")));
  if (plan.runnerSHA !== clean())
    throw Error("Offline plan runner changed; new namespace/plan required");
  if (mode === "build") {
    authorization(directory, "build");
    if (plan.candidate.reuse)
      throw Error("Authorized copied candidate must not be rebuilt");
    await run(
      process.execPath,
      [
        join(ROOT, "apps/merchant/node_modules/next/dist/bin/next"),
        "build",
        "--webpack",
      ],
      {
        cwd: join(plan.candidate.runtime, "apps/merchant"),
        env: { ...environment(directory), NODE_ENV: "production" },
        stdio: "inherit",
      },
    );
    protectTree(plan.candidate.runtime);
    return;
  }
  if (mode === "freeze") {
    authorization(directory, "freeze");
    const pnpmVersion = execFileSync("pnpm", ["--version"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
    if (pnpmVersion !== plan.pnpm) throw Error("pnpm version drift");
    assertDependencyIdentity(plan.dependencyIdentity, dependencyIdentity());
    const prepareMetadata = privateFile(
        join(directory, "modules-prepare.yaml"),
      ),
      executionMetadata = readFileSync(
        join(ROOT, "node_modules/.modules.yaml"),
      );
    assertMetadataIdentity(plan.dependencyMetadataSha256, prepareMetadata);
    const metadata = metadataProvenance(prepareMetadata, executionMetadata);
    writeFileSync(
      join(directory, "modules-execution.yaml"),
      executionMetadata,
      { flag: "wx", mode: 0o600 },
    );
    const files = git(
      "ls-files",
      "apps",
      "packages",
      "pnpm-lock.yaml",
      "tests/e2e/support/pos-measurement-preload.mjs",
      "tools/pos-measurement",
      "docs/factory/0242-m1-receta.md",
    )
      .split("\n")
      .filter(Boolean);
    const report = {
      kind: "pos-m1-list-freeze-v1",
      buildHashPolicy: BUILD_HASH_POLICY,
      dependencyMetadataSha256: metadata.executionSha256,
      metadataProvenance: metadata,
      runnerSHA: clean(),
      recipeSha256: hash(
        readFileSync(join(ROOT, "docs/factory/0242-m1-receta.md")),
      ),
      configSha256: selected().sha256,
      ciSha256: selected().ciSha256,
      planSha256: hash(privateFile(join(directory, "plan.json"))),
      fixtureSha256: hash(privateFile(join(directory, "fixture.json"))),
      schemaSha256: hash(privateFile(join(directory, "schema-preflight.json"))),
      files: Object.fromEntries(
        files.map((p) => [p, hash(readFileSync(join(ROOT, p)))]),
      ),
      cookies: Object.fromEntries(
        ["empty", "normal", "volume"].flatMap((which) =>
          ["owner", "staff"].map((role) => {
            const file = `cookies-${which}-${role}.json`;
            return [file, hash(privateFile(join(directory, file)))];
          }),
        ),
      ),
    };
    for (const source of ["control", "candidate"]) {
      const next = join(plan[source].runtime, "apps/merchant/.next");
      report[source] = {
        buildSource: plan[source].buildSource,
        buildId: readFileSync(join(next, "BUILD_ID"), "utf8").trim(),
        buildFiles: treeHashes(next, "", "compiled"),
        runtimeFiles: treeHashes(next, "", "runtime"),
      };
    }
    if (report.control.buildId !== CONTROL_BUILD)
      throw Error("Original control BUILD_ID changed");
    if (
      JSON.stringify(report.control.buildFiles) !==
      JSON.stringify(plan.control.buildFiles)
    )
      throw Error(
        "Original archived control compiled files changed before freeze",
      );
    if (
      plan.candidate.reuse &&
      (report.candidate.buildId !== plan.candidate.reuse.buildId ||
        JSON.stringify(report.candidate.buildFiles) !==
          JSON.stringify(plan.candidate.reuse.buildFiles))
    )
      throw Error("Authorized copied candidate drift before freeze");
    exclusive(join(directory, "freeze.json"), report);
    return;
  }
  if (mode === "measure") {
    authorization(directory, "measure");
    verifyFreeze(directory);
    const { campaign } = await import("./m1-browser.mjs");
    return campaign(directory);
  }
  if (mode === "diagnose") {
    authorization(directory, "diagnose");
    verifyFreeze(directory);
    const { diagnose } = await import("./m1-browser.mjs");
    return diagnose(directory);
  }
  throw Error(
    "Use prepare|fixture|build|freeze|measure|diagnose with explicit namespace",
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    console.error(`M1 stopped: ${error.message}`);
    process.exitCode = 1;
  });
