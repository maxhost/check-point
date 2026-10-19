/** M1 paired resampling of marginal estimators; no filesystem effects on import. */
import { readFileSync, writeFileSync, lstatSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const SEED = 24220261018;
export const BOOTSTRAP = 10000;
export function rng(seed = SEED) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function sorted(values) {
  if (!values.length || values.some((v) => !Number.isFinite(v) || v < 0))
    throw Error("Finite nonnegative observations required");
  return [...values].sort((a, b) => a - b);
}
export function median(values) {
  const a = sorted(values),
    n = a.length;
  return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
}
export function p95(values) {
  const a = sorted(values);
  return a[Math.ceil(0.95 * a.length) - 1];
}
export function compare(pairs, { seed = SEED, iterations = BOOTSTRAP } = {}) {
  if (pairs.length < 2 || !Number.isInteger(iterations) || iterations < 100)
    throw Error("Paired population and bootstrap iterations required");
  const control = pairs.map((p) => p.control),
    candidate = pairs.map((p) => p.candidate);
  sorted(control);
  sorted(candidate);
  const random = rng(seed),
    deltas = { median: [], p95: [] };
  for (let i = 0; i < iterations; i++) {
    const a = [],
      b = [];
    for (let j = 0; j < pairs.length; j++) {
      const index = Math.floor(random() * pairs.length);
      a.push(control[index]);
      b.push(candidate[index]);
    }
    // Marginal medians/p95, NOT median/p95 of within-pair differences.
    deltas.median.push(median(b) - median(a));
    deltas.p95.push(p95(b) - p95(a));
  }
  const result = { n: pairs.length, seed, iterations };
  for (const [name, estimator] of [
    ["median", median],
    ["p95", p95],
  ]) {
    const draws = deltas[name].sort((a, b) => a - b),
      base = estimator(control);
    result[name] = {
      control: base,
      candidate: estimator(candidate),
      delta: estimator(candidate) - base,
      relativeDelta: base ? (estimator(candidate) - base) / base : null,
      ci95: [
        draws[Math.ceil(0.025 * iterations) - 1],
        draws[Math.ceil(0.975 * iterations) - 1],
      ],
    };
  }
  return result;
}
export function decision(result, { improvement = false, minimum = 30 } = {}) {
  if (result.n < minimum) return "INCONCLUSIVE";
  if (improvement)
    return result.median.ci95[1] < 0
      ? "PASS"
      : result.median.ci95[0] >= 0
        ? "FAIL"
        : "INCONCLUSIVE";
  if (
    ["median", "p95"].some(
      (name) =>
        result[name].ci95[0] > Math.max(result[name].control * 0.05, 50),
    )
  )
    return "FAIL";
  return ["median", "p95"].every(
    (name) => result[name].ci95[1] <= Math.max(result[name].control * 0.05, 50),
  )
    ? "PASS"
    : "INCONCLUSIVE";
}
export function analyze(report) {
  if (
    report.kind !== "pos-m1-list-results-v1" ||
    !report.complete ||
    report.attempts.some((a) => !a.valid || !a.warmup?.valid)
  )
    throw Error("Incomplete/failed campaign cannot produce gate evidence");
  if (
    report.plan?.length !== 240 ||
    report.attempts.length !== 240 ||
    new Set(report.attempts.map((a) => a.id)).size !== 240 ||
    report.attempts.some((a, i) =>
      ["id", "pair", "source", "role", "case", "population"].some(
        (key) => a[key] !== report.plan[i][key],
      ),
    )
  )
    throw Error(
      "All240 planned observations must match frozen schedule; warmups remain separate",
    );
  if (
    !report.serverInstrumentation ||
    report.serverInstrumentation.attempts.length !== 240 ||
    report.serverInstrumentation.attempts.some(
      (a) =>
        (a.population !== "detail-to-list" && (!a.requests || !a.sqlStart)) ||
        a.sqlStart !== a.sqlEnd ||
        a.sqlFailures,
    )
  )
    throw Error("Missing/incomplete/failing measured server instrumentation");
  const results = [];
  for (const role of ["owner", "staff"]) {
    const population = report.attempts.filter(
      (a) => a.role === role && a.population === "normal-full",
    );
    const ids = [...new Set(population.map((a) => a.pair))];
    const pairs = ids.map((pair) => {
      const rows = population.filter((a) => a.pair === pair);
      if (rows.length !== 2 || new Set(rows.map((a) => a.source)).size !== 2)
        throw Error("Missing/duplicated paired observation");
      return Object.fromEntries(rows.map((a) => [a.source, a.listUsableMs]));
    });
    if (pairs.length !== 30)
      throw Error("Recipe requires exactly30 normal pairs per role");
    const stats = compare(pairs);
    const assets = report.attempts.filter(
      (a) => a.role === role && a.population === "new-assets",
    );
    if (
      ["control", "candidate"].some(
        (s) => assets.filter((a) => a.source === s).length !== 10,
      )
    )
      throw Error("Missing new-assets population");
    results.push({
      role,
      ...stats,
      medianImprovement: decision(stats, { improvement: true }),
      listNonRegression: decision(stats),
      diagnostics: [
        "new-assets",
        "empty",
        "volume",
        "list-to-detail",
        "detail-to-list",
      ].map((population) => ({
        population,
        inferential: false,
        sources: Object.fromEntries(
          ["control", "candidate"].map((source) => {
            const rows = report.attempts.filter(
              (a) =>
                a.role === role &&
                a.population === population &&
                a.source === source,
            );
            if (rows.length !== (population === "new-assets" ? 10 : 5))
              throw Error("Incomplete diagnostic population");
            const values = rows.map((a) =>
              population === "list-to-detail"
                ? a.detailInteractiveMs
                : a.listUsableMs,
            );
            return [
              source,
              { n: values.length, median: median(values), p95: p95(values) },
            ];
          }),
        ),
      })),
    });
  }
  return {
    kind: "pos-m1-list-analysis-v1",
    recipeSha256: report.recipeSha256,
    freezeSha256: report.freezeSha256,
    results,
    complete0242: false,
    limits:
      "List cut only; critical routes/mutation/structural gates still required",
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const input = resolve(process.argv[2] ?? ""),
    output = resolve(process.argv[3] ?? ""),
    dir = dirname(input);
  if (
    !dir.startsWith("/private/tmp/checkpass-pos-0242/m1-") ||
    dirname(output) !== dir ||
    realpathSync(dir) !== dir ||
    lstatSync(dir).mode & 0o077 ||
    lstatSync(input).mode & 0o077 ||
    lstatSync(input).isSymbolicLink()
  )
    throw Error("Private M1 input/output namespace required");
  const report = analyze(JSON.parse(readFileSync(input, "utf8")));
  writeFileSync(output, JSON.stringify(report, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
  console.log(JSON.stringify(report));
}
