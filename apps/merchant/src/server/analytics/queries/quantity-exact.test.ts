import { describe, expect, it } from "vitest";
import { inputFromRow } from "./index";
import { salesBasis } from "@mi-pasaporte/domain/analytics/monthly-finance";

const row = {
  currencyCode: "USD",
  today: "2026-10-18",
  locations: [],
  labels: [],
};
const tuple = (quantity: unknown, metric = "mass_sold_g") => [
  "2026-10-18",
  metric,
  "local",
  "product",
  "0",
  "",
  0,
  quantity,
  0,
];

describe("exact analytics quantity decoding", () => {
  it("retains 14 decimals, aggregate precision and every flat tuple in order", () => {
    const quantities = [
      "453.59237000000001",
      "453.59237000000002",
      "999999999999999999999.12345678901234",
    ];
    const input = inputFromRow({
      ...row,
      metrics: quantities.map((q) => tuple(q)),
    });
    expect(input.metrics.map((m) => m.quantityExact)).toEqual(quantities);
    expect(input.metrics[0].quantity).toBe(input.metrics[1].quantity);
    expect(
      salesBasis(
        input.metrics.slice(0, 2).map((m, i) => ({
          ...m,
          metric: i ? "mass_with_cost_g" : "mass_sold_g",
        })),
      ).complete,
    ).toBe(false);
  });

  it("restores grouped ordinals without collapsing repeated tuples", () => {
    const input = inputFromRow({
      ...row,
      metricGroups: [
        [
          "mass_with_cost_g",
          "north",
          "product",
          "",
          0,
          [[2, "2026-10-17", "0", "1.00000000000002", 0]],
        ],
        [
          "mass_sold_g",
          "center",
          "product",
          "",
          0,
          [
            [3, "2026-10-18", "0", "1.00000000000001", 0],
            [1, "2026-10-18", "0", "1.00000000000001", 0],
          ],
        ],
      ],
    });
    expect(input.metrics.map((m) => [m.locationId, m.quantityExact])).toEqual([
      ["center", "1.00000000000001"],
      ["north", "1.00000000000002"],
      ["center", "1.00000000000001"],
    ]);
  });

  it.each([0, 2, Number.MAX_SAFE_INTEGER])(
    "allows exact legacy safe integer %s",
    (quantity) => {
      expect(
        inputFromRow({ ...row, metrics: [tuple(quantity, "units_sold")] })
          .metrics[0].quantityExact,
      ).toBe(String(quantity));
    },
  );
  it.each([0.1, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, null, undefined])(
    "does not fabricate exact text from %s",
    (quantity) => {
      const metric = inputFromRow({ ...row, metrics: [tuple(quantity)] })
        .metrics[0];
      expect(metric).not.toHaveProperty("quantityExact");
      expect(salesBasis([metric]).complete).toBe(false);
    },
  );
  it("keeps malformed grouped ordinal rejection", () => {
    expect(() =>
      inputFromRow({
        ...row,
        metricGroups: [
          ["units_sold", null, null, "", 0, [[2, "2026-10-18", "0", "1", 0]]],
        ],
      }),
    ).toThrow("El resumen está incompleto.");
  });
});
