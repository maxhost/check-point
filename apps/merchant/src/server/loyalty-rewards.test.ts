import { describe, expect, it } from "vitest";
import {
  resolveRewards,
  validateRewardsInput,
} from "./loyalty-program/rewards";
import { LoyaltyError } from "./loyalty-program/core";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

describe("validateRewardsInput (spec 0036)", () => {
  it("requires exactly one Sellos reward without a points cost", () => {
    expect(
      validateRewardsInput("stamps", [
        { type: "custom", label: "Café gratis" },
      ]),
    ).toEqual([
      {
        type: "custom",
        label: "Café gratis",
        productId: null,
        discountPercent: null,
        pointsCost: null,
        position: 0,
      },
    ]);
    expect(() =>
      validateRewardsInput("stamps", [
        { type: "custom", label: "A" },
        { type: "custom", label: "B" },
      ]),
    ).toThrow("exactamente un premio");
    expect(() =>
      validateRewardsInput("stamps", [
        { type: "custom", label: "Café", pointsCost: 50 },
      ]),
    ).toThrow("no lleva costo");
  });

  it("requires a positive points cost on every Puntos reward", () => {
    expect(
      validateRewardsInput("points", [
        { type: "custom", label: "Café", pointsCost: 50 },
        { type: "custom", label: "Cerveza", pointsCost: 100 },
      ]),
    ).toHaveLength(2);
    expect(() =>
      validateRewardsInput("points", [{ type: "custom", label: "Café" }]),
    ).toThrow("costo en puntos");
    expect(() =>
      validateRewardsInput("points", [
        { type: "custom", label: "Café", pointsCost: 0 },
      ]),
    ).toThrow("mayor que 0");
  });

  it("rejects a discount percent outside 1..100 (422)", () => {
    expect(() =>
      validateRewardsInput("points", [
        { type: "discount", discountPercent: 200, pointsCost: 10 },
      ]),
    ).toThrow("entre 1 y 100");
    const [reward] = validateRewardsInput("points", [
      { type: "discount", discountPercent: 25, pointsCost: 10 },
    ]);
    expect(reward).toMatchObject({
      type: "discount",
      discountPercent: 25,
      label: "25% de descuento",
      productId: null,
    });
  });

  it("rejects a catalog_product without a UUID productId (422)", () => {
    expect(() =>
      validateRewardsInput("points", [
        { type: "catalog_product", pointsCost: 10 },
      ]),
    ).toThrow("Selecciona un producto");
    expect(() =>
      validateRewardsInput("points", [
        { type: "catalog_product", productId: "not-a-uuid", pointsCost: 10 },
      ]),
    ).toThrow(LoyaltyError);
  });
});

describe("resolveRewards (spec 0036)", () => {
  const catalogReward = validateRewardsInput("points", [
    {
      type: "catalog_product",
      productId: PRODUCT_ID,
      label: "stale name",
      pointsCost: 50,
    },
  ]);

  it("rejects a productId that does not belong to the business (422)", () => {
    expect(() => resolveRewards(catalogReward, [])).toThrow("no existe");
    expect(() =>
      resolveRewards(catalogReward, [{ id: "other-id", name: "Otro" }]),
    ).toThrow(LoyaltyError);
  });

  it("snapshots the label from the real product name", () => {
    const [resolved] = resolveRewards(catalogReward, [
      { id: PRODUCT_ID, name: "Café Latte" },
    ]);
    expect(resolved.label).toBe("Café Latte");
  });

  it("passes non-catalog rewards through unchanged", () => {
    const rewards = validateRewardsInput("points", [
      { type: "custom", label: "Café", pointsCost: 50 },
      { type: "discount", discountPercent: 10, pointsCost: 20 },
    ]);
    expect(resolveRewards(rewards, [])).toEqual(rewards);
  });
});
