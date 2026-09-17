import { describe, expect, it } from "vitest";
import { toClientProgram } from "./loyalty-program/client-view";
import { toConsumerProgramSummary } from "./consumer/programs";

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
      id: "22222222-2222-4222-8222-222222222222",
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
      id: "33333333-3333-4333-8333-333333333333",
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

/**
 * Spec 0069 §D5 — **el path del sello se emite SIEMPRE**, con sello o sin él.
 *
 * Es el ORÁCULO DE LA MUTACIÓN #2 del presupuesto (volver a `stampImagePath: null`).
 * Importa porque `client-view.ts` es —medido con `rg 'public/loyalty'` sobre
 * `apps/merchant/src` sin tests— la ÚNICA línea que construye esa URL en todo el árbol:
 * con `null`, la ruta pública del sello no la llama nadie y el placeholder sería código
 * muerto.
 */
describe("stampImagePath sin sello (spec 0069 §D5)", () => {
  const base = {
    id: "77777777-7777-4777-8777-777777777777",
    kind: "stamps",
    stampImageObjectKey: null as string | null,
    stampImageVersion: 0,
    accrualMode: "per_purchase" as string | null,
    accrualGrant: 1 as number | null,
    accrualBlockAmount: null as string | null,
  };

  it("un programa SIN sello expone un path NO nulo, con la versión de la columna", () => {
    const dto = toClientProgram(base, "biz-9");
    expect(dto?.stampImagePath).toBe(
      `/api/public/loyalty/biz-9/${base.id}/stamp?v=0`,
    );
  });

  it("un sello REMOVIDO (sin key pero con versión > 0) usa su versión, no el 0", () => {
    const dto = toClientProgram({ ...base, stampImageVersion: 3 }, "biz-9");
    expect(dto?.stampImagePath).toBe(
      `/api/public/loyalty/biz-9/${base.id}/stamp?v=3`,
    );
  });

  it("con sello, el path sigue siendo el de siempre y la key NO se serializa", () => {
    const dto = toClientProgram(
      { ...base, stampImageObjectKey: "loyalty/b/p/abc", stampImageVersion: 2 },
      "biz-9",
    );
    expect(dto?.stampImagePath).toBe(
      `/api/public/loyalty/biz-9/${base.id}/stamp?v=2`,
    );
    expect(JSON.stringify(dto)).not.toContain("loyalty/b/p/abc");
    expect(JSON.stringify(dto)).not.toContain("ObjectKey");
  });
});

/**
 * Spec 0069 §D5 — `consumer/programs.ts` **propaga** el path (línea `stampImagePath:
 * clientProgram.stampImagePath`). Se verifica, no se asume: `toConsumerProgramSummary`
 * es puro, así que alcanza con una fila.
 */
describe("el consumidor hereda el path del sello (spec 0069 §D5)", () => {
  it("un programa sin sello llega al wallet del consumidor con path no nulo", () => {
    const enrolledAt = new Date("2026-09-17T12:00:00.000Z");
    const summary = toConsumerProgramSummary({
      membershipId: "m1",
      businessId: "biz-9",
      businessName: "La Farmacia",
      logoObjectKey: null,
      logoVersion: 0,
      brandPrimaryColor: "#176548",
      brandComplementaryColor: "#2D8B68",
      brandAccentColor: "#E78132",
      programId: "77777777-7777-4777-8777-777777777777",
      programStatus: "active",
      kind: "stamps",
      configuration: { unitName: "sello", target: 8 },
      cardBackgroundColor: null,
      cardBackgroundColor2: null,
      cardBackgroundGradientAngle: null,
      cardBorderColor: null,
      stampImageObjectKey: null,
      stampImageVersion: 0,
      termsMarkdown: "t",
      pointsBalance: 0,
      stampsCount: 0,
      enrolledAt,
      lastOrderAt: null,
      lastRedemptionAt: null,
      marketingOptOutAt: null,
    });
    expect(summary.stampImagePath).toBe(
      "/api/public/loyalty/biz-9/77777777-7777-4777-8777-777777777777/stamp?v=0",
    );
    expect(JSON.stringify(summary)).not.toContain("ObjectKey");
  });
});
