import { NextResponse } from "next/server";
import { listTemplates } from "../../../../server/marketing/template-store";
import { allowedCouponKinds } from "../../../../server/marketing/reward-store";
import { campaignError, requireMarketingOwner } from "../_auth";

export const dynamic = "force-dynamic";

/** GET /api/marketing/templates — the prebuilt campaigns (spec 0101), in catalog order,
 * each with its live run and its previous ones. */
export async function GET(request: Request) {
  const auth = await requireMarketingOwner(request);
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json({
      templates: await listTemplates(auth.business.id),
      currencyCode: auth.business.currencyCode,
      // Spec 0106 E1b: the reward types this business can choose today.
      couponKinds: await allowedCouponKinds(auth.business.id),
    });
  } catch (error) {
    return campaignError(error, "No pudimos leer las campañas prearmadas.");
  }
}
