import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CouponBanner, CouponDone } from "./coupon-panel";

/**
 * Spec 0065 phase C — what the operator SEES. `renderToStaticMarkup`, no jsdom (the
 * repo's idiom). The guard that matters is the server's locked transaction; this pins
 * that the panel shows the coupon at all, and that it does not claim a balance moved.
 */

const coupon = {
  turnId: "33333333-3333-4333-8333-333333333333",
  label: "2x1 en picadas",
  campaignName: "Dormidos de septiembre",
  windowEnd: "2026-09-21T12:00:00.000Z",
};

describe("the coupon banner at the counter", () => {
  it("shows the label, the campaign, the expiry and the button", () => {
    const html = renderToStaticMarkup(
      createElement(CouponBanner, { coupon, busy: false, onRedeem: () => {} }),
    );
    expect(html).toContain("2x1 en picadas");
    expect(html).toContain("Dormidos de septiembre");
    expect(html).toContain("válido hasta 2026-09-21");
    expect(html).toContain("Canjear cupón");
    expect(html).not.toContain("disabled");
  });

  it("the day is CUT from the ISO string, never re-parsed into a local Date", () => {
    // A `new Date(...).toLocaleDateString()` here would move the expiry a day for
    // anyone west of Greenwich — the coupon would read as expiring the day before.
    const late = renderToStaticMarkup(
      createElement(CouponBanner, {
        coupon: { ...coupon, windowEnd: "2026-09-21T02:00:00.000Z" },
        busy: false,
        onRedeem: () => {},
      }),
    );
    expect(late).toContain("válido hasta 2026-09-21");
  });

  it("is disabled while a request is in flight", () => {
    const html = renderToStaticMarkup(
      createElement(CouponBanner, { coupon, busy: true, onRedeem: () => {} }),
    );
    expect(html).toContain("disabled");
  });
});

describe("the coupon done screen", () => {
  it("says what to hand over and that the balance did NOT move", () => {
    const html = renderToStaticMarkup(
      createElement(CouponDone, {
        redeemed: { coupon: { label: "2x1 en picadas", campaignName: "X" } },
        displayName: "Marcos",
        onNext: () => {},
      }),
    );
    expect(html).toContain("2x1 en picadas");
    expect(html).toContain("para Marcos");
    // A coupon does not touch points nor stamps; printing a balance would imply it did.
    expect(html).toContain("no descuenta puntos ni sellos");
    expect(html).not.toContain("Saldo:");
  });
});
