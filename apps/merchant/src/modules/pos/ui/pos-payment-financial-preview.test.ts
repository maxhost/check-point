import { describe, expect, it } from "vitest";
import type { ResolveResponse } from "../../../app/backoffice/counter/types";
import type { PosOrder } from "./pos-types";
import { paymentPreview } from "./pos-payment-preview";
const order = (price: string): PosOrder => ({
  id: "order",
  version: 1,
  status: "open",
  tableLabel: "Servicio",
  note: null,
  location: null,
  business: { name: "Comercio", currencyCode: "COP" },
  items: [
    {
      lineId: "first",
      productId: "product",
      name: "Servicio",
      unitPrice: price,
      quantity: 1,
      lineTotal: price,
    },
  ],
  total: price,
  createdAt: "",
  createdBy: "",
  closedAt: null,
  closedBy: null,
  sale: null,
});
const resolved = (value: string): ResolveResponse => ({
  consumer: { displayName: "Ana" },
  membership: {
    id: "membership",
    pointsBalance: 0,
    stampsCount: 0,
    justEnrolled: false,
  },
  program: {
    id: "program",
    kind: "points",
    redeemAllowInsufficient: false,
    accrual: { mode: "per_amount", grant: 1, blockAmount: 1 },
    cardDesign: {
      backgroundColor: null,
      backgroundColor2: null,
      gradientAngle: null,
      borderColor: null,
    },
  },
  catalog: {
    products: [],
    categories: [],
    habitualProductIds: [],
    lastPurchase: null,
  },
  rewards: [],
  couponState: {
    status: "selected",
    verdict: { valid: true },
    coupon: {
      couponId: "coupon",
      label: "Descuento",
      kind: "discount",
      rule: null,
      productId: null,
      productName: null,
      discountUnit: "amount",
      discountValue: value,
      currencyCode: "COP",
      extraUnits: null,
      validUntil: "2027-01-01",
    },
  },
});

describe("P1 review shares normalized server settlement", () => {
  it("COP10.40 minus0.60 charges10 and shows the original-net adjustment0.20", () => {
    expect(paymentPreview(order("10.40"), resolved("0.60"))).toMatchObject({
      grossCents: 1000,
      discountCents: 100,
      netCents: 1000,
      collectedAmount: "10",
      roundingAdjustmentCents: 20,
      baseUnits: 10,
      canConfirm: true,
    });
  });
  it("a fully covered fractional sale requires no payment and no received amount", () => {
    expect(paymentPreview(order("0.60"), resolved("0.60"))).toMatchObject({
      grossCents: 100,
      discountCents: 100,
      netCents: 0,
      collectedAmount: "0",
      baseUnits: 0,
      canConfirm: true,
    });
  });
  it("fractional COP prices without coupons still close after rounding", () => {
    expect(paymentPreview(order("10.40"), null)).toMatchObject({
      netCents: 1000,
      collectedAmount: "10",
      roundingAdjustmentCents: -40,
      canConfirm: true,
    });
  });
});
