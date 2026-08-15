import { describe, expect, it } from "vitest";
import {
  computeAccrual,
  spendToRedeem,
  validateAccrual,
} from "./loyalty-program/accrual";
import { LoyaltyError } from "./loyalty-program/core";

describe("validateAccrual (spec 0036)", () => {
  it("accepts per_amount with a positive grant and block amount", () => {
    expect(
      validateAccrual("points", {
        mode: "per_amount",
        grant: 10,
        blockAmount: 3,
      }),
    ).toEqual({ mode: "per_amount", grant: 10, blockAmount: "3.00" });
    expect(
      validateAccrual("stamps", {
        mode: "per_amount",
        grant: 1,
        blockAmount: 5,
      }),
    ).toEqual({ mode: "per_amount", grant: 1, blockAmount: "5.00" });
  });

  it("accepts Sellos per_purchase with a null block amount", () => {
    expect(
      validateAccrual("stamps", {
        mode: "per_purchase",
        grant: 1,
        blockAmount: null,
      }),
    ).toEqual({ mode: "per_purchase", grant: 1, blockAmount: null });
  });

  it("rejects Puntos with per_purchase (Puntos is always by amount)", () => {
    expect(() =>
      validateAccrual("points", {
        mode: "per_purchase",
        grant: 1,
        blockAmount: null,
      }),
    ).toThrow("Los Puntos");
  });

  it("rejects per_amount without a block amount", () => {
    expect(() =>
      validateAccrual("points", {
        mode: "per_amount",
        grant: 10,
        blockAmount: null,
      }),
    ).toThrow(LoyaltyError);
    expect(() =>
      validateAccrual("points", { mode: "per_amount", grant: 10 }),
    ).toThrow("monto por bloque");
  });

  it("rejects a non-positive grant or block amount", () => {
    expect(() =>
      validateAccrual("points", {
        mode: "per_amount",
        grant: 0,
        blockAmount: 3,
      }),
    ).toThrow("entero mayor que 0");
    expect(() =>
      validateAccrual("points", {
        mode: "per_amount",
        grant: 10,
        blockAmount: 0,
      }),
    ).toThrow("mayor que 0");
    expect(() =>
      validateAccrual("points", {
        mode: "per_amount",
        grant: 10,
        blockAmount: -5,
      }),
    ).toThrow(LoyaltyError);
  });

  it("requires the mechanics to be present", () => {
    expect(() => validateAccrual("points", undefined)).toThrow(
      "Define la mecánica",
    );
    expect(() => validateAccrual("points", { grant: 10 })).toThrow(
      "no es válido",
    );
  });
});

describe("computeAccrual / spendToRedeem (spec 0036)", () => {
  const perAmount = (grant: number, blockAmount: string) =>
    ({ mode: "per_amount", grant, blockAmount }) as const;

  it("grants whole blocks with floor and no carry", () => {
    expect(computeAccrual(perAmount(10, "3.00"), 7)).toBe(20); // floor(7/3)*10
    expect(computeAccrual(perAmount(1, "10.00"), 20)).toBe(2); // floor(20/10)*1
  });

  it("grants a flat amount per purchase", () => {
    expect(
      computeAccrual(
        { mode: "per_purchase", grant: 5, blockAmount: null },
        999,
      ),
    ).toBe(5);
  });

  it("grants nothing for a non-positive total in per_amount", () => {
    expect(computeAccrual(perAmount(10, "3.00"), 0)).toBe(0);
    expect(computeAccrual(perAmount(10, "3.00"), -1)).toBe(0);
  });

  it("computes the spend needed to redeem a Puntos reward", () => {
    expect(spendToRedeem(perAmount(10, "3"), 100)).toBe(30);
  });
});
