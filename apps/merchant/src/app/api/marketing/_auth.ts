import { NextResponse } from "next/server";
import {
  apiOwnerFailureResponse,
  requireApiOwner,
} from "../../../server/api-owner";
import { CampaignError } from "../../../server/marketing/campaign-store";
import { transitionCampaign } from "../../../server/marketing/campaign-actions";
import type { CampaignAction } from "../../../server/marketing/campaign-transitions";

/**
 * Resolves the caller as the OWNER of a business.
 *
 * **Desde la spec 0072 delega en `requireApiOwner`** —el resolvedor unico de las 10
 * superficies del owner—, que trae el filtro `memberships.status='active'`, el gate de
 * email verificado que esta superficie no tenia, y el eje `core.business.status`.
 *
 * It is NOT `requireOwner`: that one is a PAGE guard and answers with `redirect()`, which
 * on a POST is a 307 and not the 403 the spec's isolation item demands. The adversarial
 * review of this spec caught exactly that confusion before any code existed.
 */
export async function requireMarketingOwner(
  request: Request,
): Promise<
  { business: { id: string }; userId: string } | { response: NextResponse }
> {
  const auth = await requireApiOwner(request, {
    notOwner: "Solo el owner puede gestionar las campañas.",
    emailNotVerified: "Verificá tu email para gestionar las campañas.",
  });
  if ("failure" in auth) {
    return { response: apiOwnerFailureResponse(auth.failure) };
  }
  return { business: { id: auth.business.id }, userId: auth.userId };
}

/** `fields` travels only on a 400 `validation`: it is what lets the composer paint the
 * error next to the input instead of at the top of the page. */
export function campaignError(error: unknown, fallback: string): NextResponse {
  if (error instanceof CampaignError)
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        ...(error.fields ? { fields: error.fields } : {}),
      },
      { status: error.status },
    );
  return NextResponse.json({ error: fallback }, { status: 503 });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new CampaignError(400, "invalid_body", "El cuerpo no es válido.");
  }
}

/**
 * The four action routes are one handler with a different verb: same guard, same scope,
 * same error mapping. Writing them out four times is how the `pause` route ends up with
 * a `businessId` the others do not have.
 */
export function campaignActionRoute(action: CampaignAction, fallback: string) {
  return async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
  ) {
    const auth = await requireMarketingOwner(request);
    if ("response" in auth) return auth.response;
    try {
      const { id } = await params;
      return NextResponse.json(
        await transitionCampaign(auth.business.id, id, action),
      );
    } catch (error) {
      return campaignError(error, fallback);
    }
  };
}
