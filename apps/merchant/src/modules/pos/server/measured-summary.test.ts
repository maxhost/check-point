import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { buildFinancialAmountsFromSnapshots } from "@mi-pasaporte/domain/financial";
import {
  CONVERSION_VERSION,
  MASS_UNITS,
  decimalRational,
  exactSnapshotLineGross,
  parseMeasure,
} from "@mi-pasaporte/domain/measures";
import { fromExact } from "@mi-pasaporte/domain/financial/rational";
import {
  EMPTY_SUMMARY,
  SUMMARY_DENOMINATOR,
  measuredSummaryColumns,
  summaryAmounts,
} from "./measured-summary";

export const measuredCases = [
  {
    quantity: "1",
    unitPrice: "0.499",
    kind: "unit",
    quantityUnit: "unit",
    priceUnit: "unit",
  },
  {
    quantity: "0.000000001",
    unitPrice: "999999999.999999999",
    kind: "mass",
    quantityUnit: "lb",
    priceUnit: "g",
  },
  ...MASS_UNITS.flatMap((quantityUnit) =>
    MASS_UNITS.map((priceUnit) => ({
      quantity: "1.123456789",
      unitPrice: "0.123456789",
      kind: "mass",
      quantityUnit,
      priceUnit,
    })),
  ),
  {
    quantity: "2147483647",
    unitPrice: "0",
    kind: "unit",
    quantityUnit: "unit",
    priceUnit: "unit",
  },
  {
    quantity: "1",
    unitPrice: "9999999999.99",
    kind: "unit",
    quantityUnit: "unit",
    priceUnit: "unit",
  },
];
export function snapshotLines(cases = measuredCases) {
  return cases.map((v, position) => ({
    sourceLineId: `line-${position}`,
    position,
    quantity: v.quantity,
    unitPrice: v.unitPrice,
    measure: parseMeasure({
      kind: v.kind,
      quantityUnit: v.quantityUnit,
      priceUnit: v.priceUnit,
      conversionVersion: CONVERSION_VERSION,
    }),
  }));
}
// Independent oracle supplies exact snapshots, not the SQL coefficient implementation.
function projected(lines: ReturnType<typeof snapshotLines>) {
  const numerators = lines.map((l) => {
    const r = fromExact(
      exactSnapshotLineGross(l.quantity, l.unitPrice, l.measure),
    );
    expect(SUMMARY_DENOMINATOR % r.d).toBe(0n);
    return r.n * (SUMMARY_DENOMINATOR / r.d);
  });
  return {
    ...EMPTY_SUMMARY,
    lineCount: String(lines.length),
    numerator: String(numerators.reduce((s, n) => s + n, 0n)),
    maxNumerator: String(numerators.reduce((s, n) => (n > s ? n : s), 0n)),
  };
}

describe("0242 measured list projection", () => {
  it.each(["USD", "COP", "JPY", "CLP"])(
    "normalizes exact originals once in %s",
    (currencyCode) => {
      for (const line of snapshotLines()) {
        if (line.unitPrice === "9999999999.99" && currencyCode !== "USD") {
          expect(() =>
            summaryAmounts(projected([line]), currencyCode, 2),
          ).toThrow();
          expect(() =>
            buildFinancialAmountsFromSnapshots({
              currencyCode,
              discount: null,
              lines: [line],
            }),
          ).toThrow();
          continue;
        }
        expect(summaryAmounts(projected([line]), currencyCode, 2).total).toBe(
          buildFinancialAmountsFromSnapshots({
            currencyCode,
            discount: null,
            lines: [line],
          }).gross,
        );
      }
      const lines = snapshotLines(measuredCases.slice(0, 11));
      expect(summaryAmounts(projected(lines), currencyCode, 2).total).toBe(
        buildFinancialAmountsFromSnapshots({
          currencyCode,
          discount: null,
          lines,
        }).gross,
      );
    },
  );
  it("does not round 0.499 to USD before normalizing COP", () => {
    const summary = projected(snapshotLines(measuredCases.slice(0, 1)));
    expect(summaryAmounts(summary, "USD", 2).total).toBe("0.50");
    expect(summaryAmounts(summary, "COP", 2).total).toBe("0");
  });
  it("preserves historical cents and exact item count in V1", () => {
    const line = snapshotLines([
      {
        quantity: "2147483647",
        unitPrice: "0.01",
        kind: "unit",
        quantityUnit: "unit",
        priceUnit: "unit",
      },
    ]);
    expect(
      summaryAmounts(
        { ...projected(line), unitCount: "2147483647.000000000" },
        "COP",
        1,
      ),
    ).toMatchObject({ total: "21474836.47", itemCount: 2147483647 });
    expect(summaryAmounts(EMPTY_SUMMARY, "USD", 2)).toMatchObject({
      total: "0.00",
      lineCount: 0,
    });
  });
  it("fails safely before Number for invalid, measured and unsafe V1 counts", () => {
    for (const patch of [
      { invalid: true },
      { incompatible: true },
      { unitCount: "9007199254740992" },
      { numerator: "NaN" },
    ])
      expect(() =>
        summaryAmounts({ ...EMPTY_SUMMARY, ...patch }, "USD", 1),
      ).toThrow(
        expect.objectContaining({
          code: "pos_client_upgrade_required",
          status: 409,
        }),
      );
    expect(() =>
      summaryAmounts(
        {
          ...EMPTY_SUMMARY,
          numerator: String(1000000000000n * SUMMARY_DENOMINATOR),
        },
        "USD",
        2,
      ),
    ).toThrow();
  });
  it("projects integer sums with no SQL division, line arrays or monetary rounding", () => {
    const columns = measuredSummaryColumns({
      quantity: sql`q`,
      price: sql`p`,
      kind: sql`k`,
      quantityUnit: sql`qu`,
      priceUnit: sql`pu`,
      conversionVersion: sql`cv`,
    });
    const text = new PgDialect().sqlToQuery(
      sql`select ${sql.join(
        Object.values(columns).map((c) => c.sql),
        sql`, `,
      )}`,
    ).sql;
    expect(text).toContain("sum(");
    expect(text).not.toMatch(/\bround\s*\(|json_agg|array_agg|\//i);
    expect(decimalRational("0.499").n).toBe(499n);
  });
});
