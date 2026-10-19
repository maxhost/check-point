import { describe, expect, it } from "vitest";
import {
  buildFinancialAmounts,
  buildFinancialAmountsFromSnapshots,
  buildFinancialSettlementFromSnapshots,
} from "./settlement";
import { exact, fromExact, multiply, rational } from "./rational";
import { assertFinancialSettlement } from "./validate";
import { UNIT_MEASURE } from "../measures/mass";
import type { FinancialInputV2, ExactAmount } from "./types";
const origin = {
  type: "campaign_coupon" as const,
  sourceId: "c",
  campaignId: "campaign",
  benefitKind: "discount",
  scope: "order" as const,
};
const line = {
  sourceLineId: "mass",
  position: 0,
  unitPrice: "1",
  quantity: "3",
  measure: {
    kind: "mass" as const,
    quantityUnit: "g" as const,
    priceUnit: "lb" as const,
    conversionVersion: "mass-si-1" as const,
  },
};
const base: FinancialInputV2 = {
  currencyCode: "USD",
  lines: [line],
  discount: null,
};
function settle(input: FinancialInputV2) {
  const amounts = buildFinancialAmountsFromSnapshots(input);
  const result = buildFinancialSettlementFromSnapshots({
    ...input,
    payments: /[1-9]/.test(amounts.collected)
      ? [{ paymentId: "p", methodId: "cash", amount: amounts.collected }]
      : [],
  });
  assertFinancialSettlement(result);
  return result;
}
describe("internal exact measured discount", () => {
  it.each(["USD", "COP"])(
    "full nonterminating original closes with no payments in %s",
    (currencyCode) => {
      const input = { ...base, currencyCode };
      const gross = buildFinancialAmountsFromSnapshots(input).originals.gross;
      expect(gross.denominator).toBe("45359237");
      const result = settle({
        ...input,
        discount: { originalAmount: gross, origin },
      });
      expect(result.originals.net).toEqual(exact(rational(0n)));
      expect(result.collected).toBe(currencyCode === "USD" ? "0.00" : "0");
      expect(result.payments).toEqual([]);
      // Rounded display gross exceeds the rational source for USD.
      if (currencyCode === "USD")
        expect(() =>
          buildFinancialAmounts({
            ...input,
            discount: { amount: "0.01", origin },
          }),
        ).toThrow("invalid_financial_input");
    },
  );
  it.each(["USD", "COP"])(
    "retains partial originals and tiny/half-up values in %s",
    (currencyCode) => {
      for (const unitPrice of ["1", "0.000000001", "0.005", "0.5", "1.005"]) {
        const input = {
          ...base,
          currencyCode,
          lines: [{ ...line, unitPrice }],
        };
        const gross = fromExact(
          buildFinancialAmountsFromSnapshots(input).originals.gross,
        );
        const discount = exact(multiply(gross, rational(37n, 100n)));
        const result = settle({
          ...input,
          discount: { originalAmount: discount, origin },
        });
        expect(result.originals.discount).toEqual(discount);
        expect(result.originals.net).toEqual(
          exact(multiply(gross, rational(63n, 100n))),
        );
      }
      for (const [unitPrice, expected] of [
        ["0.005", currencyCode === "USD" ? "0.01" : "0"],
        ["0.5", currencyCode === "USD" ? "0.50" : "1"],
      ]) {
        expect(
          settle({
            ...base,
            currencyCode,
            lines: [
              { ...line, quantity: "1", unitPrice, measure: UNIT_MEASURE },
            ],
          }).collected,
        ).toBe(expected);
      }
    },
  );
  it("keeps exact-cent legacy amounts identical to V2 exact discounts", () => {
    const lines = [
      { sourceLineId: "u", position: 0, unitPrice: "1.25", quantity: 2 },
    ];
    const legacy = buildFinancialAmounts({
      currencyCode: "USD",
      lines,
      discount: { amount: "0.35", origin },
    });
    const measured = settle({
      ...base,
      lines: lines.map((l) => ({
        ...l,
        quantity: String(l.quantity),
        measure: UNIT_MEASURE,
      })),
      discount: { originalAmount: exact(rational(35n)), origin },
    });
    expect(measured).toMatchObject(legacy);
  });
  it("uses explicit historical snapshots without widening captures", () => {
    const input = {
      ...base,
      lines: [
        {
          ...line,
          quantity: "1",
          unitPrice: "9999999999.990000000",
          measure: UNIT_MEASURE,
        },
      ],
    };
    const gross = buildFinancialAmountsFromSnapshots(input).originals.gross;
    expect(
      settle({ ...input, discount: { originalAmount: gross, origin } })
        .payments,
    ).toEqual([]);
    expect(() => buildFinancialAmounts(input)).toThrow("invalid_price");
    expect(
      settle({
        ...base,
        lines: [{ ...line, unitPrice: "0" }],
        discount: { originalAmount: exact(rational(0n)), origin },
      }).payments,
    ).toEqual([]);
  });
  it.each([
    null,
    { numerator: "1", denominator: "0", scale: 2 },
    { numerator: "1", denominator: "-1", scale: 2 },
    { numerator: "01", denominator: "1", scale: 2 },
    { numerator: "1e2", denominator: "1", scale: 2 },
    { numerator: "1.5", denominator: "1", scale: 2 },
    { numerator: "-1", denominator: "1", scale: 2 },
    { numerator: "0", denominator: "2", scale: 2 },
    { numerator: "2", denominator: "2", scale: 2 },
    { numerator: "1", denominator: "1", scale: 3 },
    { numerator: 1, denominator: "1", scale: 2 },
    { numerator: "1", denominator: "01", scale: 2 },
  ])("rejects malformed exact input %#", (originalAmount) => {
    expect(() =>
      buildFinancialAmounts({
        ...base,
        discount: { originalAmount: originalAmount as ExactAmount, origin },
      }),
    ).toThrow("invalid_financial_input");
  });
  it("rejects ambiguous union, legacy exact branch, overdiscount, range and inconsistent origins", () => {
    const value = exact(rational(0n));
    for (const discount of [
      { originalAmount: value, amount: "0", origin },
      { origin },
      { originalAmount: value, origin: null },
      { originalAmount: value },
      { originalAmount: value, origin: { ...origin, sourceId: 123 } },
      { originalAmount: value, origin: { ...origin, type: "other" } },
      { originalAmount: undefined, origin },
      {
        originalAmount: value,
        origin: { ...origin, scope: "order", targetSourceLineId: "mass" },
      },
      {
        originalAmount: value,
        origin: { ...origin, scope: "line", targetSourceLineId: "absent" },
      },
      { originalAmount: value, origin: { ...origin, campaignId: "" } },
      { originalAmount: exact(rational(1n)), origin },
    ])
      expect(() =>
        buildFinancialAmounts({ ...base, discount } as FinancialInputV2),
      ).toThrow("invalid_financial_input");
    expect(() =>
      buildFinancialAmounts({
        ...base,
        discount: { originalAmount: exact(rational(1000000000000n)), origin },
      }),
    ).toThrow("amount_out_of_range");
    expect(() =>
      buildFinancialAmounts({
        ...base,
        lines: [
          { sourceLineId: "u", position: 0, quantity: 1, unitPrice: "1" },
        ],
        discount: { originalAmount: value, origin },
      } as unknown as FinancialInputV2),
    ).toThrow("invalid_financial_input");
  });
  it("does not impose a new digit limit on a valid canonical kernel original", () => {
    const denominator = 10n ** 200n + 1n;
    const originalAmount = exact(rational(1n, denominator));
    expect(
      settle({ ...base, discount: { originalAmount, origin } }).originals
        .discount,
    ).toEqual(originalAmount);
  });
});
