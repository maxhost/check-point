import { describe, expect, it } from "vitest";
import {
  TEMPLATES,
  templateByKey,
  templateKeysAtOrAbove,
} from "@mi-pasaporte/domain/server/marketing/templates";

/**
 * The catalog of prebuilt campaigns (spec 0101). The exact values ARE the assertion: the
 * day options are the owner's, and a default outside its own options would turn `{}` into
 * a 400 on the first click of the toggle.
 */
describe("marketing templates catalog", () => {
  it("has exactly the eight templates of the specs, in catalog order", () => {
    // Spec 0107 (#1+#2, FIRST) + spec 0101 (#3, #5) + spec 0105 (#4) + spec 0104 (#7, #8)
    // + spec 0136 («Oferta cruzada») + spec 0113 («Horas valle», LAST).
    expect(TEMPLATES.map((t) => t.key)).toEqual([
      "welcome",
      "missed_you",
      "at_risk",
      "win_back",
      "near_reward",
      "unclaimed_reward",
      "cross",
      "valley",
    ]);
  });

  it.each(TEMPLATES)(
    "$key: its default days are one of its options and its default message fits",
    (template) => {
      // Spec 0107: only «Bienvenida» has no dormant days.
      expect(template.dormantDays === null).toBe(template.key === "welcome");
      const days = template.dormantDays ?? { options: [30], default: 30 };
      expect(days.options).toContain(days.default);
      expect(template.message.default.length).toBeGreaterThan(0);
      expect(template.message.default.length).toBeLessThanOrEqual(
        template.message.maxLength,
      );
      // Spec 0104: `{faltan}` is mandatory where it is allowed and a 400 elsewhere, so a
      // default on the wrong side would turn `{}` into a 400.
      expect(template.message.default.includes("{faltan}")).toBe(
        template.message.gapMarker,
      );
      // The database check is 1..80 for the name the template gives the campaign.
      expect(template.title.length).toBeLessThanOrEqual(80);
      // …and 3..365 for the days (spec 0104 lowered the floor for #7's «3 días»).
      for (const option of days.options) {
        expect(option).toBeGreaterThanOrEqual(3);
        expect(option).toBeLessThanOrEqual(365);
      }
    },
  );

  it("welcome: every default is one of its options and the default reminder falls inside the default validity", () => {
    const welcome = templateByKey("welcome")!.welcome!;
    expect(welcome.validDays.options).toContain(welcome.validDays.default);
    expect(welcome.reminderDays.options).toContain(
      welcome.reminderDays.default,
    );
    expect(welcome.redeemFrom.options).toContain(welcome.redeemFrom.default);
    expect(welcome.reminderDays.default).toBeLessThan(
      welcome.validDays.default,
    );
    expect(welcome.monthlyCap.default).toBeGreaterThanOrEqual(
      welcome.monthlyCap.min,
    );
    expect(TEMPLATES.filter((t) => t.couponRequired).map((t) => t.key)).toEqual(
      ["welcome", "cross", "valley"],
    );
  });

  it("templateByKey finds each key and answers null to anything else", () => {
    expect(templateByKey("missed_you")?.title).toBe("Te extrañamos");
    expect(templateByKey("win_back")?.title).toBe("Recuperar perdidos");
    expect(templateByKey("at_risk")?.title).toBe("Cliente en riesgo");
    expect(templateByKey("birthday")).toBeNull();
    expect(templateByKey("")).toBeNull();
    expect(templateByKey("MISSED_YOU")).toBeNull();
  });

  /** Spec 0103 §2 + spec 0105: the group rule escalates (#3 → #4 → #5) and never goes
   * back — a customer pushed with #4 still gets #5, never #3. */
  it("templateKeysAtOrAbove: #3 is blocked by itself, #4 and #5; #4 by itself and #5; #5 only by itself", () => {
    expect(templateKeysAtOrAbove(templateByKey("missed_you")!)).toEqual([
      "missed_you",
      "at_risk",
      "win_back",
    ]);
    expect(templateKeysAtOrAbove(templateByKey("at_risk")!)).toEqual([
      "at_risk",
      "win_back",
    ]);
    expect(templateKeysAtOrAbove(templateByKey("win_back")!)).toEqual([
      "win_back",
    ]);
  });

  /** Spec 0104: SALDO is its own group, #8 above #7, and never mixes with reactivation. */
  it("templateKeysAtOrAbove: #7 is blocked by itself and #8; #8 only by itself", () => {
    expect(templateKeysAtOrAbove(templateByKey("near_reward")!)).toEqual([
      "near_reward",
      "unclaimed_reward",
    ]);
    expect(templateKeysAtOrAbove(templateByKey("unclaimed_reward")!)).toEqual([
      "unclaimed_reward",
    ]);
  });
});
