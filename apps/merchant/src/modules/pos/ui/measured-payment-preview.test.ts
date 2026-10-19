import { describe, it, expect } from "vitest";
import {
  paymentOrder,
  paymentResolved,
  paymentCoupon,
} from "../../../../../../tests/e2e/support/pos-measured-payment-fixture";
import { measuredPaymentPreview } from "./measured-payment-preview";
import type { PosCouponV2 } from "../contracts";
function resolved(coupon: Partial<PosCouponV2>) {
  return {
    ...paymentResolved,
    couponState: {
      status: "selected" as const,
      coupon: { ...paymentCoupon, ...coupon },
      verdict: { valid: true as const },
    },
  };
}
describe("exact measured payment preview", () => {
  it("uses original nonterminating mass and shared amounts rather than lineTotal", () => {
    const order = structuredClone(paymentOrder);
    order.total = "999999";
    order.items[2].lineTotal = "99999";
    expect(measuredPaymentPreview(order, null).amounts?.collected).toBe("4.01");
    expect(measuredPaymentPreview(order, resolved({})).amounts?.collected).toBe(
      "3.01",
    );
  });
  it.each(["free_product", "two_for_one"] as const)(
    "rejects explicit mass %s without switching target, allows exclusion and unit mixture",
    (kind) => {
      const r = resolved({ kind, productId: "mass" });
      expect(measuredPaymentPreview(paymentOrder, r, "grams").error).toContain(
        "por peso",
      );
      expect(
        measuredPaymentPreview(paymentOrder, r, "grams", true).amounts
          ?.collected,
      ).toBe("4.01");
      const own = resolved({ kind, productId: "coffee" });
      expect(
        measuredPaymentPreview(paymentOrder, own, "old").amounts?.collected,
      ).toBe("2.01");
      expect(
        measuredPaymentPreview(paymentOrder, own, "grams").canConfirm,
      ).toBe(false);
    },
  );
  it("selects stable source snapshots, coupon product prevails", () => {
    const order = structuredClone(paymentOrder);
    order.items.push({ ...order.items[0], lineId: "second", unitPrice: "3" });
    expect(
      measuredPaymentPreview(
        order,
        resolved({ kind: "free_product", productId: "coffee" }),
        "second",
      ).amounts?.discount,
    ).toBe("3.00");
  });
  it("fixed/percentage mass and net zero preserve per_purchase accrual", () => {
    const r = resolved({
      discountUnit: "amount",
      discountValue: "20",
      currencyCode: "USD",
    });
    r.program = {
      ...r.program,
      kind: "stamps",
      accrual: { mode: "per_purchase", grant: 1, blockAmount: null },
    };
    const preview = measuredPaymentPreview(paymentOrder, r);
    expect(preview.amounts?.collected).toBe("0.00");
    expect(preview.baseUnits).toBe(1);
    expect(preview.canConfirm).toBe(true);
  });
  it("keeps partial buffers invalid and computes exact normalized currency0/2 change", () => {
    expect(
      measuredPaymentPreview(paymentOrder, null, null, false, "4,").canConfirm,
    ).toBe(false);
    expect(
      measuredPaymentPreview(paymentOrder, null, null, false, "4,02").change,
    ).toBe("0.01");
    expect(
      measuredPaymentPreview(paymentOrder, null, null, false, "3.99").missing,
    ).toBe("0.02");
    const cop = {
      ...paymentOrder,
      business: { ...paymentOrder.business, currencyCode: "COP" },
    };
    expect(measuredPaymentPreview(cop, null, null, false, "4.49").change).toBe(
      "0",
    );
    expect(measuredPaymentPreview(cop, null, null, false, "4.50").change).toBe(
      "1",
    );
  });
  it("retains positive nonterminating subminor originals while collecting zero", () => {
    const order = structuredClone(paymentOrder);
    order.items = [{ ...order.items[2], quantity: "0.001", unitPrice: "0.01" }];
    const preview = measuredPaymentPreview(order, null);
    expect(preview.amounts?.collected).toBe("0.00");
    expect(preview.amounts?.originals.gross.numerator).not.toBe("0");
    expect(preview.amounts?.originals.gross.denominator).not.toBe("1");
  });
  it("keeps old high unit snapshots trusted", () => {
    const order = structuredClone(paymentOrder);
    order.items = [
      { ...order.items[0], quantity: "1000000000", unitPrice: "0.01" },
    ];
    expect(measuredPaymentPreview(order, null).amounts?.collected).toBe(
      "10000000.00",
    );
  });
});
