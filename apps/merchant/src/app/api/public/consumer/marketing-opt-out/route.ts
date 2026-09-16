import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "../../../../../server/consumer/core";
import { isUuid } from "../../../../../server/counter/core";
import { setMarketingOptOut } from "../../../../../server/consumer/marketing-opt-out";
import { resolveSession } from "../../../../../server/consumer/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Spec 0065, fase D — el interruptor «Promociones de {negocio}» de la pestaña de
 * Configuración del portal. Estrena el árbol `api/public/consumer/`.
 *
 * El consumidor sale de `resolveSession` (la cookie 0028) y NUNCA del cuerpo: un llamador
 * no puede apagarle —ni encenderle— las promociones a otro. El `programId` del cuerpo se
 * resuelve CONTRA su propia membresía dentro del mismo `UPDATE`, así que una membresía
 * ajena no escribe nada y contesta **404** (no 403: un 403 confirmaría que ese programa
 * existe, que es la enumeración que el ítem de aislamiento prohíbe).
 *
 * Efecto, para que quede dicho donde se lee: sale de la audiencia del próximo tick
 * (`opt_out`), sus turnos vivos se cancelan con esa razón y salen del pase en el refresco
 * siguiente. Lo transaccional y su saldo en el pase NO cambian — el saldo propio no es
 * publicidad (ADR 0065 §1).
 */
export async function POST(request: NextRequest) {
  const account = await resolveSession(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (!account) {
    return NextResponse.json(
      { error: "No autorizado.", code: "unauthenticated" },
      { status: 401 },
    );
  }

  let body: { programId?: unknown; optOut?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Cuerpo inválido.", code: "bad_request" },
      { status: 400 },
    );
  }
  // El `programId` se valida como UUID ANTES de tocar la base: `program_id` es una columna
  // `uuid`, así que compararla contra cualquier string tira `22P02` → 500 (la trampa que ya
  // documenta `CLAUDE.md` para el webhook). Un id mal formado es un 400, no una caída.
  const programId =
    typeof body.programId === "string" && isUuid(body.programId.trim())
      ? body.programId.trim()
      : null;
  // `optOut` se exige BOOLEANO: con un `Boolean(body.optOut)`, un `"false"` de un cliente
  // mal escrito apagaría las promociones creyendo encenderlas.
  if (programId === null || typeof body.optOut !== "boolean") {
    return NextResponse.json(
      { error: "Solicitud incompleta.", code: "bad_request" },
      { status: 400 },
    );
  }

  const result = await setMarketingOptOut({
    consumerId: account.id,
    programId,
    optOut: body.optOut,
  });
  if (!result.updated) {
    return NextResponse.json(
      { error: "No encontramos ese programa.", code: "not_found" },
      { status: 404 },
    );
  }
  return NextResponse.json({ marketingOptOut: result.marketingOptOut });
}
