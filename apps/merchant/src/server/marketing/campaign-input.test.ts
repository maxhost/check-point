import { describe, expect, it } from "vitest";
import {
  type CampaignInput,
  parseCampaignInput,
  parseCampaignPatch,
} from "./campaign-input";

/**
 * Spec 0102 / ADR 0094 §3 — a campaign with a coupon needs `ends_at`, because an issued
 * coupon is valid until that date. The composer (create and `PATCH`) answers it as a
 * field error; the `CHECK core_campaign_coupon_needs_end_check` is only the backstop.
 */

const DOOR = "11111111-1111-4111-8111-111111111111";
const START = "2026-10-01T00:00:00.000Z";
const END = "2026-10-31T00:00:00.000Z";
const COUPON = { couponLabel: "2x1", couponCost: 2, couponMaxRedemptions: 5 };
const MESSAGE = "Una campaña con cupón necesita fecha de fin.";

const body = (over: Record<string, unknown> = {}) => ({
  name: "Vuelvan",
  message: "Te extrañamos",
  startsAt: START,
  locationIds: [DOOR],
  ...over,
});

describe("parseCampaignInput — coupon needs an end date", () => {
  it("a coupon without endsAt is refused on endsAt", () => {
    const parsed = parseCampaignInput(body(COUPON));
    expect(parsed).toEqual({ ok: false, errors: { endsAt: MESSAGE } });
    expect(parseCampaignInput(body({ ...COUPON, endsAt: null }))).toEqual({
      ok: false,
      errors: { endsAt: MESSAGE },
    });
  });

  it("a coupon with endsAt is fine", () => {
    const parsed = parseCampaignInput(body({ ...COUPON, endsAt: END }));
    expect(parsed.ok && parsed.value).toMatchObject({
      couponLabel: "2x1",
      endsAt: new Date(END),
    });
  });

  it("no coupon and no endsAt is fine: only the coupon needs the date", () => {
    const parsed = parseCampaignInput(body());
    expect(parsed.ok && parsed.value.endsAt).toBeNull();
  });
});

describe("parseCampaignPatch — coupon needs an end date", () => {
  const current: CampaignInput & { status: "paused" } = {
    name: "Vuelvan",
    message: "Te extrañamos",
    dormantDays: 30,
    startsAt: new Date(START),
    endsAt: new Date(END),
    locationIds: [DOOR],
    couponLabel: "2x1",
    couponCost: "2.00",
    couponMaxRedemptions: 5,
    couponProductId: null,
    status: "paused",
  };

  it("removing the endsAt of a campaign that carries a coupon is refused", () => {
    expect(parseCampaignPatch({ endsAt: null }, current)).toEqual({
      ok: false,
      errors: { endsAt: MESSAGE },
    });
  });

  it("removing the endsAt together with the coupon is fine", () => {
    const parsed = parseCampaignPatch(
      { endsAt: null, couponLabel: null, couponCost: null },
      current,
    );
    expect(parsed.ok && parsed.value).toMatchObject({
      endsAt: null,
      couponLabel: null,
    });
  });
});
