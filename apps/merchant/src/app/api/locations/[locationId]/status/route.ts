import { NextResponse } from "next/server";
import { setLocationStatus } from "../../../../../server/locations";
import { locationError, readJson, requireLocationsOwner } from "../../_auth";

export const dynamic = "force-dynamic";

/** POST /api/locations/:locationId/status — archives (`archived`) or reactivates
 * (`active`) a location. The last active location cannot be archived. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ locationId: string }> },
) {
  const auth = await requireLocationsOwner(request);
  if ("response" in auth) return auth.response;
  try {
    const { locationId } = await params;
    const body = (await readJson(request)) as { status?: unknown };
    const location = await setLocationStatus(
      auth.business,
      locationId,
      body?.status,
    );
    return NextResponse.json({ location });
  } catch (error) {
    return locationError(error, "No pudimos actualizar el local.");
  }
}
