import { describe, expect, it } from "vitest";
import { parseCoupon } from "@mi-pasaporte/domain/server/marketing/reward-input";

/**
 * Spec 0106 / ADR 0098 — the reward's TYPE and its fields, table-driven: one valid and at
 * least one invalid body per type, the `free_product` default and the all-or-nothing.
 */
describe("parseCoupon — the reward has a type", () => {
  const TRIO = {
    couponLabel: "Premio",
    couponCost: "1.20",
    couponMaxRedemptions: 10,
  };
  const PRODUCT = "22222222-2222-4222-8222-222222222222";
  const parse = (over: Record<string, unknown>) => {
    const errors: Record<string, string> = {};
    const deal = parseCoupon(errors, { ...TRIO, ...over });
    return { deal, errors };
  };

  it.each([
    [
      "free_product with product",
      { couponKind: "free_product", couponProductId: PRODUCT },
      { couponProductId: PRODUCT },
    ],
    [
      "two_for_one as text",
      { couponKind: "two_for_one" },
      { couponProductId: null },
    ],
    [
      "discount 10 %",
      {
        couponKind: "discount",
        couponDiscountUnit: "percent",
        couponDiscountValue: "10",
      },
      { couponDiscountUnit: "percent", couponDiscountValue: "10.00" },
    ],
    [
      "discount 2.5 amount",
      {
        couponKind: "discount",
        couponDiscountUnit: "amount",
        couponDiscountValue: 2.5,
      },
      { couponDiscountUnit: "amount", couponDiscountValue: "2.50" },
    ],
    [
      "extra_stamps 3",
      { couponKind: "extra_stamps", couponExtraUnits: 3 },
      { couponExtraUnits: 3 },
    ],
    [
      "extra_points 1000",
      { couponKind: "extra_points", couponExtraUnits: 1000 },
      { couponExtraUnits: 1000 },
    ],
  ])("valid: %s", (_name, over, expected) => {
    const { deal, errors } = parse({
      ...over,
      couponRule: "  Solo medianos  ",
    });
    expect(errors).toEqual({});
    expect(deal).toMatchObject({
      ...expected,
      couponKind: (over as { couponKind: string }).couponKind,
      couponRule: "Solo medianos",
    });
  });

  it.each([
    ["unknown kind", { couponKind: "cashback" }, "couponKind"],
    [
      "product on a discount",
      {
        couponKind: "discount",
        couponDiscountUnit: "percent",
        couponDiscountValue: 5,
        couponProductId: PRODUCT,
      },
      "couponProductId",
    ],
    [
      "product that is not a uuid",
      { couponKind: "free_product", couponProductId: "cafe" },
      "couponProductId",
    ],
    [
      "discount without unit",
      { couponKind: "discount", couponDiscountValue: 5 },
      "couponDiscountUnit",
    ],
    [
      "percent not whole",
      {
        couponKind: "discount",
        couponDiscountUnit: "percent",
        couponDiscountValue: 10.5,
      },
      "couponDiscountValue",
    ],
    [
      "percent over 100",
      {
        couponKind: "discount",
        couponDiscountUnit: "percent",
        couponDiscountValue: 101,
      },
      "couponDiscountValue",
    ],
    [
      "amount zero",
      {
        couponKind: "discount",
        couponDiscountUnit: "amount",
        couponDiscountValue: "0",
      },
      "couponDiscountValue",
    ],
    [
      "discount value on a 2x1",
      { couponKind: "two_for_one", couponDiscountValue: 5 },
      "couponDiscountValue",
    ],
    ["extra without units", { couponKind: "extra_stamps" }, "couponExtraUnits"],
    [
      "extra over 1000",
      { couponKind: "extra_points", couponExtraUnits: 1001 },
      "couponExtraUnits",
    ],
    [
      "extra units on a free product",
      { couponKind: "free_product", couponExtraUnits: 2 },
      "couponExtraUnits",
    ],
    ["rule that is not text", { couponRule: 7 }, "couponRule"],
    ["rule over 2000", { couponRule: "x".repeat(2001) }, "couponRule"],
  ])("invalid: %s → 400 on %s", (_name, over, field) => {
    const { deal, errors } = parse(over);
    expect(deal).toBeUndefined();
    expect(Object.keys(errors)).toEqual([field]);
  });

  it("no couponKind with the trio is `free_product` (the old UI keeps working)", () => {
    expect(parse({}).deal).toMatchObject({
      couponKind: "free_product",
      couponProductId: null,
      couponRule: null,
    });
  });

  it("a reward field without the trio is 400: the reward is all or nothing", () => {
    const errors: Record<string, string> = {};
    expect(parseCoupon(errors, { couponKind: "two_for_one" })).toBeUndefined();
    expect(errors).toHaveProperty("couponLabel");
    expect(parseCoupon({}, {})).toMatchObject({
      couponKind: null,
      couponRule: null,
    });
  });
});
