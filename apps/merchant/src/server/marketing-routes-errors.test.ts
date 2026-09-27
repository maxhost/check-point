import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * How a domain error of `api/marketing/**` becomes an HTTP answer. Split out of
 * `marketing-routes.test.ts` (spec 0103, size budget) with the SAME cases: that file keeps
 * the guard table, this one the `campaignError` mapping. Only the doubles these cases
 * reach are declared; `CampaignError` stays REAL (see there).
 */
const world = vi.hoisted(() => ({
  session: null as null | { user: { id: string; emailVerified: boolean } },
  membershipContext: vi.fn(),
  ownerContext: vi.fn(),
  listCampaigns: vi.fn(),
  createCampaign: vi.fn(),
  getCampaign: vi.fn(),
  updateCampaign: vi.fn(),
  transitionCampaign: vi.fn(),
  previewAudience: vi.fn(),
  loadCampaignResults: vi.fn(),
  listTemplates: vi.fn(),
  enableTemplate: vi.fn(),
  disableTemplate: vi.fn(),
  loadMarketingSettings: vi.fn(),
  updateMarketingSettings: vi.fn(),
}));

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({ api: { getSession: async () => world.session } }),
}));

vi.mock("./staff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./staff")>()),
  membershipContext: world.membershipContext,
  ownerContext: world.ownerContext,
}));

vi.mock("./marketing/campaign-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./marketing/campaign-store")>()),
  createCampaign: world.createCampaign,
}));

vi.mock("./marketing/campaign-actions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./marketing/campaign-actions")>()),
  transitionCampaign: world.transitionCampaign,
}));

import { POST } from "../app/api/marketing/campaigns/route";
import { POST as ACTIVATE } from "../app/api/marketing/campaigns/[id]/activate/route";
import { CampaignError } from "./marketing/campaign-store";
import {
  CAMPAIGN,
  FIELDS,
  base,
  one,
  params,
  request,
  signedInOwner as signIn,
} from "./marketing-routes-support";

const signedInOwner = () => signIn(world);

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
});
