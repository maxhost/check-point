import { NextResponse } from "next/server";
import {
  apiOwnerFailureResponse,
  requireApiOwner,
} from "../../../server/api-owner";
import { requireApiPermission } from "../../../server/api-permission";
import { CampaignError } from "../../../server/marketing/campaign-store";
import { transitionCampaign } from "../../../server/marketing/campaign-actions";
import type { CampaignAction } from "../../../server/marketing/campaign-transitions";

/**
 * Spec 0086 §3 — EL GUARD DE `/api/marketing/*`: el permiso `marketing`.
 *
 * **Desde la spec 0072 delegaba en `requireApiOwner`** —el filtro `memberships.status`, el
 * gate de email que esta superficie no tenia y el eje `core.business.status` vienen de ahi—;
 * desde la 0086 delega en `requireApiPermission`.
 *
 * **CAMBIO DE CONTRATO:** deja de contestar `not_owner`; ahora `not_member` o
 * `missing_permission`.
 *
 * It is NOT `requireOwner`: that one is a PAGE guard and answers with `redirect()`, which
 * on a POST is a 307 and not the 403 the spec's isolation item demands. The adversarial
 * review of that spec caught exactly that confusion before any code existed.
 */
export async function requireMarketingOwner(
  request: Request,
): Promise<
  { business: { id: string }; userId: string } | { response: NextResponse }
> {
  const auth = await requireApiPermission(request, "marketing", {
    missingPermission: "No tienes permiso para gestionar las campañas.",
    emailNotVerified: "Verificá tu email para gestionar las campañas.",
  });
  if ("failure" in auth) {
    return { response: apiOwnerFailureResponse(auth.failure) };
  }
  return { business: { id: auth.business.id }, userId: auth.userId };
}

/**
 * **LO IRREVERSIBLE DE MARKETING SIGUE SIENDO DEL OWNER** (ADR 0079 §2, contrato 0086 §2.1):
 * `archive` y `end` no se deshacen, asi que ningun toggle los abre y conservan
 * `requireApiOwner` con su `403 not_owner`, que ahi sigue siendo literal.
 *
 * `pause` y `activate` SI se delegan: son reversibles y es decision textual del owner
 * («van», 2026-09-20).
 */
export async function requireCampaignOwner(
  request: Request,
): Promise<
  { business: { id: string }; userId: string } | { response: NextResponse }
> {
  const auth = await requireApiOwner(request, {
    notOwner: "Solo el owner puede archivar o finalizar una campaña.",
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
 * Las CUATRO acciones que no se deshacen igual: `archive` y `end` son irreversibles y
 * **owner-only**; `pause` y `activate` son reversibles y **van con el permiso `marketing`**
 * (ADR 0079 §2).
 *
 * El guard sale de la ACCION y no de un parametro del llamador a proposito: una ruta nueva
 * que se sume a esta fabrica hereda la clasificacion en vez de elegirla, y una accion
 * irreversible que alguien agregue sin tocar esta lista cae del lado **delegable** — por eso
 * el conjunto owner-only esta aseverado en `marketing-permission.test.ts`.
 */
const ACCIONES_SOLO_DEL_OWNER: ReadonlySet<CampaignAction> = new Set([
  "archive",
  "end",
]);

export function campaignActionRoute(action: CampaignAction, fallback: string) {
  return async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
  ) {
    const auth = ACCIONES_SOLO_DEL_OWNER.has(action)
      ? await requireCampaignOwner(request)
      : await requireMarketingOwner(request);
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
