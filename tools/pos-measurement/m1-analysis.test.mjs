import test from "node:test";
import assert from "node:assert/strict";
import { compare, median, p95, decision, analyze, rng } from "./m1-analyze.mjs";
import { schedule, validateEndpoint, hash } from "./m1.mjs";
import { validateOpenDetail } from "./m1-browser.mjs";

test("nearest-rank p95 and conventional even median", () => {
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(p95(Array.from({ length: 20 }, (_, i) => i + 1)), 19);
  assert.equal(p95(Array.from({ length: 30 }, (_, i) => i + 1)), 29);
  assert.throws(() => median([NaN]));
  assert.throws(() => p95([]));
});
test("paired resampling preserves constant paired shift at every marginal quantile", () => {
  const pairs = Array.from({ length: 30 }, (_, i) => ({
    control: 1000 + i * 31,
    candidate: 900 + i * 31,
  }));
  const result = compare(pairs);
  assert.deepEqual(result.median.ci95, [-100, -100]);
  assert.deepEqual(result.p95.ci95, [-100, -100]);
  assert.equal(decision(result, { improvement: true }), "PASS");
  assert.equal(decision(result), "PASS");
});
test("marginal median delta differs from median of paired deltas", () => {
  const pairs = [
    { control: 1, candidate: 100 },
    { control: 100, candidate: 101 },
    { control: 101, candidate: 1 },
  ];
  assert.equal(compare(pairs, { iterations: 100 }).median.delta, 0);
  assert.equal(
    median(pairs.map((p) => p.candidate - p.control).map((n) => n + 100)) - 100,
    1,
  );
});
test("tail uncertainty cannot be hidden by median improvement", () => {
  const pairs = Array.from({ length: 30 }, (_, i) => ({
    control: 1000,
    candidate: i < 28 ? 800 : 3000,
  }));
  const a = compare(pairs),
    b = compare(pairs);
  assert.deepEqual(a, b);
  assert.equal(a.median.delta, -200);
  assert.equal(decision(a), "INCONCLUSIVE");
  assert.ok(a.p95.ci95[1] > 50);
});
test("invalid/incomplete/duplicate populations fail closed", () => {
  assert.throws(() =>
    compare([
      { control: 1, candidate: NaN },
      { control: 2, candidate: 3 },
    ]),
  );
  assert.throws(() =>
    analyze({ kind: "pos-m1-list-results-v1", complete: false, attempts: [] }),
  );
  assert.throws(() =>
    analyze({ kind: "pos-m1-list-results-v1", complete: true, attempts: [] }),
  );
});
test("ABBA schedule is balanced, distinct and deterministic, separate diagnostics/assets", () => {
  const a = schedule(),
    b = schedule();
  assert.deepEqual(a, b);
  for (const role of ["owner", "staff"]) {
    const normal = a.filter(
      (x) => x.role === role && x.population === "normal-full",
    );
    assert.equal(normal.length, 60);
    for (let i = 0; i < normal.length; i += 4)
      assert.deepEqual(
        normal.slice(i, i + 4).map((x) => x.source),
        ["control", "candidate", "candidate", "control"],
      );
    assert.equal(new Set(normal.map((x) => x.pair)).size, 30);
    for (const source of ["control", "candidate"])
      assert.equal(
        a.filter(
          (x) =>
            x.role === role &&
            x.population === "new-assets" &&
            x.source === source,
        ).length,
        10,
      );
    for (const population of [
      "list-to-detail",
      "detail-to-list",
      "empty",
      "volume",
    ])
      assert.equal(
        a.filter((x) => x.role === role && x.population === population).length,
        10,
      );
  }
  assert.equal(new Set(a.map((x) => x.id)).size, a.length);
  assert.equal(rng()(), rng()());
});
test("endpoint validation always blocks PROD including pooler aliases", () => {
  const blocked = hash("ep-hello").slice(0, 12);
  assert.throws(() =>
    validateEndpoint("postgres://u:p@example.com/db", blocked, "zzz"),
  );
  assert.throws(() =>
    validateEndpoint(
      "postgres://u:p@ep-hello-pooler.us-east-2.aws.neon.tech/db",
      blocked,
      blocked,
    ),
  );
  assert.throws(() =>
    validateEndpoint(
      "postgres://u:p@ep-hello.us-east-2.aws.neon.tech/db",
      "unused",
      "wrong",
    ),
  );
  assert.equal(
    validateEndpoint(
      "postgres://u:p@ep-hello-pooler-rvr.us-east-2.aws.neon.tech/db",
      "different",
      blocked,
    ),
    blocked,
  );
});
test("unambiguous regression is FAIL and insufficient population never PASS", () => {
  const pairs = Array.from({ length: 30 }, () => ({
    control: 1000,
    candidate: 1500,
  }));
  assert.equal(decision(compare(pairs)), "FAIL");
  assert.equal(decision(compare(pairs), { improvement: true }), "FAIL");
  assert.equal(decision(compare(pairs.slice(0, 5))), "INCONCLUSIVE");
});
test("open-review evidence rejects incorrect snapshots even when catalog contains all names", () => {
  const fixture = {
    orders: ["o0"],
    locations: ["l0"],
    linesPerOrder: 8,
    lineIds: [Array.from({ length: 8 }, (_, i) => `line${i}`)],
    products: Array.from({ length: 120 }, (_, i) => `p${i}`),
  };
  const value = {
    id: "o0",
    status: "open",
    tableLabel: "M1 000",
    orderLabel: "M1 000",
    location: { id: "l0", name: "Centro" },
    total: "16.00",
    items: Array.from({ length: 8 }, (_, i) => ({
      lineId: `line${i}`,
      productId: `p${i}`,
      name: `Producto ${String(i).padStart(4, "0")}`,
      quantity: "1",
      unitPrice: "2.00",
      lineTotal: "2.00",
      measure: {
        kind: "unit",
        quantityUnit: "unit",
        priceUnit: "unit",
        conversionVersion: "mass-si-1",
      },
    })),
  };
  assert.equal(validateOpenDetail(value, fixture, "candidate"), true);
  assert.equal(validateOpenDetail(value, fixture, "control"), true);
  const legacy = structuredClone(value);
  legacy.items.forEach((item) => {
    delete item.measure;
  });
  assert.equal(validateOpenDetail(legacy, fixture, "control"), true);
  assert.equal(validateOpenDetail(legacy, fixture, "candidate"), false);
  for (const field of [
    "lineId",
    "productId",
    "name",
    "quantity",
    "unitPrice",
    "lineTotal",
  ]) {
    const changed = structuredClone(value);
    changed.items[0][field] = "wrong";
    assert.equal(
      validateOpenDetail(changed, fixture, "candidate"),
      false,
      field,
    );
    assert.equal(validateOpenDetail(changed, fixture, "control"), false, field);
  }
  for (const field of [
    "kind",
    "quantityUnit",
    "priceUnit",
    "conversionVersion",
  ]) {
    const changed = structuredClone(value);
    changed.items[0].measure[field] = "wrong";
    assert.equal(
      validateOpenDetail(changed, fixture, "candidate"),
      false,
      field,
    );
  }
  const missing = structuredClone(value);
  missing.items.pop();
  assert.equal(validateOpenDetail(missing, fixture, "candidate"), false);
});
