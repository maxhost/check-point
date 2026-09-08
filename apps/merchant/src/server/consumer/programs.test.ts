import { describe, expect, it } from "vitest";
import { toConsumerProgramSummary, type ConsumerProgramRow } from "./programs";

function row(overrides: Partial<ConsumerProgramRow> = {}): ConsumerProgramRow {
  return {
    membershipId: "membership-1",
    businessId: "business-1",
    businessName: "Café Uno",
    logoObjectKey: "private/logo.webp",
    logoVersion: 3,
    brandPrimaryColor: "#112233",
    brandComplementaryColor: "#334455",
    brandAccentColor: "#ff9900",
    programId: "program-1",
    programStatus: "active",
    kind: "stamps",
    configuration: { unitName: "sellos", target: 8 },
    cardBackgroundColor: "#010203",
    cardBackgroundColor2: null,
    cardBackgroundGradientAngle: null,
    cardBorderColor: "#ffffff",
    stampImageObjectKey: "private/stamp.webp",
    stampImageVersion: 4,
    termsMarkdown: "Reglas del programa",
    pointsBalance: 0,
    stampsCount: 3,
    enrolledAt: new Date("2026-01-01T00:00:00Z"),
    lastOrderAt: null,
    lastRedemptionAt: null,
    ...overrides,
  };
}

describe("consumer program DTO", () => {
  it("exposes public asset paths, terms and status without object keys", () => {
    const dto = toConsumerProgramSummary(row());
    expect(dto.logoPath).toBe("/api/public/brands/business-1/logo?v=3");
    expect(dto.stampImagePath).toBe(
      "/api/public/loyalty/business-1/program-1/stamp?v=4",
    );
    expect(dto).toMatchObject({
      termsMarkdown: "Reglas del programa",
      programStatus: "active",
      lastActivityAt: "2026-01-01T00:00:00.000Z",
    });
    expect(JSON.stringify(dto)).not.toMatch(/ObjectKey/);
  });

  it("a redemption counts as activity and can be the newest one (spec 0055)", () => {
    // Without `reward_redemption` in the calculation, redeeming would not reorder the
    // wallet list: `lastActivityAt` would stay pinned to the last order/enroll.
    expect(
      toConsumerProgramSummary(
        row({
          lastOrderAt: new Date("2026-02-01T00:00:00Z"),
          lastRedemptionAt: new Date("2026-03-01T00:00:00Z"),
        }),
      ).lastActivityAt,
    ).toBe("2026-03-01T00:00:00.000Z");
    // …and an older redemption never pulls the activity backwards.
    expect(
      toConsumerProgramSummary(
        row({
          lastOrderAt: new Date("2026-02-01T00:00:00Z"),
          lastRedemptionAt: new Date("2026-01-15T00:00:00Z"),
        }),
      ).lastActivityAt,
    ).toBe("2026-02-01T00:00:00.000Z");
  });

  it("carries the reward catalog and never an object key in it", () => {
    const dto = toConsumerProgramSummary(row(), [
      {
        id: "reward-1",
        type: "custom",
        label: "Café gratis",
        productId: null,
        discountPercent: null,
        pointsCost: 50,
        position: 0,
        imagePath: null,
      },
    ]);
    expect(dto.rewards.map((reward) => reward.label)).toEqual(["Café gratis"]);
    expect(JSON.stringify(dto)).not.toMatch(/ObjectKey/);
    expect(toConsumerProgramSummary(row()).rewards).toEqual([]);
  });

  it("points never receives a stamps card design", () => {
    expect(
      toConsumerProgramSummary(
        row({
          kind: "points",
          configuration: { unitName: "estrellas" },
          pointsBalance: 42,
        }),
      ).cardDesign,
    ).toBeNull();
  });
});
