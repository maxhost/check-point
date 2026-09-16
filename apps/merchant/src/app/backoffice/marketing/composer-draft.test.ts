import { describe, expect, it } from "vitest";
import {
  DEFAULT_DORMANT_DAYS,
  draftBody,
  draftCoupon,
  draftFromCampaign,
  emptyDraft,
} from "./composer-draft";

/** Spec 0065 B3 — what the composer SENDS. Pure, so it has a table instead of a regex. */

const doors = ["11111111-1111-4111-8111-111111111111"];

describe("draftBody", () => {
  it("a draft with no coupon sends the three coupon keys as null, never half of them", () => {
    // A label with no cap reaches the counter with nothing to stop it, and a cost with no
    // label reaches the results with nothing to name: the database refuses the pair as
    // `core_campaign_coupon_check`, and the owner would read a 400 about a field they
    // never filled.
    const body = draftBody({
      ...emptyDraft("2026-10-01", doors),
      name: "  Dormidos  ",
      message: "  2x1  ",
      couponLabel: "quedó escrito",
      couponCost: "9.99",
      couponMaxRedemptions: "50",
      couponProductId: "44444444-4444-4444-8444-444444444444",
    });
    expect(body).toEqual({
      name: "Dormidos",
      message: "2x1",
      dormantDays: DEFAULT_DORMANT_DAYS,
      locationIds: doors,
      startsAt: "2026-10-01",
      endsAt: null,
      couponLabel: null,
      couponCost: null,
      couponMaxRedemptions: null,
      couponProductId: null,
    });
  });

  it("with the coupon on, the trio travels complete", () => {
    const body = draftBody({
      ...emptyDraft("2026-10-01", doors),
      withCoupon: true,
      couponLabel: "2x1 en picadas",
      couponCost: "2.35",
      couponMaxRedemptions: "200",
      endsAt: "2026-11-01",
    });
    expect(body).toMatchObject({
      couponLabel: "2x1 en picadas",
      couponCost: "2.35",
      couponMaxRedemptions: 200,
      // Informative (ADR 0002): not picked is `null`, NOT the empty string, which
      // `parseCampaignInput` would reject as «el producto no es válido».
      couponProductId: null,
      endsAt: "2026-11-01",
    });
  });

  it("the date travels as the `yyyy-mm-dd` of the input, untouched", () => {
    // Re-building it with the browser's offset would move a campaign a day back for
    // anyone west of Greenwich; `new Date("2026-10-01")` is unambiguous UTC midnight.
    expect(draftBody(emptyDraft("2026-10-01", doors)).startsAt).toBe(
      "2026-10-01",
    );
  });
});

describe("draftCoupon", () => {
  it("a cap the owner is still typing is `null`, not `NaN`", () => {
    const base = { ...emptyDraft("2026-10-01", doors), withCoupon: true };
    for (const couponMaxRedemptions of ["", "abc", "0", "2.5"])
      expect(
        draftCoupon({ ...base, couponMaxRedemptions }).couponMaxRedemptions,
      ).toBeNull();
    expect(
      draftCoupon({ ...base, couponMaxRedemptions: "200" })
        .couponMaxRedemptions,
    ).toBe(200);
  });
});

describe("draftFromCampaign", () => {
  it("round-trips a saved campaign back into the five blocks", () => {
    const draft = draftFromCampaign({
      name: "Dormidos de septiembre",
      dormantDays: 45,
      message: "2x1 en picadas hasta el domingo",
      locationIds: doors,
      couponLabel: "2x1 en picadas",
      couponCost: "2.35",
      couponMaxRedemptions: 200,
      couponProductId: null,
      startsAt: new Date("2026-10-01T00:00:00.000Z"),
      endsAt: new Date("2026-11-01T00:00:00.000Z"),
    });
    expect(draft).toMatchObject({
      withCoupon: true,
      couponMaxRedemptions: "200",
      couponProductId: "",
      startsAt: "2026-10-01",
      endsAt: "2026-11-01",
    });
    // And back out identical: what the edit screen sends is what it was handed.
    expect(draftBody(draft)).toMatchObject({
      couponLabel: "2x1 en picadas",
      couponCost: "2.35",
      couponMaxRedemptions: 200,
      endsAt: "2026-11-01",
    });
  });

  it("a campaign with no coupon comes back with the block OFF and no leftovers", () => {
    const draft = draftFromCampaign({
      name: "Sin cupón",
      dormantDays: 30,
      message: "pasá a vernos",
      locationIds: doors,
      couponLabel: null,
      couponCost: null,
      couponMaxRedemptions: null,
      couponProductId: null,
      startsAt: new Date("2026-10-01T00:00:00.000Z"),
      endsAt: null,
    });
    expect(draft.withCoupon).toBe(false);
    expect(draft.endsAt).toBe("");
    expect(draftBody(draft).endsAt).toBeNull();
  });
});
