import { NextResponse } from "next/server";
import {
  clearMerchantWindows,
  replaceMerchantWindows,
} from "../../../../../../../server/marketing/valley-windows";
import {
  campaignError,
  readJson,
  requireMarketingOwner,
} from "../../../../_auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ locationId: string }> };

/**
 * PUT /api/marketing/valley/locations/:locationId/windows — spec 0113 H2: replaces the
 * merchant's own windows (at least one; `[]` is a 400 — going back to the network is the
 * DELETE). Answers the location as `GET …/locations` paints it. A location of another
 * business is a 404.
 */
export async function PUT(request: Request, { params }: Params) {
  const auth = await requireMarketingOwner(request);
  if ("response" in auth) return auth.response;
  try {
    const { locationId } = await params;
    return NextResponse.json({
      location: await replaceMerchantWindows(
        auth.business.id,
        locationId,
        await readJson(request),
      ),
    });
  } catch (error) {
    return campaignError(error, "No pudimos guardar las franjas.");
  }
}

/** DELETE …/windows — the merchant's windows go; the network's rule again. `204`. */
export async function DELETE(request: Request, { params }: Params) {
  const auth = await requireMarketingOwner(request);
  if ("response" in auth) return auth.response;
  try {
    const { locationId } = await params;
    await clearMerchantWindows(auth.business.id, locationId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return campaignError(error, "No pudimos borrar las franjas.");
  }
}
