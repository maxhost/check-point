import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AudiencePreview } from "../../../server/marketing/audience-preview";
import type { Campaign } from "../../../server/marketing/campaign-store";

// `CampaignComposer` calls `useRouter` at the top of its body; a static render would
// throw before reaching any block. Nothing under test navigates.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));

import { CampaignComposer } from "./composer";

/**
 * Spec 0065 B3 — THE COMPOSER, rendered for real (`renderToStaticMarkup`, no jsdom: the
 * repo's idiom, `CLAUDE.md`).
 *
 * What this pins is the WIRING: that the five blocks exist and that the numbers
 * `audience-preview` and `summarizeComposer` produce actually reach the markup. The
 * arithmetic itself is `composer-summary.test.ts`'s.
 *
 * DECLARED, no oracle here: `useEffect` does not run in a static render, so the LIVE
 * refetch while the owner changes days or doors is not covered — what is rendered is
 * `initialPreview`, which the page resolves server-side and is what the first paint
 * actually shows. The refresh is an item of the owner's QA.
 */

const preview = (over: Partial<AudiencePreview> = {}): AudiencePreview => ({
  quality: "observada",
  total: 42,
  reachable: 18,
  noLocation: 7,
  optOut: 3,
  cooldown: 14,
  eligible: 11,
  usableLocationIds: ["11111111-1111-4111-8111-111111111111"],
  ...over,
});

const locations = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Sucursal Centro",
    addressLabel: "Av. Siempre Viva 1",
    status: "active" as const,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Sucursal Sin Mapa",
    addressLabel: "Calle sin coordenadas",
    status: "active" as const,
  },
];

const campaign = (over: Partial<Campaign> = {}): Campaign => ({
  id: "33333333-3333-4333-8333-333333333333",
  name: "Dormidos de septiembre",
  status: "draft",
  pauseReason: null,
  dormantDays: 45,
  message: "2x1 en picadas hasta el domingo",
  couponLabel: "2x1 en picadas",
  couponCost: "2.35",
  couponMaxRedemptions: 200,
  couponProductId: null,
  startsAt: new Date("2026-10-01T00:00:00.000Z"),
  endsAt: null,
  activatedAt: null,
  endedAt: null,
  createdAt: new Date("2026-09-16T00:00:00.000Z"),
  locationIds: [locations[0].id],
  ...over,
});

function html(over: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    createElement(CampaignComposer, {
      locations,
      products: [
        { id: "44444444-4444-4444-8444-444444444444", name: "Picada" },
      ],
      remainingQuota: 50,
      currencyCode: "USD",
      initialPreview: preview(),
      ...over,
    } as never),
  );
}

describe("the composer (spec 0065, B3)", () => {
  it("has the five blocks the spec names, in order", () => {
    const markup = html();
    const order = [
      "1 · Audiencia",
      "2 · Canal",
      "3 · Mensaje",
      "4 · Beneficio",
      "5 · Límites y revisión",
    ].map((title) => markup.indexOf(title));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("shows the REAL counts of the preview, not a placeholder", () => {
    const markup = html();
    expect(markup).toContain("Hoy son 42 personas");
    expect(markup).toContain("18 alcanzables por Wallet");
    expect(markup).toContain("7 sin local atribuible");
    expect(markup).toContain("14 en cooldown");
    expect(markup).not.toContain("Calculando la audiencia");
  });

  it("marks a chosen door the tick cannot use, instead of failing at `activate`", () => {
    // The second location is NOT in `usableLocationIds`: no coordinates. Selecting it
    // must say so here — the `activate` route answers 409 `no_usable_location`, and
    // finding that out after composing the whole campaign is finding out too late.
    const markup = html({
      campaign: campaign({ locationIds: [locations[0].id, locations[1].id] }),
    });
    expect(markup).toContain("Este local no tiene ubicación en el mapa");
  });

  it("shows the turns it will occupy and the MAXIMUM COST before activating", () => {
    // Edit mode carries a real coupon (2.35 × 200), which is how the cost reaches the
    // screen without scripting any state: it is the same draft an owner sees when they
    // reopen a campaign with a coupon.
    const markup = html({ campaign: campaign() });
    expect(markup).toContain("Turnos que va a ocupar:");
    // min(18 reachable, 50 free)
    expect(markup).toContain("<strong>18</strong>");
    expect(markup).toContain("USD 470.00");
    expect(markup).toContain("Un 10 % al azar no lo va a ver");
  });

  it("the quota it shows is the one left, not the whole cap", () => {
    const markup = html({ campaign: campaign(), remainingQuota: 4 });
    expect(markup).toContain("te quedan 4 de 50 turnos simultáneos");
    // min(18, 4)
    expect(markup).toContain("<strong>4</strong>");
  });

  it("without a coupon there is no cost, and it does not read «0.00»", () => {
    const markup = html();
    expect(markup).toContain("sin cupón, sin costo");
    expect(markup).not.toContain("0.00");
  });

  it("editing offers «Guardar cambios» and NOT «Activar»", () => {
    // Activating lives on the detail screen, where the four transitions are together.
    const markup = html({ campaign: campaign({ status: "paused" }) });
    expect(markup).toContain("Guardar cambios");
    expect(markup).not.toContain(">Activar<");
  });
});
