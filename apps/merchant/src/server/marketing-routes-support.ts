import { NextRequest } from "next/server";
import type { vi } from "vitest";
import { GET, POST } from "../app/api/marketing/campaigns/route";
import { GET as ONE, PATCH } from "../app/api/marketing/campaigns/[id]/route";
import { POST as ACTIVATE } from "../app/api/marketing/campaigns/[id]/activate/route";
import { POST as PAUSE } from "../app/api/marketing/campaigns/[id]/pause/route";
import { POST as END } from "../app/api/marketing/campaigns/[id]/end/route";
import { POST as ARCHIVE } from "../app/api/marketing/campaigns/[id]/archive/route";
import { GET as PREVIEW } from "../app/api/marketing/audience-preview/route";
import { GET as RESULTS } from "../app/api/marketing/campaigns/[id]/results/route";
import { GET as REWARD_RESULTS } from "../app/api/marketing/rewards/results/route";
import { GET as TEMPLATES } from "../app/api/marketing/templates/route";
import { POST as ENABLE } from "../app/api/marketing/templates/[key]/enable/route";
import { POST as DISABLE } from "../app/api/marketing/templates/[key]/disable/route";
import {
  GET as SETTINGS,
  PATCH as SETTINGS_PATCH,
} from "../app/api/marketing/settings/route";
import { GET as VALLEY } from "../app/api/marketing/valley/locations/route";
import {
  DELETE as WINDOWS_DELETE,
  PUT as WINDOWS_PUT,
} from "../app/api/marketing/valley/locations/[locationId]/windows/route";

/**
 * The `HANDLERS` table of `marketing-routes.test.ts` and its fixtures, split out so that
 * file stays under the size limit. It holds NO `vi.mock`: the mocks live in the test file,
 * which vitest hoists above every import — this module's route imports included — so the
 * handlers below already run against the test's doubles. The doubles themselves come in
 * as `world`, the test's `vi.hoisted` object.
 */

type Spy = ReturnType<typeof vi.fn>;

export type MarketingRoutesWorld = {
  /**
   * Spec 0072: `emailVerified` entra al doble de la sesión porque `requireApiOwner` —el
   * resolvedor único de las 10 superficies del owner— ahora corre el gate de email también
   * acá. Es una edición del FIXTURE, no de una aserción.
   */
  session: null | { user: { id: string; emailVerified: boolean } };
  membershipContext: Spy;
  ownerContext: Spy;
  listCampaigns: Spy;
  createCampaign: Spy;
  getCampaign: Spy;
  updateCampaign: Spy;
  transitionCampaign: Spy;
  previewAudience: Spy;
  loadCampaignResults: Spy;
  loadRewardResults: Spy;
  listTemplates: Spy;
  enableTemplate: Spy;
  disableTemplate: Spy;
  loadMarketingSettings: Spy;
  updateMarketingSettings: Spy;
  listValleyLocations: Spy;
  replaceMerchantWindows: Spy;
  clearMerchantWindows: Spy;
};

export const CALLER_BUSINESS = "11111111-1111-4111-8111-111111111111";
export const FOREIGN_BUSINESS = "22222222-2222-4222-8222-222222222222";
export const FOREIGN_CAMPAIGN = "33333333-3333-4333-8333-333333333333";

