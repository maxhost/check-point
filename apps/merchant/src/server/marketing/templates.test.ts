import { describe, expect, it } from "vitest";
import { TEMPLATES, templateByKey, templateKeysAtOrAbove } from "./templates";

/**
 * The catalog of prebuilt campaigns (spec 0101). The exact values ARE the assertion: the
 * day options are the owner's, and a default outside its own options would turn `{}` into
 * a 400 on the first click of the toggle.
 */
describe("marketing templates catalog", () => {
  it("has exactly the two templates of the spec, in catalog order", () => {
    expect(TEMPLATES.map((t) => t.key)).toEqual(["missed_you", "win_back"]);
  });

  it("carries the exact values of the spec's table", () => {
    expect(TEMPLATES).toEqual([
      {
        key: "missed_you",
        title: "Te extrañamos",
        description:
          "Le recuerda tu local a los clientes que hace un tiempo no vienen, cuando pasan cerca.",
        channels: ["proximity", "push"],
        group: "reactivation",
        rank: 1,
        dormantDays: { options: [14, 30], default: 30 },
        message: {
          default: "Hace rato no te vemos. ¡Te esperamos!",
          maxLength: 60,
        },
        couponRecommended: false,
      },
      {
        key: "win_back",
        title: "Recuperar perdidos",
        description:
          "Busca a los clientes que dejaron de venir hace meses, cuando pasan cerca de tu local.",
        channels: ["proximity", "push"],
        group: "reactivation",
        rank: 2,
        dormantDays: { options: [60, 90, 180], default: 90 },
        message: { default: "¡Volvé! Te estamos esperando.", maxLength: 60 },
        couponRecommended: true,
      },
    ]);
  });

  it.each(TEMPLATES)(
    "$key: its default days are one of its options and its default message fits",
    (template) => {
      expect(template.dormantDays.options).toContain(
        template.dormantDays.default,
      );
      expect(template.message.default.length).toBeGreaterThan(0);
      expect(template.message.default.length).toBeLessThanOrEqual(
        template.message.maxLength,
      );
      // The database check is 1..80 for the name the template gives the campaign.
      expect(template.title.length).toBeLessThanOrEqual(80);
      // …and 7..365 for the days.
      for (const days of template.dormantDays.options) {
        expect(days).toBeGreaterThanOrEqual(7);
        expect(days).toBeLessThanOrEqual(365);
      }
    },
  );

  it("templateByKey finds each key and answers null to anything else", () => {
    expect(templateByKey("missed_you")?.title).toBe("Te extrañamos");
    expect(templateByKey("win_back")?.title).toBe("Recuperar perdidos");
    expect(templateByKey("birthday")).toBeNull();
    expect(templateByKey("")).toBeNull();
    expect(templateByKey("MISSED_YOU")).toBeNull();
  });

  /** Spec 0103 §2: the group rule escalates (#3 → #5) and never goes back (#5 → #3). */
  it("templateKeysAtOrAbove: #3 is blocked by itself and #5; #5 only by itself", () => {
    expect(templateKeysAtOrAbove(templateByKey("missed_you")!)).toEqual([
      "missed_you",
      "win_back",
    ]);
    expect(templateKeysAtOrAbove(templateByKey("win_back")!)).toEqual([
      "win_back",
    ]);
  });
});
