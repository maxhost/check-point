import { NextResponse } from "next/server";
import { loadRewardResults } from "../../../../../server/marketing/reward-results";
import { campaignError, requireMarketingOwner } from "../../_auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/marketing/rewards/results?from=YYYY-MM-DD&to=YYYY-MM-DD — spec 0106 E4 (contract
 * `0106-contratos-de-api.md` §E4). The business is the SESSION's (`requireMarketingOwner`),
 * never the query string. An invalid range is a 400 `validation` on `from`/`to`.
 */
export async function GET(request: Request) {
  const auth = await requireMarketingOwner(request);
  if ("response" in auth) return auth.response;
  try {
    const query = new URL(request.url).searchParams;
    return NextResponse.json({
      currencyCode: auth.business.currencyCode,
      quality: "estimado_configurado",
      rewards: await loadRewardResults(
        auth.business.id,
        query.get("from"),
        query.get("to"),
      ),
    });
  } catch (error) {
    return campaignError(error, "No pudimos leer los resultados por premio.");
  }
}
