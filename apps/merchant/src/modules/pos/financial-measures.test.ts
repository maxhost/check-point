import { describe, expect, it } from "vitest";
import {
  buildFinancialAmounts,
  buildFinancialSettlement,
  buildFinancialAmountsFromSnapshots,
  buildFinancialSettlementFromSnapshots,
  type FinancialInput,
  type FinancialInputV2,
  type DiscountOrigin,
} from "@mi-pasaporte/domain/financial";
import { assertFinancialSettlement } from "@mi-pasaporte/domain/financial/validate";
import {
  UNIT_MEASURE,
  CONVERSION_VERSION,
  type LineMeasure,
} from "@mi-pasaporte/domain/measures";
const mass = (
  quantityUnit: "kg" | "lb" | "g",
  priceUnit = quantityUnit,
): LineMeasure => ({
  kind: "mass",
  quantityUnit,
  priceUnit,
  conversionVersion: CONVERSION_VERSION,
});
const line = (
  quantity = "1",
  unitPrice = "1",
  measure = UNIT_MEASURE,
  position = 0,
) => ({
  sourceLineId: `l${position}`,
  position,
  quantity,
  unitPrice,
  measure,
});
const input = (...lines: FinancialInputV2["lines"]): FinancialInputV2 => ({
  currencyCode: "USD",
  lines,
  discount: null,
});
const origin: DiscountOrigin = {
  type: "campaign_coupon",
  sourceId: "coupon",
  scope: "order",
};
const settle = (v: FinancialInputV2) => {
  const amounts = buildFinancialAmounts(v);
  const result = buildFinancialSettlement({
    ...v,
    payments:
      amounts.collected === (v.currencyCode === "USD" ? "0.00" : "0")
        ? []
        : [{ paymentId: "p", methodId: "cash", amount: amounts.collected }],
  });
  expect(() => assertFinancialSettlement(result)).not.toThrow();
  return result;
};
describe("0242 measured financial settlement", () => {
  it.each([
    [
      "1",
      "1",
      mass("lb", "g"),
      "453.59",
      { numerator: "45359237", denominator: "1000", scale: 2 },
    ],
    [
      "2",
      "4",
      mass("lb"),
      "8.00",
      { numerator: "800", denominator: "1", scale: 2 },
    ],
    [
      "250",
      "0.01",
      mass("g"),
      "2.50",
      { numerator: "250", denominator: "1", scale: 2 },
    ],
    [
      "1",
      "0.000000001",
      mass("g"),
      "0.00",
      { numerator: "1", denominator: "10000000", scale: 2 },
    ],
    [
      "1",
      "1",
      mass("g", "lb"),
      "0.00",
      { numerator: "10000000", denominator: "45359237", scale: 2 },
    ],
  ] as const)(
    "retains originals for %s at %s",
    (quantity, price, measure, expected, original) => {
      const v = settle(input(line(quantity, price, measure)));
      expect(v.collected).toBe(expected);
      expect(v.originals.gross).toEqual(original);
    },
  );
  it("equivalent g/kg/lb captures produce identical money and provenance", () => {
    const outputs = [
      ["2", "lb"],
      ["907.18474", "g"],
      ["0.90718474", "kg"],
    ].map(([quantity, unit]) =>
      settle(input(line(quantity, "4", mass(unit as "lb", "lb")))),
    );
    expect(outputs[1]).toEqual(outputs[0]);
    expect(outputs[2]).toEqual(outputs[0]);
  });
  it.each(["USD", "COP"])(
    "aggregates subcentavo originals and closes mixed discounts in %s",
    (currencyCode) => {
      const v = settle({
        ...input(
          line("1", "0.004", UNIT_MEASURE, 2),
          line("1", "0.004", mass("g"), 0),
          line("1", "1.6", mass("kg"), 1),
        ),
        currencyCode,
        discount: { amount: "0.01", origin },
      });
      expect(v.lines.map((l) => l.sourceLineId)).toEqual(["l0", "l1", "l2"]);
      expect(v.originals.gross).toEqual({
        numerator: "804",
        denominator: "5",
        scale: 2,
      });
      expect(v.collected).toBe(currencyCode === "USD" ? "1.60" : "2");
    },
  );
  it.each(["USD", "COP"])(
    "supports stored zero and full discount with no payment in %s",
    (currencyCode) => {
      for (const unitPrice of ["0", "0.6"]) {
        const v = settle({
          ...input(line("1", unitPrice, mass("g"))),
          currencyCode,
          discount: { amount: unitPrice, origin },
        });
        expect(v.payments).toEqual([]);
      }
    },
  );
  it("allocates an amount discount only to the chosen measured source", () => {
    const v = settle({
      ...input(line("250", "0.01", mass("g")), line("2", "4", mass("lb"), 1)),
      discount: {
        amount: "1.00",
        origin: { ...origin, scope: "line", targetSourceLineId: "l1" },
      },
    });
    expect(v.lines.map((l) => l.money.discount)).toEqual(["0.00", "1.00"]);
    expect(v.lines[0].discountOrigin).toBeNull();
    expect(v.collected).toBe("9.50");
  });
  it("keeps normalized zero payments as audit originals and rejects duplicate methods", () => {
    const v = {
      ...input(line("1", "1", mass("g"))),
      currencyCode: "COP",
      payments: [
        { paymentId: "a", methodId: "cash", amount: "0.1" },
        { paymentId: "b", methodId: "card", amount: "0.9" },
      ],
    };
    const result = buildFinancialSettlement(v);
    assertFinancialSettlement(result);
    expect(result.paymentOriginals.map((p) => p.effective)).toEqual([
      false,
      true,
    ]);
    expect(() =>
      buildFinancialSettlement({
        ...v,
        payments: v.payments.map((p) => ({ ...p, methodId: "cash" })),
      }),
    ).toThrow("duplicate_payment_method");
    expect(() =>
      buildFinancialSettlement({ ...v, payments: [v.payments[0]] }),
    ).toThrow("payment_sum_mismatch");
  });
  it.each([
    [line("1e3"), "invalid_quantity"],
    [line("0.5"), "invalid_quantity"],
    [line("1000000000"), "invalid_quantity"],
    [line("0"), "invalid_quantity"],
    [line("1", "1e2"), "invalid_price"],
    [line("1", "0.0000000001"), "invalid_price"],
    [line("1", "1000000000"), "invalid_price"],
    [
      { ...line(), measure: { ...UNIT_MEASURE, quantityUnit: "g" } },
      "invalid_measure",
    ],
    [{ ...line(), measure: undefined }, "invalid_measure"],
    [{ ...line(), quantity: 1, measure: null }, "invalid_quantity"],
    [
      { sourceLineId: "l0", position: 0, quantity: "1", unitPrice: "1" },
      "invalid_financial_input",
    ],
    [line("999999999", "999999999"), "amount_out_of_range"],
  ])("rejects invalid measured input %#", (invalid, code) => {
    expect(() =>
      buildFinancialAmounts(
        input(invalid as FinancialInputV2["lines"][number]),
      ),
    ).toThrow(code as string);
  });
  it("rejects aggregate and normalized overflow with both public contexts", () => {
    for (const build of [
      buildFinancialAmounts,
      buildFinancialAmountsFromSnapshots,
    ]) {
      expect(() =>
        build(
          input(
            line("10", "999999999"),
            line("10", "999999999", UNIT_MEASURE, 1),
          ),
        ),
      ).toThrow("amount_out_of_range");
      expect(() =>
        build({ ...input(line("10", "999999999.99")), currencyCode: "COP" }),
      ).toThrow("amount_out_of_range");
    }
  });
  it("keeps explicit snapshot legacy extremes without widening captures or mass", () => {
    const highPrice = input(line("1", "9999999999.990000000"));
    const result = buildFinancialSettlementFromSnapshots({
      ...highPrice,
      payments: [{ paymentId: "p", methodId: "cash", amount: "9999999999.99" }],
    });
    assertFinancialSettlement(result);
    expect(result.collected).toBe("9999999999.99");
    expect(() => buildFinancialAmounts(highPrice)).toThrow("invalid_price");
    expect(() =>
      buildFinancialAmountsFromSnapshots(
        input(line("1", "9999999999.99", mass("g"))),
      ),
    ).toThrow("invalid_price");
    const highCount = input(line("2147483647.000000000", "0.01"));
    expect(buildFinancialAmountsFromSnapshots(highCount).collected).toBe(
      "21474836.47",
    );
    expect(() => buildFinancialAmounts(highCount)).toThrow("invalid_quantity");
    expect(() =>
      buildFinancialAmountsFromSnapshots(
        input(line("2147483647", "0", mass("g"))),
      ),
    ).toThrow("invalid_quantity");
    expect(() =>
      buildFinancialAmountsFromSnapshots(input(line("2147483648", "0"))),
    ).toThrow("invalid_quantity");
  });
  it("rejects payment overflow and durable operational/original overflow", () => {
    const v = input(line());
    expect(() =>
      buildFinancialSettlement({
        ...v,
        payments: [{ paymentId: "p", methodId: "cash", amount: "10000000000" }],
      }),
    ).toThrow("amount_out_of_range");
    const result = settle(v);
    for (const invalid of [
      { ...result, gross: "10000000000.00" },
      {
        ...result,
        originals: {
          ...result.originals,
          gross: { numerator: "1000000000000", denominator: "1", scale: 2 },
        },
      },
      {
        ...result,
        lines: result.lines.map((l) => ({
          ...l,
          money: { ...l.money, net: "10000000000.00" },
        })),
      },
    ])
      expect(() => assertFinancialSettlement(invalid)).toThrow(
        "invalid_financial_input",
      );
  });
  it("preserves safe-integer legacy input without imposing the snapshot INT32 bound", () => {
    const legacy: FinancialInput = {
      currencyCode: "USD",
      lines: [
        {
          sourceLineId: "x",
          position: 0,
          unitPrice: "0",
          quantity: Number.MAX_SAFE_INTEGER,
        },
      ],
      discount: null,
    };
    expect(
      buildFinancialSettlement({ ...legacy, payments: [] }).collected,
    ).toBe("0.00");
    expect(() =>
      buildFinancialAmounts({
        ...legacy,
        lines: [{ ...legacy.lines[0], quantity: 1.5 }],
      }),
    ).toThrow("invalid_financial_input");
    expect(() =>
      buildFinancialAmounts({
        ...legacy,
        lines: [{ ...legacy.lines[0], unitPrice: "10000000000", quantity: 1 }],
      }),
    ).toThrow("amount_out_of_range");
  });
});