export const request = (path: string, method: string, body?: unknown) =>
  new NextRequest(`https://merchant.test${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined
      ? {}
      : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });

export const params = Promise.resolve({ id: FOREIGN_CAMPAIGN });
export const base = `/api/marketing/campaigns`;
export const one = `${base}/${FOREIGN_CAMPAIGN}`;
/** Every body shouts a foreign business, which no handler may honour. */
export const FIELDS = { name: "Ajena", businessId: FOREIGN_BUSINESS };

export const CAMPAIGN = { id: "camp-1", name: "Vecinos", status: "draft" };
const templates = `/api/marketing/templates`;
const ENABLE_KEY = Promise.resolve({ key: "missed_you" });
const DISABLE_KEY = Promise.resolve({ key: "win_back" });
const valley = `/api/marketing/valley/locations`;
const VALLEY_LOCATION = Promise.resolve({ locationId: FOREIGN_CAMPAIGN });

export type MarketingHandler = {
  name: string;
  call: () => Promise<Response>;
  spy: Spy;
  action: "activate" | "pause" | "end" | "archive" | null;
  ownerOnly: boolean;
};

/**
 * The handlers of `api/marketing/**`, each with how to call it and which domain
 * function it must reach ONLY after the guard. Every call carries a foreign business in
 * the query string and in the body, and a foreign campaign id in the path — none of it
 * may steer the handler.
 *
 * `ownerOnly` is the IRREVERSIBLE set (ADR 0079 §2): `archive`, `end` and —spec 0101—
 * turning a template off, which IS `end`.
 */
export function marketingHandlers(
  world: MarketingRoutesWorld,
): MarketingHandler[] {
  return [
    {
      name: "GET /api/marketing/campaigns",
      call: () => GET(request(`${base}?b=${FOREIGN_BUSINESS}`, "GET")),
      spy: world.listCampaigns,
      action: null,
      ownerOnly: false,
    },
    {
      name: "POST /api/marketing/campaigns",
      call: () =>
        POST(request(`${base}?b=${FOREIGN_BUSINESS}`, "POST", FIELDS)),
      spy: world.createCampaign,
      action: null,
      ownerOnly: false,
    },
    {
      name: "GET /api/marketing/audience-preview",
      call: () =>
        PREVIEW(
          request(
            `/api/marketing/audience-preview?dormantDays=30&locationIds=&b=${FOREIGN_BUSINESS}`,
            "GET",
          ),
        ),
      spy: world.previewAudience,
      action: null,
      ownerOnly: false,
    },
    {
      name: "GET /api/marketing/campaigns/:id/results",
      call: () => RESULTS(request(`${one}/results`, "GET"), { params }),
      spy: world.loadCampaignResults,
      action: null,
      ownerOnly: false,
    },
    {
      name: "GET /api/marketing/rewards/results",
      call: () =>
        REWARD_RESULTS(
          request(
            `/api/marketing/rewards/results?from=2026-09-01&to=2026-09-30&b=${FOREIGN_BUSINESS}`,
            "GET",
          ),
        ),
      spy: world.loadRewardResults,
      action: null,
      ownerOnly: false,
    },
    {
      name: "GET /api/marketing/campaigns/:id",
      call: () => ONE(request(one, "GET"), { params }),
      spy: world.getCampaign,
      action: null,
      ownerOnly: false,
    },
    {
      name: "PATCH /api/marketing/campaigns/:id",
      call: () => PATCH(request(one, "PATCH", FIELDS), { params }),
      spy: world.updateCampaign,
      action: null,
      ownerOnly: false,
    },
    ...(
      [
        ["activate", ACTIVATE],
        ["pause", PAUSE],
        ["end", END],
        ["archive", ARCHIVE],
      ] as const
    ).map(([action, handler]) => ({
      name: `POST /api/marketing/campaigns/:id/${action}`,
      call: () =>
        handler(request(`${one}/${action}`, "POST", FIELDS), { params }),
      spy: world.transitionCampaign,
      action,
      ownerOnly: action === "archive" || action === "end",
    })),
    {
      name: "GET /api/marketing/templates",
      call: () =>
        TEMPLATES(request(`${templates}?b=${FOREIGN_BUSINESS}`, "GET")),
      spy: world.listTemplates,
      action: null,
      ownerOnly: false,
    },
    {
      name: "POST /api/marketing/templates/:key/enable",
      call: () =>
        ENABLE(request(`${templates}/missed_you/enable`, "POST", FIELDS), {
          params: ENABLE_KEY,
        }),
      spy: world.enableTemplate,
      action: null,
      ownerOnly: false,
    },
    {
      name: "POST /api/marketing/templates/:key/disable",
      call: () =>
        DISABLE(request(`${templates}/win_back/disable`, "POST", FIELDS), {
          params: DISABLE_KEY,
        }),
      spy: world.disableTemplate,
      action: null,
      ownerOnly: true,
    },
    // Spec 0103 — delegable like `enable`: the hours are reversible.
    {
      name: "GET /api/marketing/settings",
      call: () =>
        SETTINGS(
          request(`/api/marketing/settings?b=${FOREIGN_BUSINESS}`, "GET"),
        ),
      spy: world.loadMarketingSettings,
      action: null,
      ownerOnly: false,
    },
    {
      name: "PATCH /api/marketing/settings",
      call: () =>
        SETTINGS_PATCH(request(`/api/marketing/settings`, "PATCH", FIELDS)),
      spy: world.updateMarketingSettings,
      action: null,
      ownerOnly: false,
    },
    // Spec 0113 — delegable: the windows are reversible (DELETE goes back to the network).
    {
      name: "GET /api/marketing/valley/locations",
      call: () => VALLEY(request(`${valley}?b=${FOREIGN_BUSINESS}`, "GET")),
      spy: world.listValleyLocations,
      action: null,
      ownerOnly: false,
    },
    {
      name: "PUT /api/marketing/valley/locations/:locationId/windows",
      call: () =>
        WINDOWS_PUT(
          request(`${valley}/${FOREIGN_CAMPAIGN}/windows`, "PUT", FIELDS),
          { params: VALLEY_LOCATION },
        ),
      spy: world.replaceMerchantWindows,
      action: null,
      ownerOnly: false,
    },
    {
      name: "DELETE /api/marketing/valley/locations/:locationId/windows",
      call: () =>
        WINDOWS_DELETE(
          request(`${valley}/${FOREIGN_CAMPAIGN}/windows`, "DELETE"),
          { params: VALLEY_LOCATION },
        ),
      spy: world.clearMerchantWindows,
      action: null,
      ownerOnly: false,
    },
  ];
}

export const OWNER_ROW = {
  id: CALLER_BUSINESS,
  slug: "caller",
  countryCode: "EC",
  currencyCode: "USD",
  status: "active",
  suspensionReason: null,
};

export function signedInOwner(world: MarketingRoutesWorld) {
  world.session = { user: { id: "user-owner", emailVerified: true } };
  world.ownerContext.mockResolvedValue(OWNER_ROW);
  world.membershipContext.mockResolvedValue({
    id: CALLER_BUSINESS,
    slug: "caller",
    countryCode: "EC",
    currencyCode: "USD",
    // Spec 0072: el resolvedor selecciona el eje `status`, y el guard es fail-closed —
    // una fila sin `status` NO opera. Es la forma que devuelve la función real.
    status: "active",
    suspensionReason: null,
    // Spec 0086: el owner pasa el paso 3 sin mirar la columna, que es `'{}'` por CHECK.
    role: "owner",
    permissions: [],
  });
}
