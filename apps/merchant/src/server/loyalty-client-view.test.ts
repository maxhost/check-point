import { describe, expect, it } from "vitest";
import { toClientProgram } from "./loyalty-program/client-view";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

describe("toClientProgram accrual + rewards (spec 0036)", () => {
  const program = {
    id: "prog-1",
    kind: "points",
    stampImageObjectKey: null as string | null,
    stampImageVersion: 0,
    accrualMode: "per_amount" as string | null,
    accrualGrant: 10 as number | null,
    accrualBlockAmount: "3.00" as string | null,
    termsMarkdown: "t",
  };
  const rewards = [
    {
      rewardType: "custom",
      label: "Cerveza",
      productId: null,
      discountPercent: null,
      pointsCost: 100,
      position: 1,
      imageObjectKey: null,
      imageVersion: null,
    },
    {
      rewardType: "catalog_product",
      label: "Café",
      productId: PRODUCT_ID,
      discountPercent: null,
      pointsCost: 50,
      position: 0,
      imageObjectKey: "catalog/biz/café.webp",
      imageVersion: 4,
    },
  ];

  it("exposes the three accrual fields", () => {
    const dto = toClientProgram(program, "biz-1", rewards);
    expect(dto?.accrual).toEqual({
      mode: "per_amount",
      grant: 10,
      blockAmount: 3,
    });
  });

  it("keeps the rewards in the order the loader returned (by position)", () => {
    const dto = toClientProgram(program, "biz-1", rewards);
    expect(dto?.rewards.map((r) => r.label)).toEqual(["Cerveza", "Café"]);
    const catalog = dto?.rewards.find((r) => r.productId === PRODUCT_ID);
    expect(catalog?.imagePath).toBe(
      `/api/public/catalog/${PRODUCT_ID}/image?v=4`,
    );
  });

  it("never serializes any *ObjectKey on the program or a reward", () => {
    const dto = toClientProgram(
      { ...program, stampImageObjectKey: "loyalty/b/p/a" },
      "biz-1",
      rewards,
    );
    expect(dto).not.toHaveProperty("stampImageObjectKey");
    for (const reward of dto?.rewards ?? []) {
      expect(reward).not.toHaveProperty("imageObjectKey");
    }
    // Full-serialization guard: no internal R2 key can leak anywhere in the DTO.
    expect(JSON.stringify(dto)).not.toContain("ObjectKey");
    expect(JSON.stringify(dto)).not.toContain("catalog/biz/café.webp");
  });

  it("returns a null accrual for a legacy program without mechanics", () => {
    const dto = toClientProgram(
      {
        ...program,
        accrualMode: null,
        accrualGrant: null,
        accrualBlockAmount: null,
      },
      "biz-1",
      [],
    );
    expect(dto?.accrual).toBeNull();
    expect(dto?.rewards).toEqual([]);
  });
});
