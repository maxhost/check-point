import { describe, expect, it } from "vitest";
import { campaignKindEnabled } from "@mi-pasaporte/domain/server/marketing/enabled-campaigns";
import { parseTemplateInput } from "./template-input";
import { templateByKey } from "@mi-pasaporte/domain/server/marketing/templates";

const NOW = new Date("2026-09-27T12:00:00.000Z");
const missedYou = templateByKey("missed_you")!;
const winBack = templateByKey("win_back")!;
const near = templateByKey("near_reward")!;
const unclaimed = templateByKey("unclaimed_reward")!;
const COUPON = {
  couponLabel: "2x1",
  couponCost: 2,
  couponMaxRedemptions: 5,
  endsAt: "2026-12-31T00:00:00.000Z",
};

function errorsOf(body: unknown, template = near) {
  const parsed = parseTemplateInput(template, body, NOW);
  if (parsed.ok) throw new Error("esperaba errores y el cuerpo paso");
  return parsed.errors;
}

function valueOf(body: unknown, template = near) {
  const parsed = parseTemplateInput(template, body, NOW);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

/** Spec 0104 §3 — `enable` of the BALANCE templates (#7 «Te falta poco», #8 «Premio sin
 * canjear»): push-only, no coupon, their own parameters and the `{faltan}` marker. */
describe.skipIf(
  !campaignKindEnabled("near_reward") ||
    !campaignKindEnabled("unclaimed_reward"),
)("parseTemplateInput — balance templates", () => {
  it("{} is push-only with the owner's defaults", () => {
    expect(valueOf({})).toMatchObject({
      channelProximity: false,
      channelPush: true,
      dormantDays: 7,
      message: "¡Estás a {faltan} de tu premio!",
      nearRewardStamps: 2,
      nearRewardPercent: 20,
      rewardRepeat: null,
      couponLabel: null,
    });
    expect(valueOf({}, unclaimed)).toMatchObject({
      channelProximity: false,
      channelPush: true,
      dormantDays: 14,
      nearRewardStamps: null,
      nearRewardPercent: null,
      rewardRepeat: "once",
    });
  });

  it("#3/#5 without channels are still BOTH (the 0101/0103 contract)", () => {
    for (const template of [missedYou, winBack])
      expect(valueOf({ channels: null }, template)).toMatchObject({
        channelProximity: true,
        channelPush: true,
      });
  });

  it("a channel the template does not offer is 400 on channels", () => {
    for (const template of [near, unclaimed]) {
      expect(errorsOf({ channels: ["proximity"] }, template)).toHaveProperty(
        "channels",
      );
      expect(
        errorsOf({ channels: ["push", "proximity"] }, template),
      ).toHaveProperty("channels");
      expect(valueOf({ channels: ["push"] }, template).channelPush).toBe(true);
    }
  });

  it("any coupon field on #7/#8 is 400 couponLabel «Esta campaña no lleva cupón.»", () => {
    for (const template of [near, unclaimed]) {
      expect(errorsOf(COUPON, template)).toEqual({
        couponLabel: "Esta campaña no lleva cupón.",
      });
      for (const key of ["couponLabel", "couponCost", "couponMaxRedemptions"])
        expect(
          errorsOf({ [key]: COUPON[key as keyof typeof COUPON] }, template),
        ).toEqual({ couponLabel: "Esta campaña no lleva cupón." });
    }
    // …while #5 still carries it.
    expect(valueOf(COUPON, winBack).couponLabel).toBe("2x1");
  });

  it("spec 0106: the NEW reward fields alone are refused on #7/#8 too", () => {
    const fields = {
      couponKind: "discount",
      couponDiscountUnit: "percent",
      couponDiscountValue: "10",
      couponExtraUnits: 3,
      couponRule: "Solo medianos",
      couponProductId: "11111111-1111-4111-8111-111111111111",
    };
    for (const template of [near, unclaimed])
      for (const [key, value] of Object.entries(fields))
        expect(errorsOf({ [key]: value }, template)).toEqual({
          couponLabel: "Esta campaña no lleva cupón.",
        });
  });

  it("#7's thresholds: every option, defaults when absent, anything else is 400", () => {
    for (const stamps of [1, 2, 3])
      expect(valueOf({ nearRewardStamps: stamps }).nearRewardStamps).toBe(
        stamps,
      );
    for (const percent of [10, 20])
      expect(valueOf({ nearRewardPercent: percent }).nearRewardPercent).toBe(
        percent,
      );
    for (const bad of [0, 4, "2", 2.5])
      expect(errorsOf({ nearRewardStamps: bad })).toHaveProperty(
        "nearRewardStamps",
      );
    for (const bad of [15, 30, "20"])
      expect(errorsOf({ nearRewardPercent: bad })).toHaveProperty(
        "nearRewardPercent",
      );
    expect(valueOf({ dormantDays: 3 }).dormantDays).toBe(3);
    expect(errorsOf({ dormantDays: 30 })).toHaveProperty("dormantDays");
  });

  it("#8's repetition: once | every_30_days, default once, anything else is 400", () => {
    expect(
      valueOf({ rewardRepeat: "every_30_days" }, unclaimed).rewardRepeat,
    ).toBe("every_30_days");
    for (const bad of ["always", 30, "ONCE"])
      expect(errorsOf({ rewardRepeat: bad }, unclaimed)).toHaveProperty(
        "rewardRepeat",
      );
  });

  it("a parameter a template does not declare is IGNORED and stored null", () => {
    expect(valueOf({ rewardRepeat: "every_30_days" })).toMatchObject({
      rewardRepeat: null,
      nearRewardPercent: 20,
    });
    expect(
      valueOf({ nearRewardStamps: 3, nearRewardPercent: 99 }, unclaimed),
    ).toMatchObject({ nearRewardStamps: null, nearRewardPercent: null });
    expect(
      valueOf({ nearRewardStamps: 9, rewardRepeat: "x" }, missedYou),
    ).toMatchObject({
      nearRewardStamps: null,
      nearRewardPercent: null,
      rewardRepeat: null,
    });
  });

  it("{faltan} is MANDATORY in #7 and a 400 in #3/#5/#8", () => {
    expect(errorsOf({ message: "¡Volvé por tu premio!" })).toEqual({
      message: "El mensaje tiene que incluir {faltan}.",
    });
    expect(valueOf({ message: "Te faltan {faltan}, {faltan}!" }).message).toBe(
      "Te faltan {faltan}, {faltan}!",
    );
    for (const template of [missedYou, winBack, unclaimed])
      expect(errorsOf({ message: "Te faltan {faltan}" }, template)).toEqual({
        message: "El marcador {faltan} solo vale en «Te falta poco».",
      });
  });

  it("the 60-character cap is measured on the RAW text, marker included", () => {
    const raw = `${"x".repeat(52)}{faltan}`;
    expect(raw).toHaveLength(60);
    expect(valueOf({ message: raw }).message).toBe(raw);
    expect(errorsOf({ message: `y${raw}` })).toHaveProperty("message");
  });
});
