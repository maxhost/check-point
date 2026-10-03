import { NextResponse } from "next/server";
import {
  createCampaign,
  listCampaigns,
} from "../../../../server/marketing/campaign-store";
import { allowedCouponKinds } from "../../../../server/marketing/reward-store";
import { campaignError, readJson, requireMarketingOwner } from "../_auth";
import { campaignKindEnabled } from "@mi-pasaporte/domain/server/marketing/enabled-campaigns";

export const dynamic = "force-dynamic";

/** GET /api/marketing/campaigns — the campaigns of the caller's business. */
export async function GET(request: Request) {
  const auth = await requireMarketingOwner(request);
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json({
      campaigns: await listCampaigns(auth.business.id),
      currencyCode: auth.business.currencyCode,
      // Spec 0106 E1b: the reward types this business can choose today.
      couponKinds: await allowedCouponKinds(auth.business.id),
    });
  } catch (error) {
    return campaignError(error, "No pudimos leer tus campañas.");
  }
}

/** POST /api/marketing/campaigns — creates a `draft`. 400 `validation` per field. */
export async function POST(request: Request) {
  const auth = await requireMarketingOwner(request);
  if ("response" in auth) return auth.response;
  try {
    // Spec 0138: while the composer is OFF the body is not even read — `createCampaign`
    // answers 409 `campaign_disabled` first, so a broken JSON is not a 400 either.
    const campaign = await createCampaign(
      auth.business.id,
      auth.userId,
      campaignKindEnabled(null) ? await readJson(request) : undefined,
    );
    return NextResponse.json(
      { campaign, currencyCode: auth.business.currencyCode },
      { status: 201 },
    );
  } catch (error) {
    return campaignError(error, "No pudimos crear la campaña.");
  }
}
