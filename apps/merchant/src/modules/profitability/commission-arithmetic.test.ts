import { describe, expect, it } from "vitest";
import {
  calculatePaymentCommission as calculate,
  parsePercent,
} from "./commission-arithmetic";
const fixed = (numerator: string) => ({
  numerator,
  denominator: "1",
  scale: 2 as const,
});
const base = {
  amount: "9.00",
  currencyCode: "USD",
  minorUnit: 2 as const,
  chargeShape: "percent_and_fixed" as const,
  percent: "2.500000",
  originalFixed: fixed("10"),
  fixedCurrencyCode: "USD",
};
describe("P1 commission settlement per transaction", () => {
  it("normalizes only the complete exact formula", () => {
    expect(calculate(base)).toMatchObject({
      commission: "0.33",
      originalCommission: { numerator: "65", denominator: "2", scale: 2 },
      normalizationAdjustment: { numerator: "1", denominator: "2", scale: 2 },
      configured: true,
      reasons: [],
    });
  });
  it("retains known components when another component is unconfigured", () => {
    expect(
      calculate({ ...base, percent: null, originalFixed: fixed("20") }),
    ).toMatchObject({
      commission: "0.20",
      configured: false,
      reasons: ["commission_unconfigured"],
    });
    expect(
      calculate({
        ...base,
        percent: "2.000000",
        originalFixed: null,
        fixedCurrencyCode: null,
      }),
    ).toMatchObject({ commission: "0.18", configured: false });
    expect(
      calculate({
        ...base,
        percent: null,
        originalFixed: null,
        fixedCurrencyCode: null,
      }),
    ).toMatchObject({ commission: "0.00", configured: false });
  });
  it("fixed compatibility uses its original even if a later currency would round it to zero", () => {
    expect(
      calculate({
        ...base,
        currencyCode: "COP",
        minorUnit: 0,
        originalFixed: fixed("10"),
      }),
    ).toMatchObject({
      commission: null,
      originalCommission: null,
      reasons: ["commission_currency_mismatch"],
    });
    expect(
      calculate({
        ...base,
        currencyCode: "COP",
        minorUnit: 0,
        amount: "100",
        percent: "2.000000",
        originalFixed: fixed("0"),
      }),
    ).toMatchObject({ commission: "2", configured: true, reasons: [] });
  });
  it("distinguishes known zero and none, and never caps a fixed fee to the payment", () => {
    expect(
      calculate({
        ...base,
        chargeShape: "none",
        percent: null,
        originalFixed: null,
      }),
    ).toMatchObject({ commission: "0.00", configured: true, reasons: [] });
    expect(
      calculate({
        ...base,
        amount: "0.01",
        percent: "0.000000",
        originalFixed: fixed("20"),
      }),
    ).toMatchObject({ commission: "0.20", configured: true });
  });
  it("rejects invalid or overprecise percentages without truncating", () => {
    for (const value of [
      "NaN",
      "Infinity",
      "-1",
      "100.000001",
      "1.0000001",
      "1e2",
      1,
    ])
      expect(() => parsePercent(value)).toThrow();
    expect(parsePercent("0")).toBe("0.000000");
    expect(parsePercent("100")).toBe("100.000000");
  });
});
