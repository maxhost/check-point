import { NextResponse } from "next/server";
import {
  getCampaign,
  updateCampaign,
} from "../../../../../server/marketing/campaign-store";
import { campaignError, readJson, requireMarketingOwner } from "../../_auth";

export const dynamic = "force-dynamic";

/** GET /api/marketing/campaigns/:id — business-scoped: another owner's id is a 404. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMarketingOwner(request);
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    return NextResponse.json({
      campaign: await getCampaign(auth.business.id, id),
    });
  } catch (error) {
    return campaignError(error, "No pudimos leer la campaña.");
  }
}

/** PATCH — only in `draft`/`paused`; anything else is 409 `not_editable`. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireMarketingOwner(request);
  if ("response" in auth) return auth.response;
  try {
    const { id } = await params;
    return NextResponse.json({
      campaign: await updateCampaign(
        auth.business.id,
        id,
        await readJson(request),
      ),
    });
  } catch (error) {
    return campaignError(error, "No pudimos actualizar la campaña.");
  }
}
