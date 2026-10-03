import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 0136 C1/C2 — the EDGES of the two routes, with the session and the domain doubled:
 * 401 without a session, 400 `validation` with `fields.lat`/`fields.lng`, the consumer
 * taken from the SESSION and never from the request, a non-UUID id answered as the same
 * 404 `offer_unavailable` before touching the base. The flows themselves run against a
 * real base in `consumer-cross-offers*.neon.integration.test.ts`.
 *
 * Spec 0143 / ADR 0117 §5: the on-demand list is OFF, so those cases are skipped with the
 * flag (`CROSS_ON_DEMAND_ENABLED`, like spec 0138) and the last block pins the 404.
 */

const state = vi.hoisted(() => ({
  account: null as { id: string } | null,
  list: vi.fn(),
  claim: vi.fn(),
  claimValley: vi.fn(),
}));

vi.mock("@mi-pasaporte/domain/server/consumer/session", () => ({
  resolveSession: async () => state.account,
}));

vi.mock("@mi-pasaporte/domain/server/consumer/cross-offers", () => ({
  listCrossOffers: state.list,
  claimCrossOffer: state.claim,
}));

// Spec 0113: a claim WITH `locationId` is a valley claim.
vi.mock("@mi-pasaporte/domain/server/consumer/valley-offers", () => ({
  claimValleyOffer: state.claimValley,
}));

import { CROSS_ON_DEMAND_ENABLED } from "@mi-pasaporte/domain/server/marketing/enabled-campaigns";
import { GET } from "./route";
import { POST } from "./[campaignId]/claim/route";

const CAMPAIGN = "0112c1c2-0000-4000-8000-000000000001";
/** Spec 0143: the on-demand cases run only while the list is ON. */
const onDemand = describe.skipIf(!CROSS_ON_DEMAND_ENABLED);

function get(query = ""): NextRequest {
  return new NextRequest(
    `https://mp.test/api/public/consumer/cross-offers${query}`,
    { headers: { cookie: "consumer_session=token" } },
  );
}

function post(body?: string, id = CAMPAIGN) {
  return POST(
    new NextRequest(
      `https://mp.test/api/public/consumer/cross-offers/${id}/claim`,
      { method: "POST", body, headers: { cookie: "consumer_session=token" } },
    ),
    { params: Promise.resolve({ campaignId: id }) },
  );
}

beforeEach(() => {
  state.account = { id: "consumer-of-the-session" };
  state.list.mockReset().mockResolvedValue({ origin: "none", offers: [] });
  state.claim.mockReset().mockResolvedValue({ status: 404 });
  state.claimValley.mockReset().mockResolvedValue({ status: 404 });
});

onDemand("GET /api/public/consumer/cross-offers", () => {
  it("without a session is 401 unauthenticated and reads nothing", async () => {
    state.account = null;
    const response = await GET(get());
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "unauthenticated" });
    expect(state.list).not.toHaveBeenCalled();
  });

  it("passes the SESSION's consumer and the GPS; without coordinates, null", async () => {
    await GET(get("?lat=-34.6037&lng=-58.3816&consumerId=someone-else"));
    expect(state.list).toHaveBeenCalledWith("consumer-of-the-session", {
      latitude: -34.6037,
      longitude: -58.3816,
    });
    await GET(get());
    expect(state.list).toHaveBeenLastCalledWith(
      "consumer-of-the-session",
      null,
    );
  });

  it("400 validation: one without the other, not a number, out of range", async () => {
    for (const [query, field] of [
      ["?lat=-34.6", "lng"],
      ["?lng=-58.3", "lat"],
      ["?lat=abc&lng=-58.3", "lat"],
      ["?lat=-91&lng=-58.3", "lat"],
      ["?lat=-34.6&lng=180.5", "lng"],
      ["?lat=Infinity&lng=1", "lat"],
    ] as const) {
      const response = await GET(get(query));
      expect(response.status).toBe(400);
      const body = (await response.json()) as {
        code: string;
        fields: Record<string, string>;
      };
      expect(body.code).toBe("validation");
      expect(Object.keys(body.fields)).toContain(field);
    }
    expect(state.list).not.toHaveBeenCalled();
  });
});

