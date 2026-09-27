import { NextResponse } from "next/server";
import {
  loadMarketingSettings,
  updateMarketingSettings,
} from "../../../../server/marketing/push-settings";
import { campaignError, readJson, requireMarketingOwner } from "../_auth";

export const dynamic = "force-dynamic";

/**
 * GET/PATCH /api/marketing/settings — the business's campaign-push hours (spec 0103 §11).
 * Delegable with the `marketing` permission, like `enable`. Always the SESSION's business.
 */
export async function GET(request: Request) {
  const auth = await requireMarketingOwner(request);
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json({
      settings: await loadMarketingSettings(auth.business.id),
    });
  } catch (error) {
    return campaignError(error, "No pudimos leer la configuración.");
  }
}

export async function PATCH(request: Request) {
  const auth = await requireMarketingOwner(request);
  if ("response" in auth) return auth.response;
  try {
    return NextResponse.json({
      settings: await updateMarketingSettings(
        auth.business.id,
        await readJson(request),
      ),
    });
  } catch (error) {
    return campaignError(error, "No pudimos guardar la configuración.");
  }
}
