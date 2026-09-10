import { NextResponse } from "next/server";
import { createLocation, listLocations } from "../../../server/locations";
import { locationError, readJson, requireLocationsOwner } from "./_auth";

export const dynamic = "force-dynamic";

/** GET /api/locations — the owner's locations (name, address, status; nothing else). */
export async function GET(request: Request) {
  const auth = await requireLocationsOwner(request);
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json({
      locations: await listLocations(auth.business.id),
    });
  } catch (error) {
    return locationError(error, "No pudimos leer tus locales.");
  }
}

/** POST /api/locations — creates a location. The plan cap is enforced server-side. */
export async function POST(request: Request) {
  const auth = await requireLocationsOwner(request);
  if ("response" in auth) return auth.response;
  try {
    const location = await createLocation(
      auth.business,
      await readJson(request),
    );
    return NextResponse.json({ location }, { status: 201 });
  } catch (error) {
    return locationError(error, "No pudimos crear el local.");
  }
}
