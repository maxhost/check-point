import { describe, expect, it } from "vitest";
import { pickCross } from "./cross-input";
import { parseTemplateInput } from "./template-input";
import { templateByKey } from "@mi-pasaporte/domain/server/marketing/templates";

const NOW = new Date("2026-09-29T12:00:00.000Z");
const cross = templateByKey("cross")!;
const missedYou = templateByKey("missed_you")!;
const welcome = templateByKey("welcome")!;
const GIFT = { couponLabel: "10% en tu clase", couponCost: "2.00" };

function errorsOf(body: unknown, template = cross) {
  const parsed = parseTemplateInput(template, body, NOW);
  if (parsed.ok) throw new Error("esperaba errores y el cuerpo paso");
  return parsed.errors;
}

function valueOf(body: unknown) {
  const parsed = parseTemplateInput(cross, body, NOW);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

/**
 * The body of `enable` for «Oferta cruzada» (spec 0136, contract table M1): one row of the
 * table per case — the coupon mandatory, no redemption cap, no channel, no doors, no
 * `welcome*`; `crossAudience`/`dormantDays`/`crossValidDays`/`crossMonthlyCap` against their
 * options with their defaults; `cross*` in another template is a 400.
 */
describe("parseTemplateInput — cross", () => {
  it("a coupon alone is the defaults: non_members, 30 dormant days, 15 d, cap 50, no channel, no end", () => {
    const value = valueOf(GIFT);
    expect(value).toMatchObject({
      channelProximity: false,
      channelPush: false,
      dormantDays: 30,
      message: "Te esperamos con un regalo",
      excludedLocationIds: [],
      couponKind: "free_product",
      couponLabel: "10% en tu clase",
      couponCost: "2.00",
      couponMaxRedemptions: null,
      crossAudience: "non_members",
      crossValidDays: 15,
      crossMonthlyCap: 50,
      welcomeValidDays: null,
      startsAt: NOW,
      endsAt: null,
    });
    expect(pickCross(value)).toEqual({
      crossAudience: "non_members",
      crossValidDays: 15,
      crossMonthlyCap: 50,
    });
  });

  it("takes every option it offers", () => {
    for (const crossAudience of ["non_members", "dormant", "any"])
      expect(valueOf({ ...GIFT, crossAudience }).crossAudience).toBe(
        crossAudience,
      );
    for (const dormantDays of [30, 60, 90])
      expect(valueOf({ ...GIFT, dormantDays }).dormantDays).toBe(dormantDays);
    for (const crossValidDays of [7, 15, 30])
      expect(valueOf({ ...GIFT, crossValidDays }).crossValidDays).toBe(
        crossValidDays,
      );
    for (const crossMonthlyCap of [1, 10000])
      expect(valueOf({ ...GIFT, crossMonthlyCap }).crossMonthlyCap).toBe(
        crossMonthlyCap,
      );
    expect(
      valueOf({
        ...GIFT,
        message: "Vení a probar",
        endsAt: "2026-12-31T00:00:00.000Z",
      }),
    ).toMatchObject({
      message: "Vení a probar",
      endsAt: new Date("2026-12-31T00:00:00.000Z"),
    });
  });

  it("with no coupon, or half of one, is a 400 on couponLabel", () => {
    expect(errorsOf({})).toHaveProperty("couponLabel");
    expect(errorsOf({ couponLabel: "Un café" })).toHaveProperty("couponLabel");
    expect(errorsOf({ couponCost: "1.00" })).toHaveProperty("couponLabel");
  });

  it("refuses couponMaxRedemptions, channels, excluded doors and welcome* — each on its field", () => {
    expect(errorsOf({ ...GIFT, couponMaxRedemptions: 10 })).toHaveProperty(
      "couponMaxRedemptions",
    );
    expect(errorsOf({ ...GIFT, channels: ["push"] })).toHaveProperty(
      "channels",
    );
    expect(errorsOf({ ...GIFT, channels: [] })).toHaveProperty("channels");
    expect(
      errorsOf({
        ...GIFT,
        excludedLocationIds: ["11111111-1111-4111-8111-111111111111"],
      }),
    ).toHaveProperty("excludedLocationIds");
    expect(
      valueOf({ ...GIFT, excludedLocationIds: [] }).excludedLocationIds,
    ).toEqual([]);
    for (const [key, value] of [
      ["welcomeValidDays", 15],
      ["welcomeReminderDays", 3],
      ["welcomeMonthlyCap", 50],
      ["welcomeRedeemFrom", "next_day"],
    ] as const)
      expect(errorsOf({ ...GIFT, [key]: value })).toHaveProperty(key);
  });

  it("each parameter outside its options is a 400 on its own field", () => {
    for (const audience of ["members", "", 1])
      expect(errorsOf({ ...GIFT, crossAudience: audience })).toHaveProperty(
        "crossAudience",
      );
    for (const days of [14, 45, "30"])
      expect(errorsOf({ ...GIFT, dormantDays: days })).toHaveProperty(
        "dormantDays",
      );
    for (const days of [10, 0, "15"])
      expect(errorsOf({ ...GIFT, crossValidDays: days })).toHaveProperty(
        "crossValidDays",
      );
    for (const cap of [0, 10001, 2.5, "50"])
      expect(errorsOf({ ...GIFT, crossMonthlyCap: cap })).toHaveProperty(
        "crossMonthlyCap",
      );
    expect(errorsOf({ ...GIFT, message: "x".repeat(61) })).toHaveProperty(
      "message",
    );
  });

  it("any cross* in ANOTHER template is a 400 on that field (welcome included)", () => {
    for (const template of [missedYou, welcome])
      for (const [key, value] of [
        ["crossAudience", "any"],
        ["crossValidDays", 15],
        ["crossMonthlyCap", 50],
      ] as const)
        expect(errorsOf({ ...GIFT, [key]: value }, template)).toHaveProperty(
          key,
        );
  });
});
