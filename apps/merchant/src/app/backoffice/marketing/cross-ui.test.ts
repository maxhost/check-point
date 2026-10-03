import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TemplateView } from "./marketing-types";
import { CrossFields } from "./cross-fields";
import {
  initialTemplateDraft,
  templateDraftBody,
  templateDraftErrors,
} from "./template-draft";
import { templateConfirmation } from "./template-confirmation";

const template: TemplateView = {
  key: "cross",
  title: "Oferta cruzada",
  description: "Una oferta para descubrir el negocio.",
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
  welcome: null,
  cross: {
    audience: {
      options: ["non_members", "dormant", "any"],
      default: "non_members",
    },
    validDays: { options: [7, 15, 30], default: 15 },
    monthlyCap: { min: 1, max: 10000, default: 50 },
  },
  nearReward: null,
  repeat: null,
  atRisk: null,
  live: null,
  runs: [],
};
const timeZone = "America/Guayaquil";
const reward = { couponLabel: "Un café gratis", couponCost: "1.20" };
const endsAt = "2030-01-20T18:00";

describe("Oferta cruzada en Marketing", () => {
  it("inicia con los valores del contrato y envía solo los parámetros M1", () => {
    const draft = { ...initialTemplateDraft(template), ...reward, endsAt };
    expect(draft).toMatchObject({
      coupon: true,
      crossAudience: "non_members",
      crossValidDays: 15,
      crossMonthlyCap: 50,
    });
    expect(templateDraftErrors(template, draft, timeZone)).toEqual({});
    const body = templateDraftBody(template, draft, timeZone);
    expect(body).toMatchObject({
      ...reward,
      crossAudience: "non_members",
      crossValidDays: 15,
      crossMonthlyCap: 50,
      endsAt: "2030-01-20T23:00:00.000Z",
    });
    for (const field of [
      "channels",
      "excludedLocationIds",
      "couponMaxRedemptions",
      "dormantDays",
    ])
      expect(body).not.toHaveProperty(field);
  });

  it("usa los días solo para dormidos y los valida según el catálogo", () => {
    const dormant = {
      ...initialTemplateDraft(template),
      ...reward,
      crossAudience: "dormant" as const,
      dormantDays: 60,
    };
    expect(templateDraftBody(template, dormant, timeZone)).toHaveProperty(
      "dormantDays",
      60,
    );
    expect(
      templateDraftErrors(template, { ...dormant, dormantDays: 45 }, timeZone),
    ).toHaveProperty("dormantDays");
    const any = { ...dormant, crossAudience: "any" as const };
    expect(templateDraftBody(template, any, timeZone)).not.toHaveProperty(
      "dormantDays",
    );
    expect(
      templateDraftErrors(template, { ...any, dormantDays: 45 }, timeZone),
    ).not.toHaveProperty("dormantDays");
  });

  it("exige premio, vigencia, cupo y fin de campaña válidos", () => {
    const draft = { ...initialTemplateDraft(template), ...reward };
    expect(templateDraftErrors(template, draft, timeZone)).toHaveProperty(
      "endsAt",
      "Una campaña con cupón necesita fecha de fin.",
    );
    expect(
      templateDraftErrors(template, { ...draft, coupon: false }, timeZone),
    ).toHaveProperty("endsAt");
    expect(
      templateDraftErrors(template, { ...draft, coupon: false }, timeZone),
    ).toHaveProperty("couponLabel");
    expect(
      templateDraftErrors(template, { ...draft, crossValidDays: 10 }, timeZone),
    ).toHaveProperty("crossValidDays");
    expect(
      templateDraftErrors(template, { ...draft, crossMonthlyCap: 0 }, timeZone),
    ).toHaveProperty("crossMonthlyCap");
    expect(
      templateDraftErrors(
        template,
        { ...draft, crossAudience: "invalid" as "any" },
        timeZone,
      ),
    ).toHaveProperty("crossAudience");
    expect(
      templateDraftErrors(template, { ...draft, endsAt }, timeZone),
    ).not.toHaveProperty("endsAt");
    expect(
      templateDraftErrors(
        template,
        { ...draft, endsAt: "2030-01-01T00:00", startsAt: endsAt },
        timeZone,
      ),
    ).toHaveProperty("endsAt", "La fecha de fin debe ser posterior al inicio.");
  });

  it("muestra la entrega automática y confirma el cupo mensual", () => {
    const draft = { ...initialTemplateDraft(template), ...reward, endsAt };
    const props = {
      template,
      draft,
      change: () => {},
      errors: {},
      settings: { timeZone, pushWindow: { startHour: 9, endHour: 20 } },
      canReadCatalog: false,
      couponKinds: ["free_product" as const],
      currencyCode: "USD",
    };
    const html = renderToStaticMarkup(createElement(CrossFields, props));
    expect(html).toContain("Tope de cupones entregados por mes");
    expect(html).toContain("Fin de la campaña");
    expect(html).toContain("Obligatoria. Hora de America/Guayaquil");
    expect(html).toContain("Tras una compra en otro comercio participante");
    expect(html).not.toContain("reclama el cupón");
    expect(html).not.toContain("Tope de canjes");
    expect(html).not.toContain("Días sin venir");
    expect(html).not.toContain("¿Por dónde llega?");
    const dormantHtml = renderToStaticMarkup(
      createElement(CrossFields, {
        ...props,
        draft: { ...draft, crossAudience: "dormant" },
      }),
    );
    expect(dormantHtml).toContain("Días sin venir");
    const summary = templateConfirmation(template, draft, timeZone, "USD");
    expect(summary).toContain("Tope mensual: 50 cupones entregados");
    expect(summary).toContain("Vigencia desde la entrega: 15 días");
    expect(summary).toContain(`Fin: ${endsAt}`);
    expect(summary).not.toContain("Canales:");
    expect(summary).not.toContain("tope 100");
  });
});
