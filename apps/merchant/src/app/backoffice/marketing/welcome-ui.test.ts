import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { templateByKey } from "@mi-pasaporte/domain/server/marketing/templates";
import { WelcomeOffer } from "../../../../../consumer/src/app/(consumer)/enroll/[programId]/welcome-offer";
import type { TemplateView } from "./marketing-types";
import {
  initialTemplateDraft,
  templateDraftBody,
  templateDraftErrors,
} from "./template-draft";
import { WelcomeFields } from "./welcome-fields";
import { CampaignDetail } from "./[id]/campaign-detail";
import { CampaignsList } from "./campaigns-list";
import { buildCampaignResults } from "../../../server/marketing/results";
import type { Campaign } from "./marketing-types";

const welcome = templateByKey("welcome") as unknown as TemplateView;
const missedYou = templateByKey("missed_you") as unknown as TemplateView;
const timeZone = "America/Guayaquil";

describe("Bienvenida en la UI", () => {
  it("abre el borrador sin canal ni días y toma los defaults del catálogo", () => {
    const draft = initialTemplateDraft(welcome);
    expect(draft).toMatchObject({
      channels: [],
      dormantDays: null,
      coupon: true,
      welcomeValidDays: 15,
      welcomeReminderDays: 3,
      welcomeMonthlyCap: 50,
      welcomeRedeemFrom: "next_day",
    });
  });

  it("envía el premio sin tope de canjes ni campos de proximidad", () => {
    const draft = {
      ...initialTemplateDraft(welcome),
      couponLabel: "Un café gratis",
      couponCost: "1.20",
    };
    expect(templateDraftErrors(welcome, draft, timeZone)).toEqual({});
    const body = templateDraftBody(welcome, draft, timeZone);
    expect(body).toMatchObject({
      couponLabel: "Un café gratis",
      couponCost: "1.20",
      welcomeValidDays: 15,
      welcomeReminderDays: 3,
      welcomeMonthlyCap: 50,
      welcomeRedeemFrom: "next_day",
      endsAt: null,
    });
    for (const field of [
      "channels",
      "dormantDays",
      "excludedLocationIds",
      "couponMaxRedemptions",
    ])
      expect(body).not.toHaveProperty(field);
  });

  it("acepta cada aviso menor a la vigencia y señala las combinaciones inválidas", () => {
    for (const validDays of welcome.welcome!.validDays.options) {
      for (const reminderDays of welcome.welcome!.reminderDays.options) {
        const draft = {
          ...initialTemplateDraft(welcome),
          couponLabel: "Regalo",
          couponCost: "0",
          welcomeValidDays: validDays,
          welcomeReminderDays: reminderDays,
        };
        const errors = templateDraftErrors(welcome, draft, timeZone);
        expect(Boolean(errors.welcomeReminderDays)).toBe(
          reminderDays >= validDays,
        );
      }
    }
  });

  it("el formulario deshabilita el aviso igual a la vigencia y oculta canales y tope de canjes", () => {
    const draft = { ...initialTemplateDraft(welcome), welcomeValidDays: 7 };
    const html = renderToStaticMarkup(
      createElement(WelcomeFields, {
        template: welcome,
        draft,
        change: () => {},
        errors: {},
        settings: { timeZone, pushWindow: { startHour: 9, endHour: 20 } },
        canReadCatalog: false,
        couponKinds: ["free_product"],
        currencyCode: "USD",
      }),
    );
    expect(html).toContain("Tope de regalos por mes");
    expect(html).not.toContain("Tope de canjes");
    expect(html).not.toContain("Días sin venir");
    expect(html).not.toContain("¿Por dónde llega?");
    expect(html).toMatch(/<input[^>]*disabled[^>]*value="7"/);
  });

  it("las otras plantillas no envían parámetros de bienvenida", () => {
    const body = templateDraftBody(
      missedYou,
      initialTemplateDraft(missedYou),
      timeZone,
    );
    for (const field of [
      "welcomeValidDays",
      "welcomeReminderDays",
      "welcomeMonthlyCap",
      "welcomeRedeemFrom",
    ])
      expect(body).not.toHaveProperty(field);
  });

  it("la oferta pública anuncia la bienvenida sin revelar el premio bloqueado", () => {
    const html = renderToStaticMarkup(
      createElement(WelcomeOffer, {
        offer: {
          message: "Sumate y ganá",
          label: "Un café gratis",
          kind: "free_product",
          rule: "Solo en mostrador",
          validDays: 15,
          redeemFrom: "same_visit",
        },
      }),
    );
    expect(html).toContain("Hay una bienvenida para vos");
    expect(html).toContain("activá las notificaciones");
    expect(html).not.toContain("Un café gratis");
    expect(html).not.toContain("Solo en mostrador");
  });

  it("la lista y el detalle de bienvenida no muestran inactividad ni topes nulos", () => {
    const campaign: Campaign = {
      id: "33333333-3333-4333-8333-333333333333",
      templateKey: "welcome",
      channels: [],
      name: "Bienvenida",
      status: "active",
      pauseReason: null,
      dormantDays: 30,
      message: "Sumate y ganá",
      couponLabel: "Un café gratis",
      couponCost: "1.20",
      couponMaxRedemptions: null,
      couponProductId: null,
      couponKind: "free_product",
      nearRewardStamps: null,
      nearRewardPercent: null,
      rewardRepeat: null,
      welcome: {
        validDays: 15,
        reminderDays: 3,
        monthlyCap: 50,
        redeemFrom: "next_day",
      },
      startsAt: "2026-09-27T12:00:00.000Z",
      endsAt: null,
      activatedAt: "2026-09-27T12:00:00.000Z",
      endedAt: null,
      createdAt: "2026-09-27T12:00:00.000Z",
      locationIds: [],
    };
    const results = buildCampaignResults({
      audience: null,
      turns: { queued: 0, active: 0, done: 0, cancelled: 0, held: 0 },
      window: {
        placedN: 0,
        placedPurchases: 0,
        holdoutN: 0,
        holdoutPurchases: 0,
      },
      coupon: {
        label: "Un café gratis",
        cap: null,
        redeemed: 2,
        incurredCost: "2.40",
      },
      byLocation: [],
      passReach: { inPass: 0, members: 0 },
      push: null,
    });
    const list = renderToStaticMarkup(
      createElement(CampaignsList, { campaigns: [campaign] }),
    );
    const detail = renderToStaticMarkup(
      createElement(CampaignDetail, {
        campaign,
        results,
        locationNames: {},
        currencyCode: "USD",
      }),
    );
    expect(list).toContain("Se entrega al activar notificaciones en CheckPass");
    expect(list).not.toContain("Dormidos hace");
    expect(detail).toContain("Tope de regalos por mes");
    expect(detail).toContain(
      "Se entrega al activar notificaciones en CheckPass",
    );
    expect(detail).not.toContain("Dormidos hace");
    expect(detail).not.toContain("tope null");
    expect(detail).not.toContain("de null canjeados");
  });
});
