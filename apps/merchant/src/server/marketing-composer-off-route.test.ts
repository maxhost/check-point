import { describe, expect, it, vi } from "vitest";

// Only the session guard is replaced: the route and `createCampaign` are REAL, with the
// REAL `enabled-campaigns.ts` (spec 0138 — no mock of the module).
vi.mock("../app/api/marketing/_auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/api/marketing/_auth")>()),
  requireMarketingOwner: async () => ({
    business: {
      id: "00000000-0000-4000-8000-000000000001",
      currencyCode: "USD",
    },
    userId: "user-owner",
  }),
}));

import { POST } from "../app/api/marketing/campaigns/route";

/**
 * Spec 0138 §6-bis — `POST /api/marketing/campaigns` with the composer OFF answers 409
 * `campaign_disabled` BEFORE reading the body: a broken JSON is not a 400 `invalid_body`.
 */
describe("POST /api/marketing/campaigns with the composer off", () => {
  it.each([
    ["a broken JSON", "{no-json"],
    ["a valid body", JSON.stringify({ name: "Vuelvan", message: "Hola" })],
  ])("%s → 409 campaign_disabled", async (_label, body) => {
    const response = await POST(
      new Request("https://merchant.test/api/marketing/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Esta campaña no está disponible por ahora.",
      code: "campaign_disabled",
    });
  });
});
