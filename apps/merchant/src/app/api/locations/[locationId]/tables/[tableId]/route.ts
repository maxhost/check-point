import { NextResponse } from "next/server";
import { updateTable } from "../../../../../../server/tables/manage";
import { locationError, readJson, requireLocationsOwner } from "../../../_auth";

export const dynamic = "force-dynamic";

/** PATCH /api/locations/:locationId/tables/:tableId — spec 0182: `{ name?, seats?, sortOrder? }`
 * (`seats: null` clears it). A table is never deleted: it is archived (`/status`). */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ locationId: string; tableId: string }> },
) {
  const auth = await requireLocationsOwner(request);
  if ("response" in auth) return auth.response;
  try {
    const { locationId, tableId } = await params;
    const table = await updateTable(
      auth.business,
      locationId,
      tableId,
      await readJson(request),
    );
    return NextResponse.json({ table });
  } catch (error) {
    return locationError(error, "No pudimos actualizar la mesa.");
  }
}
