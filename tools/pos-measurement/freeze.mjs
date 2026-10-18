// Emits only source/config hashes and public tool/schema identity, never configuration values.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
const directory = "/private/tmp/checkpass-pos-0242/private";
const hash = (v) => createHash("sha256").update(v).digest("hex");
const run = (...args) =>
  execFileSync(args[0], args.slice(1), { encoding: "utf8" }).trim();
if (run("git", "status", "--porcelain"))
  throw Error("Freeze requires clean source");
const files = run(
  "git",
  "ls-files",
  "packages/db/src/schema",
  "packages/db/drizzle",
  "packages/db/src/client.ts",
  "packages/db/src/pos-measurement.ts",
  "apps/merchant/src/modules/dispatch.ts",
  "apps/merchant/src/modules/pos/server/close.ts",
  "apps/merchant/src/server/request-measurement.ts",
  "apps/merchant/src/modules/pos/server/pos-measurement.neon.integration.test.ts",
  "apps/merchant/src/modules/pos/server/pos-measurement.test-support.ts",
  "apps/merchant/src/modules/pos/server/pos-measurement-login.test-support.ts",
  "tests/e2e/support/pos-measurement.cjs",
  "tests/e2e/support/pos-measurement-preload.mjs",
  "tools/pos-measurement",
)
  .split("\n")
  .filter(Boolean);
const report = {
  createdAt: new Date().toISOString(),
  source: run("git", "rev-parse", "HEAD"),
  buildSource: run("git", "rev-parse", "HEAD"),
  controlProduct: "89dc17071eb0a2a5cf1379f5cb2018881a42b9a3",
  node: process.version,
  pnpm: run("pnpm", "--version"),
  next: JSON.parse(readFileSync("apps/merchant/node_modules/next/package.json"))
    .version,
  buildId: readFileSync("apps/merchant/.next/BUILD_ID", "utf8").trim(),
  lockSha256: hash(readFileSync("pnpm-lock.yaml")),
  privateConfigSha256: hash(readFileSync(resolve(directory, "selected.json"))),
  manifestSha256: hash(readFileSync(resolve(directory, "fixture.json"))),
  schemaPreflightSha256: hash(
    readFileSync(resolve(directory, "schema-preflight.json")),
  ),
  files: Object.fromEntries(
    files.sort().map((f) => [f, hash(readFileSync(f))]),
  ),
  recipe: {
    reloadsPerCell: 5,
    cells: [
      "empty-owner",
      "empty-staff",
      "normal-owner",
      "normal-staff",
      "volume-owner",
      "volume-staff",
    ],
    firstAssetsPerCell: 1,
    seed: 24220261018,
    bootstrap: 10000,
    m0: "descriptive only; no causal improvement or p95 confidence claim",
    m1: "at least30paired AB/BA and10first-assets per source; predeclared separate campaign",
  },
  privateArtifacts: readdirSync(directory).filter((f) => f.endsWith(".log")),
};
if (process.argv[2] === "--reuse-build") {
  const previous = JSON.parse(readFileSync(resolve(directory, "freeze.json")));
  if (
    report.buildId !== previous.buildId ||
    report.lockSha256 !== previous.lockSha256 ||
    report.privateConfigSha256 !== previous.privateConfigSha256
  )
    throw Error("Build identity changed");
  for (const [file, expected] of Object.entries(previous.files)) {
    if (
      (file.startsWith("apps/") ||
        file.startsWith("packages/") ||
        file.includes("preload")) &&
      hash(readFileSync(file)) !== expected
    )
      throw Error("Compiled/instrumented source changed; rebuild required");
  }
  report.buildSource = previous.buildSource ?? previous.source;
  writeFileSync(
    resolve(directory, `freeze-${previous.source}.json`),
    JSON.stringify(previous, null, 2) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  writeFileSync(
    resolve(directory, "freeze.json"),
    JSON.stringify(report, null, 2) + "\n",
    { mode: 0o600 },
  );
} else {
  writeFileSync(
    resolve(directory, "freeze.json"),
    JSON.stringify(report, null, 2) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  process.stdout.write(
    `Freeze created for ${report.source}; build ${report.buildId}.\n`,
  );
}
