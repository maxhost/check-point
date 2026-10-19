import { describe, expect, it } from "vitest";
import { computeAccrual, computeAccrualFromMoney } from "./accrual";
import type { AccrualInput } from "./core";

const accrual: AccrualInput = {
  mode: "per_amount",
  grant: 1,
  blockAmount: "0.10",
};
describe("exact monetary accrual", () => {
  it("counts decimal blocks exactly while preserving legacy", () => {
    expect(computeAccrualFromMoney(accrual, "0.30")).toBe(3);
    expect(computeAccrual(accrual, 0.3)).toBe(2);
    expect(computeAccrualFromMoney({ ...accrual, grant: 7 }, "0.39")).toBe(21);
    expect(computeAccrualFromMoney(accrual, "0.00")).toBe(0);
  });
  it("accepts the normalized integer amounts of currencies with zero minor digits", () => {
    expect(computeAccrualFromMoney(accrual, "3")).toBe(30);
    expect(computeAccrualFromMoney(accrual, "0")).toBe(0);
  });
  it("retains flat per-purchase accrual even for zero", () => {
    expect(
      computeAccrualFromMoney(
        { mode: "per_purchase", grant: 3, blockAmount: null },
        "0.00",
      ),
    ).toBe(3);
  });
  it("checks the real int32 boundary before number conversion", () => {
    expect(
      computeAccrualFromMoney(
        { ...accrual, blockAmount: "0.01" },
        "21474836.47",
      ),
    ).toBe(2147483647);
    expect(() =>
      computeAccrualFromMoney(
        { ...accrual, blockAmount: "0.01" },
        "21474836.48",
      ),
    ).toThrow();
    expect(() =>
      computeAccrualFromMoney({ ...accrual, grant: 2147483647 }, "0.20"),
    ).toThrow();
  });
  it.each(["-0.10", "0.1", "0.300", "1e2", "NaN", "10000000000.00", "00.10"])(
    "rejects unnormalized money %s",
    (total) => {
      expect(() => computeAccrualFromMoney(accrual, total)).toThrow();
    },
  );
  it.each([0, -1, 0.5, NaN, Infinity, 2147483648])(
    "rejects invalid grant %s",
    (grant) => {
      expect(() =>
        computeAccrualFromMoney({ ...accrual, grant }, "0.00"),
      ).toThrow();
    },
  );
  it.each([null, "0.00", "-1.00", "0.001", "1e2"])(
    "rejects invalid block %s",
    (blockAmount) => {
      expect(() =>
        computeAccrualFromMoney({ ...accrual, blockAmount }, "0.00"),
      ).toThrow();
    },
  );
});
