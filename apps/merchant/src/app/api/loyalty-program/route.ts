import { NextResponse } from "next/server";
import {
  apiOwnerFailureResponse,
  requireApiOwner,
} from "../../../server/api-owner";
import {
  LoyaltyError,
  cancelClose,
  closeProgram,
  programForOwner,
  saveProgram,
} from "../../../server/loyalty-program";
import { toClientProgram } from "../../../server/loyalty-program/client-view";

/**
 * Spec 0072 §D3 — las CUATRO superficies de esta ruta resuelven owner con
 * `requireApiOwner`. Antes cada verbo hacia `getSession` pelado y delegaba la resolucion de
 * negocio en el dominio, que **no filtra `memberships.status='active'`** y no tiene gate de
 * email: un integrante de baja editaba el programa de fidelizacion.
 *
 * Las funciones de dominio siguen recibiendo el `userId` y resolviendo su propio negocio:
 * esta spec unifica el GUARD, no el dominio.
 */
const MESSAGES = {
  notOwner: "Solo el owner puede gestionar el programa.",
  emailNotVerified: "Verificá tu email para gestionar el programa.",
};

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new LoyaltyError(400, "El cuerpo de la solicitud no es válido.");
  }
}

export async function GET(request: Request) {
  const auth = await requireApiOwner(request, MESSAGES);
  if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
  const result = await programForOwner(auth.userId);
  if (!result)
    return NextResponse.json(
      { error: "Sin negocio.", code: "not_owner" },
      { status: 403 },
    );
  return NextResponse.json({
    business: result.business,
    program: toClientProgram(
      result.program,
      result.business.id,
      result.rewards,
    ),
  });
}

export async function PUT(request: Request) {
  const auth = await requireApiOwner(request, MESSAGES);
  if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
  try {
    const result = await saveProgram(auth.userId, await readJson(request));
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof LoyaltyError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "No pudimos guardar el programa." },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireApiOwner(request, MESSAGES);
  if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
  try {
    await closeProgram(
      auth.userId,
      (await readJson(request)) as {
        earningEndsAt?: string;
        redemptionEndsAt?: string;
      },
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof LoyaltyError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "No pudimos retirar el programa." },
      { status: 503 },
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireApiOwner(request, MESSAGES);
  if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
  const body = (await request.json().catch(() => null)) as {
    action?: string;
  } | null;
  if (body?.action !== "cancel-close") {
    return NextResponse.json({ error: "Acción no válida." }, { status: 422 });
  }
  try {
    await cancelClose(auth.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof LoyaltyError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "No pudimos cancelar el cierre." },
      { status: 503 },
    );
  }
}
