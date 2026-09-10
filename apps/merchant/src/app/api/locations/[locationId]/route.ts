import { NextResponse } from "next/server";
import { updateLocation } from "../../../../server/locations";
import { locationError, readJson, requireLocationsOwner } from "../_auth";

export const dynamic = "force-dynamic";

/** PATCH /api/locations/:locationId — renames a location and/or moves its address.
 * Business-scoped: a location of another business is a 404, never an edit. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ locationId: string }> },
) {
  const auth = await requireLocationsOwner(request);
  if ("response" in auth) return auth.response;
  try {
    const { locationId } = await params;
    const location = await updateLocation(
      auth.business,
      locationId,
      await readJson(request),
    );
    return NextResponse.json({ location });
  } catch (error) {
    return locationError(error, "No pudimos actualizar el local.");
  }
}
