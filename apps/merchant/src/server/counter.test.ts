import { describe, expect, it } from "vitest";
import { computeAccrual } from "./loyalty-program/accrual";
import type { AccrualInput } from "./loyalty-program/core";
import {
  type CartLine,
  balanceFor,
  cartTotal,
  unitLabel,
} from "../app/backoffice/counter/types";

const perAmount: AccrualInput = {
  mode: "per_amount",
  grant: 10,
  blockAmount: "3.00",
};
const perPurchase: AccrualInput = {
  mode: "per_purchase",
  grant: 1,
  blockAmount: null,
};

describe("computeAccrual at the counter (spec 0030)", () => {
  it("points per_amount: floor(total/block)*grant, no carry", () => {
    // $7 with 10 pts each $3 → 20 pts, the $1 is lost.
    expect(computeAccrual(perAmount, 7)).toBe(20);
    expect(computeAccrual(perAmount, 3)).toBe(10);
    expect(computeAccrual(perAmount, 2.99)).toBe(0);
  });

  it("stamps per_purchase: grant flat regardless of total", () => {
    expect(computeAccrual(perPurchase, 0)).toBe(1);
    expect(computeAccrual(perPurchase, 5)).toBe(1);
    expect(computeAccrual(perPurchase, 1000)).toBe(1);
  });

  it("stamps per_amount behaves like points per_amount", () => {
    const stampsByAmount: AccrualInput = {
      mode: "per_amount",
      grant: 2,
      blockAmount: "10.00",
    };
    expect(computeAccrual(stampsByAmount, 25)).toBe(4); // floor(25/10)*2
  });

  it("total 0 or negative grants nothing in per_amount", () => {
    expect(computeAccrual(perAmount, 0)).toBe(0);
    expect(computeAccrual(perAmount, -5)).toBe(0);
  });
});

describe("cart + balance helpers", () => {
  const lines: CartLine[] = [
    {
      productId: "a",
      name: "Café",
      unitPrice: 2.5,
      hasStoredPrice: true,
      quantity: 2,
    },
    {
      productId: "b",
      name: "Medialuna",
      unitPrice: 1.25,
      hasStoredPrice: true,
      quantity: 1,
    },
  ];

  it("cartTotal sums unit price × quantity", () => {
    expect(cartTotal(lines)).toBeCloseTo(6.25, 2);
    expect(cartTotal([])).toBe(0);
  });

  it("balanceFor picks the kind-specific balance", () => {
    const m = { pointsBalance: 40, stampsCount: 3 };
    expect(balanceFor("points", m)).toBe(40);
    expect(balanceFor("stamps", m)).toBe(3);
  });

  it("unitLabel pluralizes per kind", () => {
    expect(unitLabel("points", 1)).toBe("punto");
    expect(unitLabel("points", 2)).toBe("puntos");
    expect(unitLabel("stamps", 1)).toBe("sello");
    expect(unitLabel("stamps", 5)).toBe("sellos");
  });
});
