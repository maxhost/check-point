import { NextResponse } from "next/server";
import { createTable, listTables } from "../../../../../server/tables/manage";
import { locationError, readJson, requireLocationsOwner } from "../../_auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ locationId: string }> };

/** GET /api/locations/:locationId/tables — spec 0182: the tables of a location, active and
 * archived. Same guard as every location route (`locations` permission). */
export async function GET(request: Request, { params }: Params) {
  const auth = await requireLocationsOwner(request);
  if ("response" in auth) return auth.response;
  try {
    const { locationId } = await params;
    return NextResponse.json({
      tables: await listTables(auth.business, locationId),
    });
  } catch (error) {
    return locationError(error, "No pudimos leer las mesas.");
  }
}

/** POST — `{ name, seats? }` → `201 { table }`. */
export async function POST(request: Request, { params }: Params) {
  const auth = await requireLocationsOwner(request);
  if ("response" in auth) return auth.response;
  try {
    const { locationId } = await params;
    const table = await createTable(
      auth.business,
      locationId,
      await readJson(request),
    );
    return NextResponse.json({ table }, { status: 201 });
  } catch (error) {
    return locationError(error, "No pudimos crear la mesa.");
  }
}
