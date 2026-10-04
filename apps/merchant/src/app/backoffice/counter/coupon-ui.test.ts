import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { CouponPanel } from "./coupon-panel";
import { DoneStage } from "./done-stage";
import { previewNetTotal, type CounterCouponState } from "./types";

const discount: CounterCouponState = {
  status: "selected",
  verdict: { valid: true },
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
            coupon: { label: "50%", discountAmount: "5.25", extraUnits: null },
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
      onRemove: () => {},
    };
    const selected = renderToStaticMarkup(
      createElement(CouponPanel, { state: discount, ...props }),
    );
    expect(selected).toContain("Cupón válido");
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

  it("shows the server's exact rejection message and keeps Quitar", () => {
    const invalid: CounterCouponState = {
      ...discount,
      verdict: {
        valid: false,
        code: "coupon_expired",
        message: "Este cupón venció el 03/11/2026.",
      },
    };
    expect(previewNetTotal(10.5, invalid, [], null)).toBe(10.5);
    const html = renderToStaticMarkup(
      createElement(CouponPanel, {
        state: invalid,
        busy: false,
        mode: "detailed",
        cart: [],
        productId: null,
        onProductId: () => {},
        onRemove: () => {},
      }),
    );
    expect(html).toContain("Cupón no válido");
    expect(html).toContain("Este cupón venció el 03/11/2026.");
    expect(html).toContain("Quitar");
    expect(html).not.toContain("El descuento se aplica al vender");
  });

  it("shows sale units and coupon extras separately in the ticket", () => {
    const html = renderToStaticMarkup(
      createElement(DoneStage, {
        result: {
          order: {
            unitsGranted: 1,
            balanceAfter: 9,
            kind: "stamps",
            grossTotal: "10.00",
            total: "10.00",
            coupon: {
              label: "2 sellos extra",
              discountAmount: "0.00",
              extraUnits: 2,
            },
          },
        },
        redeemed: null,
        displayName: "Ana",
        currencyCode: "USD",
        onNext: () => {},
      }),
    );
    expect(html).toContain("+1 sello por la venta");
    expect(html).toContain("+2 sellos del cupón");
    expect(html).toContain("Saldo: 9 sellos");
    expect(html).not.toContain("−$0");
  });
});
