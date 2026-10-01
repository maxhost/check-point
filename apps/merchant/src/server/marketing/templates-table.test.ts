import { describe, expect, it } from "vitest";
import { TEMPLATES } from "@mi-pasaporte/domain/server/marketing/templates";

/**
 * The catalog's exact table (spec 0101 and every spec that added a template). Moved out of
 * `templates.test.ts` unchanged when spec 0113 added «Horas valle» and the file hit the size
 * budget; the exact values ARE the assertion.
 */
describe("marketing templates catalog — the table", () => {
  it("carries the exact values of the spec's table", () => {
    expect(TEMPLATES).toEqual([
      // Spec 0107 / ADR 0099: no channel, no dormant days, coupon mandatory.
      {
        key: "welcome",
        title: "Bienvenida",
        description:
          "Regala un premio a cada cliente nuevo que instala su pase, para que vuelva.",
        channels: [],
        group: "welcome",
        rank: 1,
        dormantDays: null,
        message: {
          default: "Sumate hoy y en tu próxima visita te llevás un regalo",
          maxLength: 60,
          gapMarker: false,
        },
        couponRecommended: true,
        couponAllowed: true,
        couponRequired: true,
        nearReward: null,
        repeat: null,
        atRisk: null,
        welcome: {
          validDays: { options: [7, 15, 30], default: 15 },
          reminderDays: { options: [1, 3, 7], default: 3 },
          monthlyCap: { min: 1, max: 10000, default: 50 },
          redeemFrom: {
            options: ["next_day", "same_visit"],
            default: "next_day",
          },
        },
        cross: null,
        valley: null,
      },
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
        couponRequired: false,
        nearReward: null,
        repeat: null,
        atRisk: null,
        welcome: null,
        cross: null,
        valley: null,
      },
      // Spec 0105 / ADR 0097: the middle of the reactivation ladder; 3 and 2× fixed.
      {
        key: "at_risk",
        title: "Cliente en riesgo",
        description:
          "Busca a los clientes habituales que dejaron de venir con su ritmo de siempre.",
        channels: ["proximity", "push"],
        group: "reactivation",
        rank: 2,
        dormantDays: { options: [14, 30, 45], default: 14 },
        message: {
          default: "Hace unos días que no te vemos. ¡Te esperamos!",
          maxLength: 60,
          gapMarker: false,
        },
        couponRecommended: false,
        couponAllowed: true,
        couponRequired: false,
        nearReward: null,
        repeat: null,
        atRisk: { minVisits: 3, rhythmFactor: 2 },
        welcome: null,
        cross: null,
        valley: null,
      },
      {
        key: "win_back",
        title: "Recuperar perdidos",
        description:
          "Busca a los clientes que dejaron de venir hace meses, cuando pasan cerca de tu local.",
        channels: ["proximity", "push"],
        group: "reactivation",
        rank: 3,
        dormantDays: { options: [60, 90, 180], default: 90 },
        message: {
          default: "¡Volvé! Te estamos esperando.",
          maxLength: 60,
          gapMarker: false,
        },
        couponRecommended: true,
        couponAllowed: true,
        couponRequired: false,
        nearReward: null,
        repeat: null,
        atRisk: null,
        welcome: null,
        cross: null,
        valley: null,
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
        couponRequired: false,
        nearReward: {
          stamps: { options: [1, 2, 3], default: 2 },
          pointsPercent: { options: [10, 20], default: 20 },
        },
        repeat: null,
        atRisk: null,
        welcome: null,
        cross: null,
        valley: null,
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
        couponRequired: false,
        nearReward: null,
        repeat: { options: ["once", "every_30_days"], default: "once" },
        atRisk: null,
        welcome: null,
        cross: null,
        valley: null,
      },
      // Spec 0112 / ADR 0104: no channel, coupon mandatory, audience/validity/cap.
      {
        key: "cross",
        title: "Oferta cruzada",
        description:
          "Regala un premio a clientes de otros comercios cercanos, para que te descubran.",
        channels: [],
        group: "cross",
        rank: 1,
        dormantDays: { options: [30, 60, 90], default: 30 },
        message: {
          default: "Te esperamos con un regalo",
          maxLength: 60,
          gapMarker: false,
        },
        couponRecommended: true,
        couponAllowed: true,
        couponRequired: true,
        nearReward: null,
        repeat: null,
        atRisk: null,
        welcome: null,
        cross: {
          audience: {
            options: ["non_members", "dormant", "any"],
            default: "non_members",
          },
          validDays: { options: [7, 15, 30], default: 15 },
          monthlyCap: { min: 1, max: 10000, default: 50 },
        },
        valley: null,
      },
      // Spec 0113 / ADR 0105: no channel, coupon mandatory, audience fixed, cap (V5/V6).
      {
        key: "valley",
        title: "Horas valle",
        description:
          "Regala un premio a quien todavía no es cliente (o hace mucho no viene), solo en tus horas más flojas.",
        channels: [],
        group: "valley",
        rank: 1,
        dormantDays: { options: [30, 60, 90], default: 30 },
        message: {
          default: "Ahora hay lugar: te esperamos con un regalo",
          maxLength: 60,
          gapMarker: false,
        },
        couponRecommended: true,
        couponAllowed: true,
        couponRequired: true,
        nearReward: null,
        repeat: null,
        atRisk: null,
        welcome: null,
        cross: null,
        valley: { monthlyCap: { min: 1, max: 10000, default: 50 } },
      },
    ]);
  });
});
