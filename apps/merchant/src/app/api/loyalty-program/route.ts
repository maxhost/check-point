import { NextResponse } from "next/server";
import { getMerchantAuth } from "../../../server/auth";
import {
  LoyaltyError,
  cancelClose,
  closeProgram,
  programForOwner,
  saveProgram,
} from "../../../server/loyalty-program";
import { toClientProgram } from "../../../server/loyalty-program/client-view";

async function sessionUser(request: Request) {
  return getMerchantAuth().api.getSession({ headers: request.headers });
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new LoyaltyError(400, "El cuerpo de la solicitud no es válido.");
  }
}

export async function GET(request: Request) {
  const session = await sessionUser(request);
  if (!session)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const result = await programForOwner(session.user.id);
  if (!result)
    return NextResponse.json({ error: "Sin negocio." }, { status: 403 });
  return NextResponse.json({
    business: result.business,
    program: toClientProgram(result.program, result.business.id),
  });
}

export async function PUT(request: Request) {
  const session = await sessionUser(request);
  if (!session)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const result = await saveProgram(session.user.id, await readJson(request));
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
  const session = await sessionUser(request);
  if (!session)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    await closeProgram(
      session.user.id,
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
  const session = await sessionUser(request);
  if (!session)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    action?: string;
  } | null;
  if (body?.action !== "cancel-close") {
    return NextResponse.json({ error: "Acción no válida." }, { status: 422 });
  }
  try {
    await cancelClose(session.user.id);
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
