import { NextResponse } from "next/server";
import {
  SlugError,
  changeBusinessSlug,
} from "../../../../../server/business-slug";
import { requireStaffOwner } from "../../../staff/_auth";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/merchant/business/slug — el cambio EXPLÍCITO del identificador del negocio
 * (spec 0067 §1, ADR 0070 §12). Es posterior al alta: el wizard no expone el campo.
 *
 * El negocio sale de la SESIÓN (`requireStaffOwner`, el mismo resolvedor owner+activo que
 * usa el alta de staff), nunca del cuerpo: si el `businessId` viajara, sería un parámetro
 * con el que un owner podría renombrar el negocio de otro. Ese guard trae además el gate de
 * email verificado, que es lo que hace que esto sea «posterior al wizard» de verdad.
 *
 * Contrato: `docs/specs/0067-contratos-de-api.md` §8.
 */
export async function PATCH(request: Request) {
  const auth = await requireStaffOwner(request);
  if ("response" in auth) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "El cuerpo no es válido.", code: "invalid_body" },
      { status: 400 },
    );
  }

  try {
    const { slug } = await changeBusinessSlug(
      auth.business.id,
      (body as { slug?: unknown } | null)?.slug ?? null,
    );
    return NextResponse.json({ slug }, { status: 200 });
  } catch (error) {
    if (error instanceof SlugError)
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          ...(error.suggestion === undefined
            ? {}
            : { suggestion: error.suggestion }),
        },
        { status: error.status },
      );
    console.error("merchant_business_slug_failed", {
      name: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json(
      {
        error: "No pudimos guardar el identificador.",
        code: "slug_unavailable",
      },
      { status: 503 },
    );
  }
}
