import { NextResponse } from "next/server";
import { setTableStatus } from "../../../../../../../server/tables/manage";
import {
  locationError,
  readJson,
  requireLocationsOwner,
} from "../../../../_auth";

export const dynamic = "force-dynamic";

/** POST /api/locations/:locationId/tables/:tableId/status — spec 0182: archives
 * (`archived`) or reactivates (`active`) a table. A table with an open POS order cannot be
 * archived (409 `table_has_open_order`). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ locationId: string; tableId: string }> },
) {
  const auth = await requireLocationsOwner(request);
  if ("response" in auth) return auth.response;
  try {
    const { locationId, tableId } = await params;
    const table = await setTableStatus(
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
