import { NextResponse } from "next/server";
import { disableTemplate } from "../../../../../../server/marketing/template-store";
import { campaignError, requireCampaignOwner } from "../../../_auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/marketing/templates/:key/disable — apagar = FINALIZAR (ADR 0092 §4), which
 * is irreversible, so it is OWNER-ONLY like `end` (`403 not_owner`, ADR 0079 §2). No body.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const auth = await requireCampaignOwner(request);
  if ("response" in auth) return auth.response;
  try {
    const { key } = await params;
    return NextResponse.json(await disableTemplate(auth.business.id, key));
  } catch (error) {
    return campaignError(error, "No pudimos apagar la campaña.");
  }
}
