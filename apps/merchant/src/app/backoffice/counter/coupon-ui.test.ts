import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { CouponPanel } from "./coupon-panel";
import { DoneStage } from "./done-stage";
import { previewNetTotal, type CounterCouponState } from "./types";

const discount: CounterCouponState = {
  status: "selected",
  coupon: {
    couponId: "c1",
    label: "50%",
    kind: "discount",
    rule: null,
    productId: null,
    productName: null,
    discountUnit: "percent",
    discountValue: "50.00",
    currencyCode: "USD",
    extraUnits: null,
    validUntil: "2026-10-04",
  },
};

describe("coupon UI (0149)", () => {
  it("previews points on the net and leaves the server as ticket authority", () => {
    expect(previewNetTotal(10.5, discount, [], null)).toBe(5.25);
    expect(previewNetTotal(10.5, { status: "none" }, [], null)).toBe(10.5);
    const html = renderToStaticMarkup(
      createElement(DoneStage, {
        result: {
          order: {
            unitsGranted: 1,
            balanceAfter: 7,
            kind: "stamps",
            grossTotal: "10.50",
            total: "5.25",
            coupon: { label: "50%", discountAmount: "5.25" },
          },
        },
        redeemed: null,
        displayName: "Ana",
        currencyCode: "USD",
        onNext: () => {},
      }),
    );
    expect(html).toContain("50%");
    expect(html).toContain("5,25");
    expect(html).toContain("10,50");
  });

  it("shows only the selected coupon and never an activation list for a hint", () => {
    const props = {
      busy: false,
      mode: "detailed",
      cart: [],
      productId: null,
      onProductId: () => {},
      onValidate: () => {},
      onRemove: () => {},
    };
    const selected = renderToStaticMarkup(
      createElement(CouponPanel, { state: discount, ...props }),
    );
    expect(selected).toContain("Cupón elegido");
    expect(selected).toContain("El descuento se aplica al vender");
    expect(selected).toContain("Quitar");
    expect(selected).not.toContain("Validar");
    const hint = renderToStaticMarkup(
      createElement(CouponPanel, {
        state: { status: "hint", count: 2 },
        ...props,
      }),
    );
    expect(hint).toContain("seleccionar uno en la app");
    expect(hint).not.toContain("<button");
  });
});
