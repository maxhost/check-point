import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const CALLER_BUSINESS = "11111111-1111-4111-8111-111111111111";
const FOREIGN_BUSINESS = "22222222-2222-4222-8222-222222222222";
const FOREIGN_CAMPAIGN = "33333333-3333-4333-8333-333333333333";

const world = vi.hoisted(() => ({
  session: null as null | { user: { id: string } },
  ownerContext: vi.fn(),
  listCampaigns: vi.fn(),
  createCampaign: vi.fn(),
  getCampaign: vi.fn(),
  updateCampaign: vi.fn(),
  transitionCampaign: vi.fn(),
  previewAudience: vi.fn(),
  loadCampaignResults: vi.fn(),
}));

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({ api: { getSession: async () => world.session } }),
}));

vi.mock("./staff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./staff")>()),
  ownerContext: world.ownerContext,
}));

// Only the domain entry points are replaced. `CampaignError` stays REAL: `_auth.ts` maps
// it to the HTTP status through an `instanceof`, and a fake class would make that
// `instanceof` false — the test would then be pinning the fake instead of the mapping.
vi.mock("./marketing/campaign-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./marketing/campaign-store")>()),
  listCampaigns: world.listCampaigns,
  createCampaign: world.createCampaign,
  getCampaign: world.getCampaign,
  updateCampaign: world.updateCampaign,
}));

vi.mock("./marketing/campaign-actions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./marketing/campaign-actions")>()),
  transitionCampaign: world.transitionCampaign,
}));

// `parseAudiencePreviewQuery` stays REAL: it is the route's 400 `validation`, and a fake
// would mean the query string is never actually parsed by anything this test runs.
vi.mock("./marketing/audience-preview", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./marketing/audience-preview")>()),
  previewAudience: world.previewAudience,
}));

vi.mock("./marketing/results-store", () => ({
  loadCampaignResults: world.loadCampaignResults,
}));

import { GET, POST } from "../app/api/marketing/campaigns/route";
import { GET as ONE, PATCH } from "../app/api/marketing/campaigns/[id]/route";
import { POST as ACTIVATE } from "../app/api/marketing/campaigns/[id]/activate/route";
import { POST as PAUSE } from "../app/api/marketing/campaigns/[id]/pause/route";
import { POST as END } from "../app/api/marketing/campaigns/[id]/end/route";
import { POST as ARCHIVE } from "../app/api/marketing/campaigns/[id]/archive/route";
import { GET as PREVIEW } from "../app/api/marketing/audience-preview/route";
import { GET as RESULTS } from "../app/api/marketing/campaigns/[id]/results/route";
import { CampaignError } from "./marketing/campaign-store";
import { MARKETING_ROUTE_NAMES } from "./marketing-route-names";

const request = (path: string, method: string, body?: unknown) =>
  new NextRequest(`https://merchant.test${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined
      ? {}
      : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });

const params = Promise.resolve({ id: FOREIGN_CAMPAIGN });
const base = `/api/marketing/campaigns`;
const one = `${base}/${FOREIGN_CAMPAIGN}`;
/** Every body shouts a foreign business, which no handler may honour. */
const FIELDS = { name: "Ajena", businessId: FOREIGN_BUSINESS };

const CAMPAIGN = { id: "camp-1", name: "Vecinos", status: "draft" };

/**
 * The eight handlers of `api/marketing/**`, each with how to call it and which domain
 * function it must reach ONLY after the guard. Every call carries a foreign business in
 * the query string and in the body, and a foreign campaign id in the path — none of it
 * may steer the handler.
 */
const HANDLERS = [
  {
    name: "GET /api/marketing/campaigns",
    call: () => GET(request(`${base}?b=${FOREIGN_BUSINESS}`, "GET")),
    spy: world.listCampaigns,
    action: null,
  },
  {
    name: "POST /api/marketing/campaigns",
    call: () => POST(request(`${base}?b=${FOREIGN_BUSINESS}`, "POST", FIELDS)),
    spy: world.createCampaign,
    action: null,
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
  },
  {
    name: "GET /api/marketing/campaigns/:id/results",
    call: () => RESULTS(request(`${one}/results`, "GET"), { params }),
    spy: world.loadCampaignResults,
    action: null,
  },
  {
    name: "GET /api/marketing/campaigns/:id",
    call: () => ONE(request(one, "GET"), { params }),
    spy: world.getCampaign,
    action: null,
  },
  {
    name: "PATCH /api/marketing/campaigns/:id",
    call: () => PATCH(request(one, "PATCH", FIELDS), { params }),
    spy: world.updateCampaign,
    action: null,
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
  })),
];

function signedInOwner() {
  world.session = { user: { id: "user-owner" } };
  world.ownerContext.mockResolvedValue({
    id: CALLER_BUSINESS,
    currencyCode: "USD",
  });
}

