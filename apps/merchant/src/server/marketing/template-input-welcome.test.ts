import { describe, expect, it } from "vitest";
import { parseTemplateInput } from "./template-input";
import { templateByKey } from "@mi-pasaporte/domain/server/marketing/templates";

const NOW = new Date("2026-09-27T12:00:00.000Z");
const welcome = templateByKey("welcome")!;
const missedYou = templateByKey("missed_you")!;
const GIFT = { couponLabel: "Un café gratis", couponCost: "1.20" };

function errorsOf(body: unknown, template = welcome) {
  const parsed = parseTemplateInput(template, body, NOW);
  if (parsed.ok) throw new Error("esperaba errores y el cuerpo paso");
  return parsed.errors;
}

function valueOf(body: unknown) {
  const parsed = parseTemplateInput(welcome, body, NOW);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

/**
 * The body of `enable` for «Bienvenida» (spec 0107 §2): the 400s of the spec, one field
 * each, and the defaults 15/3/50/`next_day` — no channel, no end, no redemption cap.
 */
describe("parseTemplateInput — welcome", () => {
  it("a coupon alone is the defaults: 15 d, reminder 3 d, cap 50, next day, no channel, no end", () => {
    expect(valueOf(GIFT)).toMatchObject({
      channelProximity: false,
      channelPush: false,
      message: "Únete hoy y en tu próxima visita te llevas un regalo",
      excludedLocationIds: [],
      couponKind: "free_product",
      couponLabel: "Un café gratis",
      couponCost: "1.20",
      couponMaxRedemptions: null,
      welcomeValidDays: 15,
      welcomeReminderDays: 3,
      welcomeMonthlyCap: 50,
      welcomeRedeemFrom: "next_day",
      startsAt: NOW,
      endsAt: null,
    });
  });

  it("takes every option it offers", () => {
    expect(
      valueOf({
        ...GIFT,
        welcomeValidDays: 30,
        welcomeReminderDays: 7,
        welcomeMonthlyCap: 10000,
        welcomeRedeemFrom: "same_visit",
        endsAt: "2026-12-31T00:00:00.000Z",
      }),
    ).toMatchObject({
      welcomeValidDays: 30,
      welcomeReminderDays: 7,
      welcomeMonthlyCap: 10000,
      welcomeRedeemFrom: "same_visit",
      endsAt: new Date("2026-12-31T00:00:00.000Z"),
    });
  });

  it("with no coupon, or half of one, is a 400 on couponLabel", () => {
    expect(errorsOf({})).toHaveProperty("couponLabel");
    expect(errorsOf({ couponLabel: "Un café" })).toHaveProperty("couponLabel");
    expect(errorsOf({ couponCost: "1.00" })).toHaveProperty("couponLabel");
  });

  it("refuses couponMaxRedemptions, channels, dormantDays and excluded doors — each on its field", () => {
    expect(errorsOf({ ...GIFT, couponMaxRedemptions: 10 })).toHaveProperty(
      "couponMaxRedemptions",
    );
    expect(errorsOf({ ...GIFT, channels: ["push"] })).toHaveProperty(
      "channels",
    );
    expect(errorsOf({ ...GIFT, channels: [] })).toHaveProperty("channels");
    expect(errorsOf({ ...GIFT, dormantDays: 30 })).toHaveProperty(
      "dormantDays",
    );
    expect(
      errorsOf({
        ...GIFT,
        excludedLocationIds: ["11111111-1111-4111-8111-111111111111"],
      }),
    ).toHaveProperty("excludedLocationIds");
    // An EMPTY exclusion is not an exclusion.
    expect(
      valueOf({ ...GIFT, excludedLocationIds: [] }).excludedLocationIds,
    ).toEqual([]);
  });

  it("each parameter outside its options is a 400 on its own field", () => {
    expect(errorsOf({ ...GIFT, welcomeValidDays: 10 })).toHaveProperty(
      "welcomeValidDays",
    );
    expect(errorsOf({ ...GIFT, welcomeReminderDays: 2 })).toHaveProperty(
      "welcomeReminderDays",
    );
    for (const cap of [0, 10001, 2.5, "50"])
      expect(errorsOf({ ...GIFT, welcomeMonthlyCap: cap })).toHaveProperty(
        "welcomeMonthlyCap",
      );
    expect(errorsOf({ ...GIFT, welcomeRedeemFrom: "tomorrow" })).toHaveProperty(
      "welcomeRedeemFrom",
    );
  });

  it("the reminder has to fall strictly inside the validity (7 d of validity refuses 7)", () => {
    expect(
      errorsOf({ ...GIFT, welcomeValidDays: 7, welcomeReminderDays: 7 }),
    ).toHaveProperty("welcomeReminderDays");
    expect(
      valueOf({ ...GIFT, welcomeValidDays: 7, welcomeReminderDays: 3 })
        .welcomeReminderDays,
    ).toBe(3);
  });

  it("any welcome* in ANOTHER template is a 400 on that field", () => {
    for (const [key, value] of [
      ["welcomeValidDays", 15],
      ["welcomeReminderDays", 3],
      ["welcomeMonthlyCap", 50],
      ["welcomeRedeemFrom", "next_day"],
    ] as const)
      expect(errorsOf({ [key]: value }, missedYou)).toHaveProperty(key);
  });
});
