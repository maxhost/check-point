import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  buildCampaignResults,
  type ResultsFacts,
  type WindowFacts,
} from "../../../server/marketing/results";
import { CampaignResultsView } from "./results-view";

/**
 * Spec 0065 B3 — THE RESULTS SECTION on screen.
 *
 * The DTO is built with the REAL `buildCampaignResults`, never hand-written: a fabricated
 * DTO would let the screen pass while the gating of the estimate was broken upstream, and
 * the whole point of the split is that `results.ts` decides and this file renders.
 */

const facts = (window: Partial<WindowFacts> = {}): ResultsFacts => ({
  audience: {
    ranAt: new Date("2026-09-16T06:00:00.000Z"),
    total: 42,
    reachable: 18,
    noLocation: 7,
    optOut: 3,
    cooldown: 14,
  },
  turns: { queued: 5, active: 9, done: 140, cancelled: 2, held: 41 },
  window: {
    placedN: 100,
    placedPurchases: 40,
    holdoutN: 40,
    holdoutPurchases: 8,
    ...window,
  },
  coupon: {
    label: "2x1 en picadas",
    cap: 200,
    redeemed: 12,
    incurredCost: "28.20",
  },
  byLocation: [
    {
      locationId: "11111111-1111-4111-8111-111111111111",
      name: "Sucursal Centro",
      turns: 60,
      windowPurchases: 25,
      redemptions: 9,
    },
  ],
  passReach: { inPass: 120, members: 300 },
});

function html(window: Partial<WindowFacts> = {}): string {
  return renderToStaticMarkup(
    createElement(CampaignResultsView, {
      results: buildCampaignResults(facts(window)),
      currencyCode: "USD",
    }),
  );
}

describe("the results screen (spec 0065, B3)", () => {
  it("titles the purchases block «compraron durante su ventana», never «generados»", () => {
    const markup = html();
    expect(markup).toContain("Compraron durante su ventana");
    // The guarantee is about what is NOT claimed: a turn placed on somebody who was
    // coming back anyway also lands in that count, which is why the holdout exists.
    expect(markup).not.toContain("generados por la campaña");
    expect(markup).toContain("Con turno: 40 de 100");
    expect(markup).toContain("Retenidos: 8 de 40");
  });

  it("HIDES the effect estimate below 30 holdouts and says what is missing", () => {
    const markup = html({ holdoutN: 29, holdoutPurchases: 6 });
    expect(markup).not.toContain("Estimación del efecto");
    expect(markup).toContain("Todavía sin señal");
    expect(markup).toContain("hacen falta 30 turnos retenidos y hay 29");
  });

  it("SHOWS the estimate at 30 holdouts, with the value `(x/A − y/B) × A`", () => {
    // 40/100 − 8/40 = 0.2; × 100 = +20 clientes.
    const markup = html();
    expect(markup).toContain("Estimación del efecto: +20 clientes");
    expect(markup).not.toContain("Todavía sin señal");
  });

  it("a campaign that did WORSE than its control says so, with a minus", () => {
    const markup = html({ placedPurchases: 10, holdoutPurchases: 20 });
    expect(markup).toContain("Estimación del efecto: -40 clientes");
  });

  it("every block carries its quality, and they are not all the same word", () => {
    const markup = html();
    expect(markup).toContain("Observada");
    expect(markup).toContain("Estimada");
    expect(markup).toContain("Estimado configurado");
  });

  it("shows the audience photo, the coupon and the pass reach", () => {
    const markup = html();
    expect(markup).toContain("42 personas en la audiencia");
    expect(markup).toContain("3 con las promociones apagadas");
    expect(markup).toContain("2x1 en picadas: 12 de 200 canjeados");
    expect(markup).toContain("USD 28.20 de costo estimado incurrido");
    expect(markup).toContain("Estás en el pase de 120 de tus");
    expect(markup).toContain("300 clientes");
  });
});
