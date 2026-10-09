import { describe, expect, it } from "vitest";
import type { ResolveResponse, CounterCoupon } from "../counter/types";
import type { PosOrder } from "./pos-types";
import { paymentPreview } from "./pos-payment-preview";
const order: PosOrder = {
  id: "a",
  version: 1,
  status: "open",
  tableLabel: "Mesa",
  location: null,
  business: { name: "Café", currencyCode: "USD" },
  items: [
    {
      lineId: "l",
      productId: "p",
      name: "Café",
      unitPrice: "11.58",
      quantity: 1,
      lineTotal: "11.58",
    },
  ],
  total: "11.58",
  createdAt: "",
  createdBy: "",
  closedAt: null,
  closedBy: null,
  sale: null,
};
const customer: ResolveResponse = {
  consumer: { displayName: "Ana" },
  membership: {
    id: "m",
    pointsBalance: 0,
    stampsCount: 0,
    justEnrolled: false,
  },
  program: {
    id: "p",
    kind: "stamps",
    redeemAllowInsufficient: false,
    accrual: { mode: "per_purchase", grant: 1, blockAmount: null },
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
  couponState: { status: "none" },
};
const coupon: CounterCoupon = {
  couponId: "c",
  label: "Oferta",
  kind: "discount",
  rule: null,
  productId: null,
  productName: null,
  discountUnit: "percent",
  discountValue: "10",
  currencyCode: null,
  extraUnits: null,
  validUntil: "2027-01-01",
};
const withCoupon = (patch: Partial<CounterCoupon> = {}) =>
  ({
    ...customer,
    couponState: {
      status: "selected",
      verdict: { valid: true },
      coupon: { ...coupon, ...patch },
    },
  }) as ResolveResponse;
describe("POS 0183: preview from saved snapshots", () => {
  it.each([
    [20, 842, 0, true],
    [11.58, 0, 0, true],
    [10, 0, 158, false],
    [null, null, null, true],
  ] as const)("recibido %s", (received, change, missing, confirm) => {
    expect(paymentPreview(order, null, null, null, received)).toMatchObject({
      grossCents: 1158,
      netCents: 1158,
      changeCents: change,
      missingCents: missing,
      canConfirm: confirm,
    });
  });
  it.each([-1, NaN, Infinity, 1.234])("rechaza recibido %s", (value) => {
    expect(paymentPreview(order, null, null, null, value).canConfirm).toBe(
      false,
    );
  });
  it("10%% of 10.05 is 1.01; 1 point per 2 on 9.04 grants 4", () => {
    const client = withCoupon();
    client.program = {
      ...client.program,
      kind: "points",
      accrual: { mode: "per_amount", grant: 1, blockAmount: 2 },
    };
    expect(
      paymentPreview(
        {
          ...order,
          total: "10.05",
          items: [
            { ...order.items[0], unitPrice: "10.05", lineTotal: "10.05" },
          ],
        },
        client,
      ),
    ).toMatchObject({
      grossCents: 1005,
      discountCents: 101,
      netCents: 904,
      baseUnits: 4,
      rule: "1 punto por cada $2,00",
    });
  });
  it("fixed discount caps at gross; zero net still accrues per purchase", () => {
    expect(
      paymentPreview(
        order,
        withCoupon({
          discountUnit: "amount",
          discountValue: "50",
          currencyCode: "USD",
        }),
      ),
    ).toMatchObject({
      netCents: 0,
      discountCents: 1158,
      baseUnits: 1,
      canConfirm: true,
    });
  });
  it("currency mismatch is an error", () => {
    expect(
      paymentPreview(
        order,
        withCoupon({
          discountUnit: "amount",
          discountValue: "5",
          currencyCode: "EUR",
        }),
      ).error,
    ).toContain("moneda");
  });
  it.each(["free_product", "two_for_one"] as const)(
    "%s uses first matching snapshot, never aggregates",
    (kind) => {
      const items = [
        { ...order.items[0], quantity: 2, lineTotal: "23.16" },
        {
          ...order.items[0],
          lineId: "second",
          unitPrice: "20.00",
          lineTotal: "20.00",
        },
      ];
      expect(
        paymentPreview(
          { ...order, items, total: "43.16" },
          withCoupon({ kind, productId: "p" }),
        ),
      ).toMatchObject({ discountCents: 1158, netCents: 3158 });
      if (kind === "two_for_one")
        expect(
          paymentPreview(
            {
              ...order,
              total: "31.58",
              items: [
                { ...items[0], quantity: 1, lineTotal: "11.58" },
                items[1],
              ],
            },
            withCoupon({ kind, productId: "p" }),
          ).canConfirm,
        ).toBe(false);
    },
  );
  it("product absent blocks; selecting product unlocks, without adding lines", () => {
    expect(
      paymentPreview(order, withCoupon({ kind: "free_product" })).canConfirm,
    ).toBe(false);
    expect(
      paymentPreview(order, withCoupon({ kind: "free_product" }), "p"),
    ).toMatchObject({ netCents: 0, canConfirm: true });
    expect(
      paymentPreview(
        order,
        withCoupon({ kind: "free_product", productId: "absent" }),
      ).canConfirm,
    ).toBe(false);
  });
  it.each(["custom", "extra_stamps"] as const)(
    "%s does not discount and separates base/extras",
    (kind) => {
      expect(
        paymentPreview(order, withCoupon({ kind, extraUnits: 2 })),
      ).toMatchObject({
        netCents: 1158,
        discountCents: 0,
        baseUnits: 1,
        extraUnits: kind === "extra_stamps" ? 2 : 0,
      });
    },
  );
  it("extra points follows points, incompatible extras block", () => {
    const client = withCoupon({ kind: "extra_points", extraUnits: 2 });
    expect(paymentPreview(order, client).canConfirm).toBe(false);
    client.program = {
      ...client.program,
      kind: "points",
      accrual: { mode: "per_amount", grant: 1, blockAmount: 1 },
    };
    expect(paymentPreview(order, client)).toMatchObject({
      baseUnits: 11,
      extraUnits: 2,
      canConfirm: true,
    });
  });
  it("invalid selected benefit requires explicit local exclusion", () => {
    const client = withCoupon();
    client.couponState = {
      ...client.couponState,
      status: "selected",
      coupon,
      verdict: { valid: false, code: "expired", message: "Venció" },
    };
    expect(paymentPreview(order, client).canConfirm).toBe(false);
    expect(paymentPreview(order, client, null, "c")).toMatchObject({
      canConfirm: true,
      netCents: 1158,
      baseUnits: 1,
      coupon: null,
    });
  });
  it.each([
    { mode: "junk", grant: 1, blockAmount: null },
    { mode: "per_purchase", grant: null, blockAmount: null },
    { mode: "per_amount", grant: 1, blockAmount: 0 },
    { mode: "per_amount", grant: 1, blockAmount: NaN },
  ])("malformed accrual never promises zero %j", (accrual) => {
    const result = paymentPreview(order, {
      ...customer,
      program: { ...customer.program, accrual },
    });
    expect(result.baseUnits).toBeNull();
    expect(result.canConfirm).toBe(false);
    expect(result.error).toContain("acreditación");
  });
  it.each(["NaN", "-1", "Infinity", "1.234"])("malformed money %s", (total) => {
    expect(paymentPreview({ ...order, total }, null)).toMatchObject({
      netCents: null,
      canConfirm: false,
    });
  });
  it("unselected product never matches a deleted line", () => {
    expect(
      paymentPreview(
        { ...order, items: [{ ...order.items[0], productId: null }] },
        withCoupon({ kind: "free_product" }),
      ).canConfirm,
    ).toBe(false);
  });
  it("points per purchase and purchase block are invalid", () => {
    expect(
      paymentPreview(order, {
        ...customer,
        program: { ...customer.program, kind: "points" },
      }).canConfirm,
    ).toBe(false);
    expect(
      paymentPreview(order, {
        ...customer,
        program: {
          ...customer.program,
          accrual: { mode: "per_purchase", grant: 1, blockAmount: 2 },
        },
      }).canConfirm,
    ).toBe(false);
  });
});
