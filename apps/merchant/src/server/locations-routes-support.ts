import { NextRequest } from "next/server";
import type { vi } from "vitest";
import { GET, POST } from "../app/api/locations/route";
import { PATCH } from "../app/api/locations/[locationId]/route";
import { POST as STATUS } from "../app/api/locations/[locationId]/status/route";
import {
  GET as HOURS,
  PUT as HOURS_PUT,
} from "../app/api/locations/[locationId]/hours/route";

/**
 * The `HANDLERS` table of `locations-routes.test.ts`, split out when spec 0113 added the
 * two hours handlers and that file passed the size budget (the marketing table did the
 * same, `marketing-routes-support.ts`). It holds NO `vi.mock`: the mocks live in the test
 * file, which vitest hoists above every import, so these handlers already run against the
 * test's doubles, which come in as `world`.
 */

type Spy = ReturnType<typeof vi.fn>;

export type LocationsRoutesWorld = {
  listLocations: Spy;
  createLocation: Spy;
  updateLocation: Spy;
  setLocationStatus: Spy;
  getLocationHours: Spy;
  putLocationHours: Spy;
};

export const CALLER_BUSINESS = "11111111-1111-4111-8111-111111111111";
export const FOREIGN_BUSINESS = "22222222-2222-4222-8222-222222222222";
export const FOREIGN_LOCATION = "33333333-3333-4333-8333-333333333333";

export const request = (path: string, method: string, body?: unknown) =>
  new NextRequest(`https://merchant.test${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

export const params = Promise.resolve({ locationId: FOREIGN_LOCATION });

/**
 * The handlers of `api/locations/**`, each described by how to call it and which
 * domain function it must reach only AFTER the guard. Every call deliberately carries a
 * FOREIGN business/location in the URL, the query string and the path — the point is that
 * none of it can steer the handler.
 */
export function locationHandlers(world: LocationsRoutesWorld) {
  return [
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
    // Spec 0113 H1 — the opening hours, same guard.
    {
      name: "GET /api/locations/:locationId/hours",
      call: () =>
        HOURS(
          request(
            `/api/locations/${FOREIGN_LOCATION}/hours?b=${FOREIGN_BUSINESS}`,
            "GET",
          ),
          { params },
        ),
      spy: world.getLocationHours,
      businessArg: (args: unknown[]) => (args[0] as { id: string }).id,
    },
    {
      name: "PUT /api/locations/:locationId/hours",
      call: () =>
        HOURS_PUT(
          request(`/api/locations/${FOREIGN_LOCATION}/hours`, "PUT", {
            days: [],
            businessId: FOREIGN_BUSINESS,
          }),
          { params },
        ),
      spy: world.putLocationHours,
      businessArg: (args: unknown[]) => (args[0] as { id: string }).id,
    },
  ];
}
