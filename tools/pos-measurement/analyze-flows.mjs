// Descriptive M0 only. Reads preserved private evidence; never accesses DB or auth APIs.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const dir = "/private/tmp/checkpass-pos-0242/private";
const read = (name) => JSON.parse(readFileSync(`${dir}/${name}`, "utf8"));
const hash = (name) =>
  createHash("sha256")
    .update(readFileSync(`${dir}/${name}`))
    .digest("hex");
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2
    ? s[(s.length - 1) / 2]
    : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const path = (p) => p.replace(/\/orders\/[a-f0-9-]{36}/g, "/orders/:id");
const campaign = read("m0-flows-01.json"),
  smoke = read("flow-smoke-02.json"),
  failed = read("flow-smoke-01.json");
for (const [r, count] of [
  [campaign, 18],
  [smoke, 3],
])
  if (
    !r.completed ||
    !r.valid ||
    r.attempts.length !== count ||
    r.attempts.some((a) => !a.valid) ||
    new Set(r.attempts.map((a) => a.orderId)).size !== count
  )
    throw Error("Required flow population incomplete");
const trace = readFileSync(`${dir}/server-trace.jsonl`, "utf8")
  .trim()
  .split("\n")
  .map(JSON.parse);
const tags = new Set(campaign.attempts.map((a) => a.tag));
const rows = trace.filter((r) => tags.has(r.run));
const requestEnds = new Set(
  rows.filter((r) => r.kind === "request-end").map((r) => r.rid),
);
const totals = (xs) => ({
  sqlStarts: xs.filter((x) => x.kind === "sql-start").length,
  sqlEnds: xs.filter((x) => x.kind === "sql-end").length,
  sqlErrors: xs.filter((x) => x.kind === "sql-end" && !x.ok).length,
  commits: xs.filter((x) => x.kind === "sql-start" && x.verb === "COMMIT")
    .length,
});
const perAttempt = campaign.attempts.map((a) => {
  const rs = rows.filter((r) => r.run === a.tag);
  const close = rs.filter((r) => r.path.endsWith("/close"));
  const begin = close.find((r) => r.kind === "sql-start" && r.verb === "BEGIN");
  const commit =
    begin &&
    close.find(
      (r) => r.kind === "sql-start" && r.verb === "COMMIT" && r.at >= begin.at,
    );
  const commitEnd =
    commit &&
    close.find(
      (r) =>
        r.kind === "sql-end" && r.query === commit.query && r.at >= commit.at,
    );
  const phase = (name) =>
    close
      .filter((r) => r.kind === "phase-end" && r.phase === name)
      .map((r) => r.ms);
  const command = a.requests.filter((r) => r.path.endsWith("/close"));
  if (
    command.length !== 1 ||
    !command[0].bodySha256 ||
    !command[0].frozenCommand ||
    !command[0].paymentsArray
  )
    throw Error("Close command evidence incomplete");
  return {
    role: a.role,
    variant: a.variant,
    index: a.index,
    catalogInteractiveMs: a.catalogInteractiveMs,
    saveConfirmedMs: a.saveConfirmedMs,
    qrResolvedMs: a.qrResolvedMs,
    paymentReadyMs: a.paymentReadyMs,
    closeConfirmedMs: a.closeConfirmedMs,
    closeBodySha256: command[0].bodySha256,
    payments: command[0].paymentCount,
    httpRequests: a.requests.length,
    sql: totals(rs),
    observedFirstCloseWSBeginToCommitEndMs: commitEnd
      ? commitEnd.at - begin.at
      : null,
    firstCloseCommitDriverMs: commitEnd?.ms ?? null,
    closeRequestMs: close.find((r) => r.kind === "request-end")?.ms ?? null,
    transactionPhaseMs: phase("transaction")[0] ?? null,
    closeGuardMs: phase("module-guard"),
    afterGrantScheduleMs: phase("after-grant-schedule"),
    moduleEventsAftercommitMs: phase("module-events-aftercommit"),
    longTasks: a.browserMetrics.longTasks.length,
  };
});
const fields = [
  "catalogInteractiveMs",
  "saveConfirmedMs",
  "qrResolvedMs",
  "paymentReadyMs",
  "closeConfirmedMs",
  "observedFirstCloseWSBeginToCommitEndMs",
  "firstCloseCommitDriverMs",
  "closeRequestMs",
];
const cells = ["owner", "staff"].flatMap((role) =>
  ["none", "discount", "zero"].map((variant) => {
    const xs = perAttempt.filter(
      (a) => a.role === role && a.variant === variant,
    );
    if (xs.length !== 3) throw Error("Cell cardinality mismatch");
    return {
      role,
      variant,
      n: xs.length,
      medianMs: Object.fromEntries(
        fields.map((f) => [
          f,
          median(xs.map((a) => a[f]).filter((x) => x !== null)),
        ]),
      ),
    };
  }),
);
const inspectionName = readdirSync(dir)
  .filter((n) => /^flow-inspection-\d+\.json$/.test(n))
  .sort()
  .at(-1);
const inspection = read(inspectionName);
if (inspection.rows.length !== 21)
  throw Error("Expected 18campaign+3smoke durable rows");
