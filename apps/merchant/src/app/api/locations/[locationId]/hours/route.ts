import { NextResponse } from "next/server";
import {
  getLocationHours,
  putLocationHours,
} from "../../../../../server/locations";
import { locationError, readJson, requireLocationsOwner } from "../../_auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ locationId: string }> };

/**
 * GET /api/locations/:locationId/hours — spec 0113 H1: the opening hours of a location,
 * always the 7 days. Same guard as every location route (`locations` permission) and
 * business-scoped: a location of another business is a 404.
 */
export async function GET(request: Request, { params }: Params) {
  const auth = await requireLocationsOwner(request);
  if ("response" in auth) return auth.response;
  try {
    const { locationId } = await params;
    return NextResponse.json(await getLocationHours(auth.business, locationId));
  } catch (error) {
    return locationError(error, "No pudimos leer el horario.");
  }
}

/** PUT — replaces the whole week; `400 validation` with `fields["days.N.ranges.M"]`. */
export async function PUT(request: Request, { params }: Params) {
  const auth = await requireLocationsOwner(request);
  if ("response" in auth) return auth.response;
  try {
    const { locationId } = await params;
    const result = await putLocationHours(
      auth.business,
      locationId,
      await readJson(request),
    );
    if (!result.ok)
      return NextResponse.json(
        {
          error: "Revisa el horario.",
          code: "validation",
          fields: result.fields,
        },
        { status: 400 },
      );
    return NextResponse.json(result.hours);
  } catch (error) {
    return locationError(error, "No pudimos guardar el horario.");
  }
}
