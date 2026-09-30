import { NextResponse } from "next/server";
import { listValleyLocations } from "../../../../../server/marketing/valley-windows";
import { campaignError, requireMarketingOwner } from "../../_auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketing/valley/locations — spec 0113 H2: per active location, the network's
 * proposal, the merchant's windows, which rule, and the 7×24 heat map. Delegable with the
 * `marketing` permission, scoped by the caller's business.
 */
export async function GET(request: Request) {
  const auth = await requireMarketingOwner(request);
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json({
      locations: await listValleyLocations(auth.business.id),
    });
  } catch (error) {
    return campaignError(error, "No pudimos leer las horas valle.");
  }
}