const count = (xs, key) =>
  Object.fromEntries(
    [...new Set(xs.map((x) => x[key]))]
      .sort()
      .map((v) => [v, xs.filter((x) => x[key] === v).length]),
  );
const deliveries = inspection.rows.flatMap((r) => r.deliveries);
const outbox = inspection.rows.flatMap((r) => r.wallet_outbox);
const report = {
  method:
    "M0 descriptive:18independent flows,3per role/variant; no causal A/B or p95 confidence claim;3separate smokes; growing history, no ledger resets",
  source: campaign.source,
  buildSource: campaign.buildSource,
  buildId: campaign.buildId,
  freezeSha256: campaign.freezeSha256,
  flowFixtureSha256: campaign.flowFixtureSha256,
  startedAt: campaign.startedAt,
  finishedAt: campaign.finishedAt,
  camera: campaign.camera,
  totals: {
    validCampaign: 18,
    validSeparateSmokes: 3,
    failedBrowserAttempts: failed.attempts.length,
    browserErrors: campaign.attempts.reduce((n, a) => n + a.errors, 0),
    browserExternalRequests: campaign.attempts.reduce(
      (n, a) => n + a.external,
      0,
    ),
    ...totals(rows),
    requestStarts: rows.filter((r) => r.kind === "request-start").length,
    requestEnds: requestEnds.size,
  },
  cells,
  perAttempt,
  byRequestPath: Object.fromEntries(
    [...new Set(rows.map((r) => path(r.path)))].sort().map((p) => {
      const xs = rows.filter((r) => path(r.path) === p);
      return [
        p,
        {
          ...totals(xs),
          requestStarts: xs.filter((x) => x.kind === "request-start").length,
          requestEnds: xs.filter((x) => x.kind === "request-end").length,
          startsWithoutObservedFinish: xs.filter(
            (x) => x.kind === "request-start" && !requestEnds.has(x.rid),
          ).length,
          requestStatuses: count(
            xs.filter((x) => x.kind === "request-end"),
            "status",
          ),
        },
      ];
    }),
  ),
  durable: {
    ownClosedOrders: inspection.rows.length,
    saleEvents: inspection.rows.reduce((n, r) => n + r.sale_events, 0),
    payments: inspection.rows.reduce((n, r) => n + r.payment_count, 0),
    couponRedemptions: inspection.rows.reduce(
      (n, r) => n + r.coupon_redemptions,
      0,
    ),
    ledgerOrdersPerMembership: count(inspection.rows, "membership_orders"),
    deliveries: count(deliveries, "state"),
    walletOutbox: count(outbox, "status"),
    crossDecisions: count(
      inspection.rows.flatMap((r) => r.cross_decisions),
      "outcome",
    ),
  },
  exceptions: [
    {
      artifact: "flow-smoke-01.json",
      source: failed.source,
      valid: false,
      completed: failed.completed,
      attempts: failed.attempts.map((a) => ({
        role: a.role,
        variant: a.variant,
        stage: a.stage,
        valid: a.valid,
        failure: a.failure,
        writes: a.requests.filter((r) => r.method !== "GET").length,
      })),
      reason:
        "Early mobile action before real list; preserved, excluded from successful population",
    },
    {
      artifact: "flows-inspect-smoke-02.log",
      valid: false,
      reason:
        "Oracle expected decimal string but PostgreSQL JSONB emitted numeric14.4; SQL::text fixed representation; same3closed IDs reinspected read-only in02b, no repeated sales",
    },
  ],
  limits: [
    "18post-close GETlist requests have no observed response-finish before context close;144SQL completed, cancellation reason not instrumented; no claim of zero pending/cancelled requests",
    "Transaction phase hook absent:null; first observed WS BEGIN→first COMMIT-end is an observed bracket, not exclusive function CPU",
    "SQL totals by request include aftercommit work with the same request context; all COMMITs do not count sales",
    "afterGrant hook measures scheduling only; wallet/cross end-to-end delivery latency unobserved:null",
    "Wallet outbox suppressed, no physical push/device-delivery claim; recipes skipped because disabled is a durable business outcome, not a skipped required test",
    "Resource waterfalls/bytes/longtasks/navigation retained in private RAW; browser external count does not measure server egress",
    "Prepared warm CI DB and persistent local build/start process; synthetic unit fixtures; no weight control or hostingPROD claim",
  ],
  artifacts: Object.fromEntries(
    [
      "m0-flows-01.json",
      "flow-smoke-02.json",
      "flow-smoke-01.json",
      "flow-fixture.json",
      "fixture.json",
      "server-trace.jsonl",
      "freeze.json",
      "control-build-6f.tar.gz",
      "flows-setup-01.log",
      "flows-inspect-smoke-02.log",
      "flows-inspect-smoke-02b.log",
      "flows-inspect-campaign-01.log",
      inspectionName,
    ].map((n) => [n, hash(n)]),
  ),
};
writeFileSync(
  "tools/pos-measurement/flow-baseline.json",
  JSON.stringify(report, null, 2) + "\n",
);
writeFileSync(
  `${dir}/m0-flow-summary.json`,
  JSON.stringify(report, null, 2) + "\n",
  { mode: 0o600 },
);
process.stdout.write(
  JSON.stringify(
    { totals: report.totals, cells: report.cells, durable: report.durable },
    null,
    2,
  ) + "\n",
);
