import { NextResponse } from "next/server";
import { enableTemplate } from "../../../../../../server/marketing/template-store";
import { campaignError, readJson, requireMarketingOwner } from "../../../_auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/marketing/templates/:key/enable — creates the run already `active` (spec
 * 0101). Delegable with the `marketing` permission: create and activate already are
 * (ADR 0079 §2). Every body field is optional; `{}` is the template with its defaults.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const auth = await requireMarketingOwner(request);
  if ("response" in auth) return auth.response;
  try {
    const { key } = await params;
    const campaign = await enableTemplate(
      auth.business.id,
      auth.userId,
      key,
      await readJson(request),
    );
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    return campaignError(error, "No pudimos encender la campaña.");
  }
}
