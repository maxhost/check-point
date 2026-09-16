import { NextResponse } from "next/server";
import { getCampaign } from "../../../../../../server/marketing/campaign-store";
import { loadCampaignResults } from "../../../../../../server/marketing/results-store";
import { campaignError, requireMarketingOwner } from "../../../_auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketing/campaigns/:id/results — business-scoped: another owner's id is a
 * 404, and it is `getCampaign` that decides it. Reading the campaign first is not
 * redundant: it is what resolves the 404 AND what carries the coupon's label and cap,
 * which the results need and no count query knows.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMarketingOwner(request);
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    const campaign = await getCampaign(auth.business.id, id);
    return NextResponse.json({
      results: await loadCampaignResults(auth.business.id, campaign.id, {
        label: campaign.couponLabel,
        cap: campaign.couponMaxRedemptions,
      }),
    });
  } catch (error) {
    return campaignError(error, "No pudimos leer los resultados.");
  }
}
