import { describe, expect, it } from "vitest";
import { parseCampaignInput } from "./campaign-input";
import { parseTemplateInput } from "./template-input";
import { templateByKey } from "@mi-pasaporte/domain/server/marketing/templates";

const NOW = new Date("2026-09-26T12:00:00.000Z");
const missedYou = templateByKey("missed_you")!;
const winBack = templateByKey("win_back")!;
const DOOR = "11111111-1111-4111-8111-111111111111";

function errorsOf(body: unknown, template = missedYou) {
  const parsed = parseTemplateInput(template, body, NOW);
  if (parsed.ok) throw new Error("esperaba errores y el cuerpo paso");
  return parsed.errors;
}

/**
 * The body of `enable` (spec 0101). Every field is optional; what is validated is
 * validated against the TEMPLATE (its day options), and the coupon with the composer's
 * own parser — so the half-declared coupon answers the SAME message on both surfaces.
 */
describe("parseTemplateInput", () => {
  it("{} is the template with its defaults, starting now, with no coupon and no exclusion", () => {
    expect(parseTemplateInput(missedYou, {}, NOW)).toEqual({
      ok: true,
      value: {
        // Spec 0103: no `channels` is BOTH (owner's decision).
        channelProximity: true,
        channelPush: true,
        dormantDays: 30,
        message: "Hace rato no te vemos. ¡Te esperamos!",
        excludedLocationIds: [],
        couponLabel: null,
        couponCost: null,
        couponMaxRedemptions: null,
        couponProductId: null,
        // Spec 0106: no coupon, no reward.
        couponKind: null,
        couponDiscountUnit: null,
        couponDiscountValue: null,
        couponExtraUnits: null,
        couponRule: null,
        // Spec 0104: the balance parameters are `null` outside #7/#8.
        nearRewardStamps: null,
        nearRewardPercent: null,
        rewardRepeat: null,
        // Spec 0107: the welcome parameters are `null` outside «Bienvenida».
        welcomeValidDays: null,
        welcomeReminderDays: null,
        welcomeMonthlyCap: null,
        welcomeRedeemFrom: null,
        // Spec 0112: the cross parameters are `null` outside «Oferta cruzada».
        crossAudience: null,
        crossValidDays: null,
        crossMonthlyCap: null,
        // Spec 0113: the valley cap is `null` outside «Horas valle».
        valleyMonthlyCap: null,
        startsAt: NOW,
        endsAt: null,
      },
    });
    const other = parseTemplateInput(winBack, {}, NOW);
    expect(other.ok && other.value.dormantDays).toBe(90);
  });

  it("accepts every option of the template and nothing else", () => {
    for (const days of [14, 30]) {
      const parsed = parseTemplateInput(missedYou, { dormantDays: days }, NOW);
      expect(parsed.ok && parsed.value.dormantDays).toBe(days);
    }
    // 45 is inside the database's 7..365 — it is outside THIS template.
    expect(errorsOf({ dormantDays: 45 })).toHaveProperty("dormantDays");
    // An option of the OTHER template is not an option of this one.
    expect(errorsOf({ dormantDays: 90 })).toHaveProperty("dormantDays");
    expect(errorsOf({ dormantDays: 30 }, winBack)).toHaveProperty(
      "dormantDays",
    );
    expect(errorsOf({ dormantDays: "30" })).toHaveProperty("dormantDays");
    expect(errorsOf({ dormantDays: 30.5 })).toHaveProperty("dormantDays");
  });

  it("the message is trimmed, and empty or 61 characters is an error", () => {
    const parsed = parseTemplateInput(missedYou, { message: "  Hola  " }, NOW);
    expect(parsed.ok && parsed.value.message).toBe("Hola");
    expect(errorsOf({ message: "" })).toHaveProperty("message");
    expect(errorsOf({ message: "   " })).toHaveProperty("message");
    expect(errorsOf({ message: "x".repeat(61) })).toHaveProperty("message");
    const sixty = parseTemplateInput(
      missedYou,
      { message: "x".repeat(60) },
      NOW,
    );
    expect(sixty.ok).toBe(true);
  });

  it("a half coupon is refused with EXACTLY the composer's error", () => {
    const half = { couponLabel: "2x1", couponCost: 2 };
    const composer = parseCampaignInput({
      name: "x",
      message: "y",
      startsAt: NOW.toISOString(),
      locationIds: [DOOR],
      ...half,
    });
    expect(composer.ok).toBe(false);
    expect(errorsOf(half)).toEqual(
      composer.ok ? {} : { couponLabel: composer.errors.couponLabel },
    );
  });

  it("a full coupon is carried as the composer normalizes it", () => {
    const parsed = parseTemplateInput(
      winBack,
      {
        couponLabel: " 2x1 ",
        couponCost: 2.5,
        couponMaxRedemptions: 50,
        // Spec 0102: a coupon needs an end date.
        endsAt: "2026-12-31T00:00:00.000Z",
      },
      NOW,
    );
    expect(parsed.ok && parsed.value).toMatchObject({
      couponLabel: "2x1",
      couponCost: "2.50",
      couponMaxRedemptions: 50,
      couponProductId: null,
    });
  });

  it("a coupon without endsAt is refused on endsAt (spec 0102 / ADR 0094)", () => {
    // ORACULO DEL CABLEADO de `requireEndForCoupon` en `parseTemplateInput` (M7): the
    // composer's parser has its own call, and the CHECK would answer 500, not 400.
    const coupon = {
      couponLabel: "2x1",
      couponCost: 2,
      couponMaxRedemptions: 5,
    };
    expect(errorsOf(coupon)).toEqual({
      endsAt: "Una campaña con cupón necesita fecha de fin.",
    });
    expect(errorsOf({ ...coupon, endsAt: null })).toHaveProperty("endsAt");
    const dated = parseTemplateInput(
      missedYou,
      { ...coupon, endsAt: "2026-12-31T00:00:00.000Z" },
      NOW,
    );
    expect(dated.ok).toBe(true);
  });

  it("endsAt must be after startsAt; null means no end", () => {
    expect(
      errorsOf({ startsAt: NOW.toISOString(), endsAt: NOW.toISOString() }),
    ).toHaveProperty("endsAt");
    expect(
      errorsOf({ endsAt: new Date(NOW.getTime() - 1000).toISOString() }),
    ).toHaveProperty("endsAt");
    const open = parseTemplateInput(missedYou, { endsAt: null }, NOW);
    expect(open.ok && open.value.endsAt).toBeNull();
    const later = "2026-12-31T00:00:00.000Z";
    const closed = parseTemplateInput(missedYou, { endsAt: later }, NOW);
    expect(closed.ok && closed.value.endsAt).toEqual(new Date(later));
    expect(errorsOf({ startsAt: "no-es-fecha" })).toHaveProperty("startsAt");
  });

  it("excludedLocationIds must be uuids, and duplicates collapse", () => {
    const parsed = parseTemplateInput(
      missedYou,
      { excludedLocationIds: [DOOR, DOOR] },
      NOW,
    );
    expect(parsed.ok && parsed.value.excludedLocationIds).toEqual([DOOR]);
    expect(errorsOf({ excludedLocationIds: ["nope"] })).toHaveProperty(
      "excludedLocationIds",
    );
    expect(errorsOf({ excludedLocationIds: DOOR })).toHaveProperty(
      "excludedLocationIds",
    );
  });

  it("ignores every other key — the name, the doors and the template are not the body's", () => {
    expect(
      parseTemplateInput(
        missedYou,
        {
          templateKey: "win_back",
          name: "Otro nombre",
          locationIds: ["not-a-uuid"],
          businessId: "22222222-2222-4222-8222-222222222222",
          kind: "push",
        },
        NOW,
      ),
    ).toEqual(parseTemplateInput(missedYou, {}, NOW));
  });

  /** Spec 0103 §3 — `channels`: a non-empty set of the two known channels. */
  it("channels: absent/null is both; one or both are accepted; anything else is 400", () => {
    for (const absent of [{}, { channels: null }]) {
      const parsed = parseTemplateInput(missedYou, absent, NOW);
      expect(
        parsed.ok && [parsed.value.channelProximity, parsed.value.channelPush],
      ).toEqual([true, true]);
    }
    const cases: [unknown, boolean, boolean][] = [
      [["push"], false, true],
      [["proximity"], true, false],
      [["push", "proximity"], true, true],
    ];
    for (const [channels, proximity, push] of cases) {
      const parsed = parseTemplateInput(missedYou, { channels }, NOW);
      expect(
        parsed.ok && [parsed.value.channelProximity, parsed.value.channelPush],
      ).toEqual([proximity, push]);
    }
    for (const bad of [[], ["sms"], ["push", "push"], "push", [1], {}]) {
      expect(errorsOf({ channels: bad })).toEqual({
        channels: "Elegí al menos un canal válido.",
      });
    }
  });
});
