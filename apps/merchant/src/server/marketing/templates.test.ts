import { describe, expect, it } from "vitest";
import { TEMPLATES, templateByKey, templateKeysAtOrAbove } from "./templates";

/**
 * The catalog of prebuilt campaigns (spec 0101). The exact values ARE the assertion: the
 * day options are the owner's, and a default outside its own options would turn `{}` into
 * a 400 on the first click of the toggle.
 */
describe("marketing templates catalog", () => {
  it("has exactly the four templates of the specs, in catalog order", () => {
    // Spec 0101 (#3, #5) + spec 0104 (#7, #8).
    expect(TEMPLATES.map((t) => t.key)).toEqual([
      "missed_you",
      "win_back",
      "near_reward",
      "unclaimed_reward",
    ]);
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
          gapMarker: false,
        },
        couponRecommended: false,
        couponAllowed: true,
        nearReward: null,
        repeat: null,
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
        message: {
          default: "¡Volvé! Te estamos esperando.",
          maxLength: 60,
          gapMarker: false,
        },
        couponRecommended: true,
        couponAllowed: true,
        nearReward: null,
        repeat: null,
      },
      // Spec 0104 / ADR 0096 — the owner's options and defaults.
      {
        key: "near_reward",
        title: "Te falta poco",
        description:
          "Avisa por notificación a los clientes que no vienen y están a poco de su premio.",
        channels: ["push"],
        group: "balance",
        rank: 1,
        dormantDays: { options: [3, 7, 14], default: 7 },
        message: {
          default: "¡Estás a {faltan} de tu premio!",
          maxLength: 60,
          gapMarker: true,
        },
        couponRecommended: false,
        couponAllowed: false,
        nearReward: {
          stamps: { options: [1, 2, 3], default: 2 },
          pointsPercent: { options: [10, 20], default: 20 },
        },
        repeat: null,
      },
      {
        key: "unclaimed_reward",
        title: "Premio sin canjear",
        description:
          "Avisa por notificación a los clientes que ya tienen un premio y no vuelven a canjearlo.",
        channels: ["push"],
        group: "balance",
        rank: 2,
        dormantDays: { options: [7, 14, 30], default: 14 },
        message: {
          default: "Tenés un premio esperándote. ¡Vení a canjearlo!",
          maxLength: 60,
          gapMarker: false,
        },
        couponRecommended: false,
        couponAllowed: false,
        nearReward: null,
        repeat: { options: ["once", "every_30_days"], default: "once" },
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
      // Spec 0104: `{faltan}` is mandatory where it is allowed and a 400 elsewhere, so a
      // default on the wrong side would turn `{}` into a 400.
      expect(template.message.default.includes("{faltan}")).toBe(
        template.message.gapMarker,
      );
      // The database check is 1..80 for the name the template gives the campaign.
      expect(template.title.length).toBeLessThanOrEqual(80);
      // …and 3..365 for the days (spec 0104 lowered the floor for #7's «3 días»).
      for (const days of template.dormantDays.options) {
        expect(days).toBeGreaterThanOrEqual(3);
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
