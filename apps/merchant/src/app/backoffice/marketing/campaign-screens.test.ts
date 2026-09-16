import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CampaignOverview } from "../../../server/marketing/campaign-list";
import type { Campaign } from "../../../server/marketing/campaign-store";
import type { CampaignStatus } from "../../../server/marketing/campaign-transitions";
import { buildCampaignResults } from "../../../server/marketing/results";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));

import { CampaignsList } from "./campaigns-list";
import { CampaignDetail } from "./[id]/campaign-detail";
import { availableActions } from "./campaign-labels";

/** Spec 0065 B3 — the listing and the detail screen. */

const ID = "33333333-3333-4333-8333-333333333333";

const campaign = (over: Partial<Campaign> = {}): Campaign => ({
  id: ID,
  name: "Dormidos de septiembre",
  status: "draft",
  pauseReason: null,
  dormantDays: 45,
  message: "2x1 en picadas hasta el domingo",
  couponLabel: null,
  couponCost: null,
  couponMaxRedemptions: null,
  couponProductId: null,
  startsAt: new Date("2026-10-01T00:00:00.000Z"),
  endsAt: null,
  activatedAt: null,
  endedAt: null,
  createdAt: new Date("2026-09-16T00:00:00.000Z"),
  locationIds: ["11111111-1111-4111-8111-111111111111"],
  ...over,
});

const overview = (over: Partial<CampaignOverview> = {}): CampaignOverview => ({
  campaign: campaign({ status: "active" }),
  lastAudience: {
    ranAt: new Date("2026-09-16T06:00:00.000Z"),
    total: 42,
    reachable: 18,
  },
  activeTurns: 9,
  doneTurns: 140,
  windowPurchases: 40,
  ...over,
});

const results = buildCampaignResults({
  audience: null,
  turns: { queued: 0, active: 0, done: 0, cancelled: 0, held: 0 },
  window: {
    placedN: 0,
    placedPurchases: 0,
    holdoutN: 0,
    holdoutPurchases: 0,
  },
  coupon: { label: null, cap: null, redeemed: 0, incurredCost: null },
  byLocation: [],
  passReach: { inPass: 0, members: 0 },
});

function detailHtml(status: CampaignStatus, over: Partial<Campaign> = {}) {
  return renderToStaticMarkup(
    createElement(CampaignDetail, {
      campaign: campaign({ status, ...over }),
      results,
      locationNames: {
        "11111111-1111-4111-8111-111111111111": "Sucursal Centro",
      },
      currencyCode: "USD",
    }),
  );
}

describe("the campaigns listing", () => {
  it("links each campaign to its own page and shows its last tick", () => {
    const markup = renderToStaticMarkup(
      createElement(CampaignsList, { overviews: [overview()] }),
    );
    expect(markup).toContain(`href="/backoffice/marketing/${ID}"`);
    expect(markup).toContain('href="/backoffice/marketing/new"');
    expect(markup).toContain("Último tick: 42 personas, 18 alcanzables");
    expect(markup).toContain("9 turnos activos");
    expect(markup).toContain("40 de 140 compraron durante su ventana");
  });

  it("a campaign no tick has seen says so, instead of showing zeros", () => {
    const markup = renderToStaticMarkup(
      createElement(CampaignsList, {
        overviews: [overview({ lastAudience: null })],
      }),
    );
    // Zeros would read as «nobody qualified»; the truth is «not measured yet».
    expect(markup).toContain("Todavía no corrió ningún tick");
  });

  it("with no campaigns it invites to create one", () => {
    const markup = renderToStaticMarkup(
      createElement(CampaignsList, { overviews: [] }),
    );
    expect(markup).toContain("Todavía no creaste ninguna campaña");
    expect(markup).toContain('href="/backoffice/marketing/new"');
  });
});

describe("the campaign detail screen", () => {
  it("offers exactly the transitions the table allows, per status", () => {
    // The oracle is `availableActions`, which reads `nextStatus` — the SAME table the
    // routes read. A button the server answers with 409 `invalid_transition` is the
    // failure this pins.
    const cases: [CampaignStatus, string[]][] = [
      ["draft", ["Activar"]],
      ["active", ["Pausar", "Finalizar"]],
      ["paused", ["Activar", "Finalizar", "Archivar"]],
      ["ended", ["Archivar"]],
      ["archived", []],
    ];
    for (const [status, labels] of cases) {
      const markup = detailHtml(status);
      const offered = ["Activar", "Pausar", "Finalizar", "Archivar"].filter(
        (label) => markup.includes(`>${label}</button>`),
      );
      expect(offered, status).toEqual(labels);
      expect(availableActions(status)).toHaveLength(labels.length);
    }
  });

  it("offers «Editar» only where the PATCH would accept it", () => {
    for (const status of ["draft", "paused"] as CampaignStatus[])
      expect(detailHtml(status)).toContain(
        `href="/backoffice/marketing/${ID}/edit"`,
      );
    for (const status of ["active", "ended", "archived"] as CampaignStatus[])
      expect(detailHtml(status)).not.toContain("/edit");
  });

  it("says WHO paused the campaign, not just that it is paused", () => {
    expect(detailHtml("paused", { pauseReason: "plan_downgraded" })).toContain(
      "Se pausó al bajar de plan.",
    );
    expect(detailHtml("paused", { pauseReason: "owner" })).toContain(
      "La pausaste vos.",
    );
  });

  it("shows the definition the owner composed", () => {
    const markup = detailHtml("active", {
      couponLabel: "2x1 en picadas",
      couponCost: "2.35",
      couponMaxRedemptions: 200,
    });
    expect(markup).toContain("Dormidos hace 45 días");
    expect(markup).toContain("2x1 en picadas hasta el domingo");
    expect(markup).toContain("Sucursal Centro");
    expect(markup).toContain("USD 2.35 por canje · tope 200");
    expect(markup).toContain("Desde 2026-10-01 hasta sin fecha de fin");
  });
});
