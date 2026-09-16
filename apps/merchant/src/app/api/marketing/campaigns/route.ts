import { NextResponse } from "next/server";
import {
  createCampaign,
  listCampaigns,
} from "../../../../server/marketing/campaign-store";
import { campaignError, readJson, requireMarketingOwner } from "../_auth";

export const dynamic = "force-dynamic";

/** GET /api/marketing/campaigns — the campaigns of the caller's business. */
export async function GET(request: Request) {
  const auth = await requireMarketingOwner(request);
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json({
      campaigns: await listCampaigns(auth.business.id),
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
    const campaign = await createCampaign(
      auth.business.id,
      auth.userId,
      await readJson(request),
    );
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    return campaignError(error, "No pudimos crear la campaña.");
  }
}
