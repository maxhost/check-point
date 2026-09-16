import { NextResponse } from "next/server";
import {
  parseAudiencePreviewQuery,
  previewAudience,
} from "../../../../server/marketing/audience-preview";
import { campaignError, requireMarketingOwner } from "../_auth";

export const dynamic = "force-dynamic";

/** GET /api/marketing/audience-preview?dormantDays=&locationIds= — the composer's
 * counts, over the caller's business only. */
export async function GET(request: Request) {
  const auth = await requireMarketingOwner(request);
  if ("response" in auth) return auth.response;
  try {
    const query = parseAudiencePreviewQuery(new URL(request.url).searchParams);
    return NextResponse.json({
      preview: await previewAudience(auth.business.id, query),
    });
  } catch (error) {
    return campaignError(error, "No pudimos calcular la audiencia.");
  }
}
