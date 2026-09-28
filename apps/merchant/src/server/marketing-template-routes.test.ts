import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 0101 — what the three template routes hand the domain and how they answer. The
 * GUARDS of the same routes (401, 403 `not_owner` on `disable`, the caller's business) are
 * in `marketing-routes.test.ts`, over the shared `HANDLERS` table of
 * `marketing-routes-support.ts`; the cases here are the ones that are not guards.
 */

const CALLER_BUSINESS = "11111111-1111-4111-8111-111111111111";
const FOREIGN_BUSINESS = "22222222-2222-4222-8222-222222222222";

const world = vi.hoisted(() => ({
  session: null as null | { user: { id: string; emailVerified: boolean } },
  membershipContext: vi.fn(),
  ownerContext: vi.fn(),
  listTemplates: vi.fn(),
  enableTemplate: vi.fn(),
  disableTemplate: vi.fn(),
  allowedCouponKinds: vi.fn(),
}));

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({ api: { getSession: async () => world.session } }),
}));

vi.mock("./staff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./staff")>()),
  membershipContext: world.membershipContext,
  ownerContext: world.ownerContext,
}));

// Spec 0106 E1b: `couponKinds` of the reads. Only the informer is replaced; the write-side
// checks of the same module stay real.
vi.mock("./marketing/reward-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./marketing/reward-store")>()),
  allowedCouponKinds: world.allowedCouponKinds,
}));

vi.mock("./marketing/template-store", () => ({
  listTemplates: world.listTemplates,
  enableTemplate: world.enableTemplate,
  disableTemplate: world.disableTemplate,
}));

import { GET as TEMPLATES } from "../app/api/marketing/templates/route";
import { POST as ENABLE } from "../app/api/marketing/templates/[key]/enable/route";
import { POST as DISABLE } from "../app/api/marketing/templates/[key]/disable/route";
import { CampaignError } from "./marketing/campaign-store";

const base = "https://merchant.test/api/marketing/templates";
const post = (path: string, body?: unknown) =>
  new NextRequest(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const key = (value: string) => ({ params: Promise.resolve({ key: value }) });

const CAMPAIGN = { id: "camp-1", name: "Te extrañamos", status: "active" };
const NOTICE = "Los turnos activos se retiran en el próximo refresco.";
const BODY = { dormantDays: 14, businessId: FOREIGN_BUSINESS };

describe("api/marketing/templates — what reaches the domain and what comes back", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    world.session = { user: { id: "user-owner", emailVerified: true } };
    const row = {
      id: CALLER_BUSINESS,
      slug: "caller",
      countryCode: "EC",
      currencyCode: "USD",
      status: "active",
      suspensionReason: null,
    };
    world.ownerContext.mockResolvedValue(row);
    world.membershipContext.mockResolvedValue({
      ...row,
      role: "owner",
      permissions: [],
    });
    world.allowedCouponKinds.mockResolvedValue([
      "free_product",
      "two_for_one",
      "discount",
      "extra_stamps",
    ]);
  });

  it("GET answers the catalog the domain built for the caller's business", async () => {
    world.listTemplates.mockResolvedValue([{ key: "missed_you" }]);
    const response = await TEMPLATES(
      new NextRequest(`${base}?b=${FOREIGN_BUSINESS}`),
    );
    expect(response.status).toBe(200);
    // Spec 0106: the business currency travels at the root, from the guard's own row, and
    // (E1b) the reward types THIS business can choose, asked for the CALLER's business.
    expect(await response.json()).toEqual({
      templates: [{ key: "missed_you" }],
      currencyCode: "USD",
      couponKinds: ["free_product", "two_for_one", "discount", "extra_stamps"],
    });
    expect(world.allowedCouponKinds).toHaveBeenCalledWith(CALLER_BUSINESS);
    expect(world.listTemplates).toHaveBeenCalledWith(CALLER_BUSINESS);
  });

  it("enable hands the key of the PATH and the body, and answers 201 { campaign }", async () => {
    world.enableTemplate.mockResolvedValue(CAMPAIGN);
    const response = await ENABLE(
      post("/missed_you/enable", BODY),
      key("missed_you"),
    );
    expect(world.enableTemplate).toHaveBeenCalledWith(
      CALLER_BUSINESS,
      "user-owner",
      "missed_you",
      BODY,
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      campaign: CAMPAIGN,
      currencyCode: "USD",
    });
  });

  it("disable hands the key of the PATH and answers 200 { campaign, notice }", async () => {
    world.disableTemplate.mockResolvedValue({
      campaign: CAMPAIGN,
      notice: NOTICE,
    });
    const response = await DISABLE(post("/win_back/disable"), key("win_back"));
    expect(world.disableTemplate).toHaveBeenCalledWith(
      CALLER_BUSINESS,
      "win_back",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      campaign: CAMPAIGN,
      notice: NOTICE,
      currencyCode: "USD",
    });
  });

  it.each([
    { status: 404, code: "template_not_live" },
    { status: 409, code: "template_already_live" },
    { status: 402, code: "plan_not_allowed" },
  ])(
    "a CampaignError $status `$code` keeps its status and code",
    async (kind) => {
      const error = new CampaignError(kind.status, kind.code, "Del dominio.");
      world.enableTemplate.mockRejectedValue(error);
      world.disableTemplate.mockRejectedValue(error);
      for (const response of [
        await ENABLE(post("/missed_you/enable", {}), key("missed_you")),
        await DISABLE(post("/missed_you/disable"), key("missed_you")),
      ]) {
        expect(response.status).toBe(kind.status);
        expect(await response.json()).toEqual({
          error: "Del dominio.",
          code: kind.code,
        });
      }
    },
  );

  it("enable with a body that is not JSON is 400 `invalid_body` and never reaches the domain", async () => {
    const response = await ENABLE(
      new NextRequest(`${base}/missed_you/enable`, {
        method: "POST",
        body: "{no-json",
      }),
      key("missed_you"),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_body");
    expect(world.enableTemplate).not.toHaveBeenCalled();
  });
});
