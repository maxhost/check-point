// Deterministic descriptive list analysis; original failed/incomplete attempts remain separate.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
const dir = "/private/tmp/checkpass-pos-0242/private",
  hash = (v) => createHash("sha256").update(v).digest("hex");
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2
    ? s[(s.length - 1) / 2]
    : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const trace = readFileSync(`${dir}/server-trace.jsonl`, "utf8")
  .trim()
  .split("\n")
  .map(JSON.parse);
const names = [
  "m0-empty-owner-01.json",
  "m0-empty-staff-01.json",
  "m0-normal-owner-02.json",
  "m0-normal-staff-01.json",
  "m0-volume-owner-01.json",
  "m0-volume-staff-01.json",
];
const report = {
  method:
    "M0 descriptive only:5reloads/cell; first-assets separate; no causal improvement or p95 uncertainty claim",
  sources: {},
  cells: [],
  exceptions: [],
  artifacts: {},
};
for (const file of names) {
  const raw = readFileSync(`${dir}/${file}`),
    r = JSON.parse(raw);
  if (
    !r.valid ||
    !r.completed ||
    r.attempts.length !== 6 ||
    r.attempts.some((a) => !a.valid)
  )
    throw Error("Required cell incomplete");
  const reloads = r.attempts.filter((a) => a.kind === "reload"),
    first = r.attempts.find((a) => a.kind === "first-assets");
  const runs = new Set(r.attempts.map((a) => a.tag));
  const rows = trace.filter((x) => runs.has(x.run));
  const perAttempt = r.attempts.map((a) => {
    const sql = rows.filter((x) => x.run === a.tag && x.kind === "sql-start");
    return {
      tag: a.tag,
      totalSQL: sql.length,
      byPath: Object.fromEntries(
        [...new Set(sql.map((x) => x.path))]
          .sort()
          .map((p) => [p, sql.filter((x) => x.path === p).length]),
      ),
      browserGET: Object.fromEntries(
        [
          "/api/merchant/session",
          "/api/modules",
          "/api/modules/pos/orders",
          "/api/modules/pos/ticket",
        ].map((p) => [p, a.network.filter((x) => x.path === p).length]),
      ),
      cacheHits: a.network.filter((x) => x.servedFromCache || x.fromDiskCache)
        .length,
    };
  });
  report.sources[file] = {
    sha256: hash(raw),
    source: r.source,
    buildSource: r.freeze.buildSource ?? r.freeze.source,
    buildId: r.freeze.buildId,
    freezeSha256: r.freezeSha256,
  };
  report.cells.push({
    case: r.case,
    role: r.role,
    firstAssetsReadyMs: first.metrics.readyAt,
    medianReloadReadyMs: median(reloads.map((a) => a.metrics.readyAt)),
    observedP95ReloadMs: [...reloads.map((a) => a.metrics.readyAt)]
      .sort((a, b) => a - b)
      .at(-1),
    medianReloadTTFBMs: median(reloads.map((a) => a.metrics.navigation.ttfb)),
    validAttempts: 6,
    pageErrors: r.attempts.reduce((n, a) => n + a.pageErrors, 0),
    externalRequests: r.attempts.reduce((n, a) => n + a.externalBlocked, 0),
    sqlStarts: rows.filter((x) => x.kind === "sql-start").length,
    sqlEnds: rows.filter((x) => x.kind === "sql-end").length,
    sqlFailures: rows.filter((x) => x.kind === "sql-end" && !x.ok).length,
    phaseCount: rows.filter((x) => x.kind === "phase-end").length,
    perAttempt,
  });
}
for (const file of ["smoke-empty-owner-01.json", "m0-normal-owner-01.json"]) {
  const r = JSON.parse(readFileSync(`${dir}/${file}`));
  report.exceptions.push({
    file,
    completed: r.completed,
    fatal: r.fatal,
    attempts: r.attempts.map((a) => ({
      tag: a.tag,
      valid: a.valid ?? null,
      readyTimeout: a.readyTimeout,
      navigationError: a.navigationError ?? null,
      listResponses: a.listResponses,
    })),
  });
}
for (const name of [
  "control-build-6f.tar.gz",
  "fixture.json",
  "list-freeze/schema-preflight.json",
  "campaign-list.jsonl",
  "campaign-list-corrected.jsonl",
])
  if (existsSync(`${dir}/${name}`))
    report.artifacts[name] = hash(readFileSync(`${dir}/${name}`));
report.totalValidAttempts = report.cells.reduce(
  (n, c) => n + c.validAttempts,
  0,
);
writeFileSync(
  `${dir}/m0-list-summary.json`,
  JSON.stringify(report, null, 2) + "\n",
  { mode: 0o600 },
);
process.stdout.write(
  JSON.stringify(
    {
      total: report.totalValidAttempts,
      cells: report.cells.map(
        ({
          case: c,
          role,
          firstAssetsReadyMs,
          medianReloadReadyMs,
          medianReloadTTFBMs,
          sqlStarts,
          sqlEnds,
          sqlFailures,
        }) => ({
          case: c,
          role,
          firstAssetsReadyMs,
          medianReloadReadyMs,
          medianReloadTTFBMs,
          sqlStarts,
          sqlEnds,
          sqlFailures,
        }),
      ),
      exceptions: report.exceptions.map((x) => ({
        file: x.file,
        attempts: x.attempts.length,
      })),
    },
    null,
    2,
  ) + "\n",
);