onDemand("POST /api/public/consumer/cross-offers/{campaignId}/claim", () => {
  it("without a session is 401 unauthenticated and claims nothing", async () => {
    state.account = null;
    const response = await post();
    expect(response.status).toBe(401);
    expect(state.claim).not.toHaveBeenCalled();
  });

  it("claims for the SESSION's consumer (a consumerId in the body is ignored)", async () => {
    await post(JSON.stringify({ lat: -34.6, lng: -58.38, consumerId: "x" }));
    expect(state.claim).toHaveBeenCalledWith(
      "consumer-of-the-session",
      CAMPAIGN,
      { latitude: -34.6, longitude: -58.38 },
    );
    await post();
    expect(state.claim).toHaveBeenLastCalledWith(
      "consumer-of-the-session",
      CAMPAIGN,
      null,
    );
  });

  it("answers the domain's status: 201 and 200 with the coupon, 404 offer_unavailable", async () => {
    state.claim.mockResolvedValueOnce({ status: 201, coupon: { id: "c1" } });
    let response = await post("{}");
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ coupon: { id: "c1" } });
    state.claim.mockResolvedValueOnce({ status: 200, coupon: { id: "c1" } });
    expect((await post("{}")).status).toBe(200);
    response = await post("{}");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "offer_unavailable" });
  });

  it("a campaign id that is not a UUID is 404 offer_unavailable without reaching the domain", async () => {
    const response = await post("{}", "not-a-uuid");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "offer_unavailable" });
    expect(state.claim).not.toHaveBeenCalled();
  });

  it("400 validation for bad coordinates and for a body that is not JSON", async () => {
    for (const body of [
      JSON.stringify({ lat: -34.6 }),
      JSON.stringify({ lat: 95, lng: 0 }),
      JSON.stringify({ lat: true, lng: 0 }),
      "{not json",
    ]) {
      const response = await post(body);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "validation" });
    }
    expect(state.claim).not.toHaveBeenCalled();
  });
});

const VALLEY_CLAIM =
  "POST …/claim — spec 0113: `locationId` makes it a valley claim";

onDemand(VALLEY_CLAIM, () => {
  const LOCATION = "0113c2c2-0000-4000-8000-000000000002";

  it("with `locationId`: the valley claim, for the SESSION's consumer, never the cross one", async () => {
    state.claimValley.mockResolvedValueOnce({
      status: 201,
      coupon: { id: "v1" },
    });
    const response = await post(
      JSON.stringify({
        lat: -34.6,
        lng: -58.38,
        locationId: LOCATION,
        consumerId: "x",
      }),
    );
    expect(response.status).toBe(201);
    expect(state.claimValley).toHaveBeenCalledWith(
      "consumer-of-the-session",
      CAMPAIGN,
      LOCATION,
      { latitude: -34.6, longitude: -58.38 },
    );
    expect(state.claim).not.toHaveBeenCalled();
  });

  it("a `locationId` that is not a UUID is 400 fields.locationId before the domain", async () => {
    for (const locationId of ["abc", 7, null, ""]) {
      const response = await post(JSON.stringify({ locationId }));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: "validation",
        fields: { locationId: expect.any(String) },
      });
    }
    expect(state.claimValley).not.toHaveBeenCalled();
    expect(state.claim).not.toHaveBeenCalled();
  });

  it("the domain's 400 (locationId on a cross offer, or missing on a valley one) is 400 fields.locationId", async () => {
    const fields = { locationId: "Mensaje del dominio." };
    state.claimValley.mockResolvedValueOnce({ status: 400, fields });
    let response = await post(JSON.stringify({ locationId: LOCATION }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "validation", fields });
    state.claim.mockResolvedValueOnce({ status: 400, fields });
    response = await post("{}");
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "validation", fields });
  });
});

describe.skipIf(CROSS_ON_DEMAND_ENABLED)(
  "spec 0143 — the on-demand list is OFF: 404 not_found with a session",
  () => {
    it("C1 and C2 without a session are still 401", async () => {
      state.account = null;
      expect((await GET(get())).status).toBe(401);
      expect((await post("{}")).status).toBe(401);
    });

    it("C1 and C2 with a session are 404 not_found and never reach the domain", async () => {
      const list = await GET(get("?lat=-34.6&lng=-58.38"));
      expect(list.status).toBe(404);
      expect(await list.json()).toEqual({
        error: "No encontrado.",
        code: "not_found",
      });
      const claim = await post(
        JSON.stringify({ lat: -34.6, lng: -58.38, locationId: CAMPAIGN }),
      );
      expect(claim.status).toBe(404);
      expect(await claim.json()).toEqual({
        error: "No encontrado.",
        code: "not_found",
      });
      expect(state.list).not.toHaveBeenCalled();
      expect(state.claim).not.toHaveBeenCalled();
      expect(state.claimValley).not.toHaveBeenCalled();
    });
  },
);