/**
 * Spec 0065, DoD [B] isolation — «staff cannot create or activate a campaign → 403»,
 * pinned at the HTTP layer. The two `marketing-*.neon…` suites exercise the STORE, which
 * is already business-scoped — but that scoping only ever runs with the business the
 * ROUTE hands it. If a handler dropped its guard every one of those tests would stay
 * green while the endpoint answered to anybody: spec 0046's locked door beside an open
 * wall.
 */
describe("api/marketing — owner-only guard (spec 0065, DoD [B])", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    world.session = null;
    world.listCampaigns.mockResolvedValue([]);
    world.createCampaign.mockResolvedValue(CAMPAIGN);
    world.getCampaign.mockResolvedValue(CAMPAIGN);
    world.updateCampaign.mockResolvedValue(CAMPAIGN);
    world.transitionCampaign.mockResolvedValue({ campaign: CAMPAIGN });
    world.previewAudience.mockResolvedValue({ quality: "observada" });
    world.loadCampaignResults.mockResolvedValue({ turns: {} });
  });

  it.each(HANDLERS)(
    "$name answers 401 to an anonymous caller and never reaches the domain",
    async ({ call, spy }) => {
      world.session = null;
      const response = await call();
      expect(response.status).toBe(401);
      expect(spy).not.toHaveBeenCalled();
      expect(world.ownerContext).not.toHaveBeenCalled();
    },
  );

  it.each(HANDLERS)(
    "$name answers 403 to a signed-in caller who is not an owner",
    async ({ call, spy }) => {
      // `ownerContext` returns null for a STAFF member, for a disabled owner and for a
      // user with no membership: the three ways this endpoint must say no.
      world.session = { user: { id: "user-staff" } };
      world.ownerContext.mockResolvedValue(null);
      const response = await call();
      expect(response.status).toBe(403);
      expect(spy).not.toHaveBeenCalled();
    },
  );

  it.each(HANDLERS)(
    "$name acts on the CALLER's business, never on one named by the request",
    async ({ call, spy }) => {
      signedInOwner();
      const response = await call();
      expect(response.status).toBeLessThan(400);
      expect(spy).toHaveBeenCalledTimes(1);
      const business = (spy.mock.calls[0] as unknown[])[0];
      expect(business).toBe(CALLER_BUSINESS);
      expect(business).not.toBe(FOREIGN_BUSINESS);
      expect(world.ownerContext).toHaveBeenCalledWith("user-owner");
    },
  );

  it.each(HANDLERS.filter((h) => h.action !== null))(
    "$name asks the domain for ITS OWN action",
    async ({ call, action }) => {
      // The four action routes are one factory with a different argument, so a
      // copy-paste that leaves `pause` calling `end` typechecks and looks right.
      signedInOwner();
      await call();
      expect(world.transitionCampaign).toHaveBeenCalledWith(
        CALLER_BUSINESS,
        FOREIGN_CAMPAIGN,
        action,
      );
    },
  );
});

describe("api/marketing — how the domain's error becomes an answer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedInOwner();
    world.transitionCampaign.mockResolvedValue({ campaign: CAMPAIGN });
  });

  it.each([
    { status: 402, code: "plan_not_allowed" },
    { status: 404, code: "not_found" },
    { status: 409, code: "invalid_transition" },
  ])("a CampaignError $status keeps its status and its code", async (kind) => {
    world.transitionCampaign.mockRejectedValue(
      new CampaignError(kind.status, kind.code, "Mensaje del dominio."),
    );
    const response = await ACTIVATE(request(`${one}/activate`, "POST", {}), {
      params,
    });
    expect(response.status).toBe(kind.status);
    expect(await response.json()).toEqual({
      error: "Mensaje del dominio.",
      code: kind.code,
    });
  });

  it("a 400 validation carries `fields`, which is what paints the composer", async () => {
    world.createCampaign.mockRejectedValue(
      new CampaignError(400, "validation", "Revisá los datos.", {
        message: "Máximo 60 caracteres.",
      }),
    );
    const response = await POST(request(base, "POST", FIELDS));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Revisá los datos.",
      code: "validation",
      fields: { message: "Máximo 60 caracteres." },
    });
  });

  it("a body that is not JSON is a 400 `invalid_body` and never reaches the domain", async () => {
    const response = await POST(request(base, "POST", "{no-json"));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_body");
    expect(world.createCampaign).not.toHaveBeenCalled();
  });

  it("anything else is a 503 that says nothing about the failure", async () => {
    // The exact `toEqual` IS the assertion: a host or a stack here would leak to the browser.
    world.createCampaign.mockRejectedValue(
      new Error("connect ECONNREFUSED 10.0.0.5:5432"),
    );
    const response = await POST(request(base, "POST", FIELDS));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "No pudimos crear la campaña.",
    });
  });

  // The other half of this check lives in `marketing-routes-coverage.test.ts`, which
  // derives the same names from the FILESYSTEM. Together: a route that exists is
  // declared, and a route that is declared has its guard exercised above.
  it("HANDLERS covers exactly the declared routes, no more and no less", () => {
    expect([...new Set(HANDLERS.map((h) => h.name))].sort()).toEqual(
      [...MARKETING_ROUTE_NAMES].sort(),
    );
  });
});
