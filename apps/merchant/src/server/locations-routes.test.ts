import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const CALLER_BUSINESS = "11111111-1111-4111-8111-111111111111";
const FOREIGN_BUSINESS = "22222222-2222-4222-8222-222222222222";
const FOREIGN_LOCATION = "33333333-3333-4333-8333-333333333333";

const world = vi.hoisted(() => ({
  session: null as null | { user: { id: string } },
  ownerContext: vi.fn(),
  listLocations: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
  setLocationStatus: vi.fn(),
}));

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({ api: { getSession: async () => world.session } }),
}));

vi.mock("./staff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./staff")>()),
  ownerContext: world.ownerContext,
}));

// Only the four domain entry points are replaced; `LocationError` stays real, because
// `_auth.ts` maps it to the HTTP status and a fake would be testing the fake.
vi.mock("./locations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./locations")>()),
  listLocations: world.listLocations,
  createLocation: world.createLocation,
  updateLocation: world.updateLocation,
  setLocationStatus: world.setLocationStatus,
}));

import { GET, POST } from "../app/api/locations/route";
import { PATCH } from "../app/api/locations/[locationId]/route";
import { POST as STATUS } from "../app/api/locations/[locationId]/status/route";

const request = (path: string, method: string, body?: unknown) =>
  new NextRequest(`https://merchant.test${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const params = Promise.resolve({ locationId: FOREIGN_LOCATION });

/**
 * The four handlers of `api/locations/**`, each described by how to call it and which
 * domain function it must reach only AFTER the guard. Every call deliberately carries a
 * FOREIGN business/location in the URL, the query string and the path — the point is that
 * none of it can steer the handler.
 */
const HANDLERS = [
  {
    name: "GET /api/locations",
    call: () => GET(request(`/api/locations?b=${FOREIGN_BUSINESS}`, "GET")),
    spy: world.listLocations,
    /** Which argument carries the business the handler decided to act on. */
    businessArg: (args: unknown[]) => args[0],
  },
  {
    name: "POST /api/locations",
    call: () =>
      POST(
        request(`/api/locations?b=${FOREIGN_BUSINESS}`, "POST", {
          name: "Sucursal ajena",
          address: { label: "Calle 1" },
          businessId: FOREIGN_BUSINESS,
        }),
      ),
    spy: world.createLocation,
    businessArg: (args: unknown[]) => (args[0] as { id: string }).id,
  },
  {
    name: "PATCH /api/locations/:locationId",
    call: () =>
      PATCH(
        request(`/api/locations/${FOREIGN_LOCATION}`, "PATCH", {
          name: "Secuestrado",
          businessId: FOREIGN_BUSINESS,
        }),
        { params },
      ),
    spy: world.updateLocation,
    businessArg: (args: unknown[]) => (args[0] as { id: string }).id,
  },
  {
    name: "POST /api/locations/:locationId/status",
    call: () =>
      STATUS(
        request(`/api/locations/${FOREIGN_LOCATION}/status`, "POST", {
          status: "archived",
          businessId: FOREIGN_BUSINESS,
        }),
        { params },
      ),
    spy: world.setLocationStatus,
    businessArg: (args: unknown[]) => (args[0] as { id: string }).id,
  },
];

/**
 * Spec 0061, decision 4 — «only the owner administers locations», pinned at the HTTP
 * layer. The domain is already business-scoped and has its own isolation tests, but that
 * scoping only ever runs with the business the ROUTE hands it: if a handler dropped its
 * guard, every domain test would stay green while the endpoint answered to anybody. That
 * is the shape of spec 0046 (a locked door beside an open wall).
 *
 * Mutation EXECUTED and transcribed in the handoff: deleting the `requireLocationsOwner`
 * lines from a handler turns its 401 and 403 cases red.
 */
describe("api/locations — owner-only guard (spec 0061, decision 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    world.session = null;
    world.listLocations.mockResolvedValue([]);
    world.createLocation.mockResolvedValue({
      id: "loc-1",
      name: "X",
      addressLabel: "Y",
      status: "active",
    });
    world.updateLocation.mockResolvedValue({
      id: "loc-1",
      name: "X",
      addressLabel: "Y",
      status: "active",
    });
    world.setLocationStatus.mockResolvedValue({
      id: "loc-1",
      name: "X",
      addressLabel: "Y",
      status: "archived",
    });
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
      // `ownerContext` returns null for a staff member, for a disabled owner, and for a
      // user with no membership at all — the three ways this endpoint must say no.
      world.session = { user: { id: "user-staff" } };
      world.ownerContext.mockResolvedValue(null);
      const response = await call();
      expect(response.status).toBe(403);
      expect(spy).not.toHaveBeenCalled();
    },
  );

  it.each(HANDLERS)(
    "$name acts on the CALLER's business, never on one named by the request",
    async ({ call, spy, businessArg }) => {
      world.session = { user: { id: "user-owner" } };
      world.ownerContext.mockResolvedValue({
        id: CALLER_BUSINESS,
        currencyCode: "USD",
      });

      const response = await call();
      expect(response.status).toBeLessThan(400);
      expect(spy).toHaveBeenCalledTimes(1);

      // The request shouted a foreign business in the query string and in the body; the
      // handler must have ignored both and used what `ownerContext` resolved.
      const business = businessArg(spy.mock.calls[0] as unknown[]);
      expect(business).toBe(CALLER_BUSINESS);
      expect(business).not.toBe(FOREIGN_BUSINESS);
      // …and the session it resolved from is the caller's, not a header-supplied one.
      expect(world.ownerContext).toHaveBeenCalledWith("user-owner");
    },
  );

  it("a foreign locationId still travels to the domain, which answers 404", async () => {
    // The route does NOT pre-filter by ownership — the domain does, scoped to the
    // caller's business (`locations-limits.neon.integration.test.ts`). This pins that the
    // route forwards the id and surfaces the domain's status instead of swallowing it.
    world.session = { user: { id: "user-owner" } };
    world.ownerContext.mockResolvedValue({
      id: CALLER_BUSINESS,
      currencyCode: "USD",
    });
    const { LocationError } = await import("./locations");
    world.updateLocation.mockRejectedValue(
      new LocationError(404, "unknown_location", "Ese local no existe."),
    );

    const response = await PATCH(
      request(`/api/locations/${FOREIGN_LOCATION}`, "PATCH", { name: "X" }),
      { params },
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Ese local no existe.",
      code: "unknown_location",
    });
    expect(world.updateLocation).toHaveBeenCalledWith(
      { id: CALLER_BUSINESS },
      FOREIGN_LOCATION,
      { name: "X" },
    );
  });

  it("GET returns the domain list and nothing else", async () => {
    world.session = { user: { id: "user-owner" } };
    world.ownerContext.mockResolvedValue({
      id: CALLER_BUSINESS,
      currencyCode: "USD",
    });
    world.listLocations.mockResolvedValue([
      {
        id: "loc-1",
        name: "Centro",
        addressLabel: "Calle 1",
        status: "active",
      },
    ]);
    const response = await GET(request("/api/locations", "GET"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      locations: [
        {
          id: "loc-1",
          name: "Centro",
          addressLabel: "Calle 1",
          status: "active",
        },
      ],
    });
  });
});
