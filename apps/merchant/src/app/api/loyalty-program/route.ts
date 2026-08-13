import { NextResponse } from "next/server";
import { getMerchantAuth } from "../../../server/auth";
import {
  LoyaltyError,
  closeProgram,
  programForOwner,
  saveProgram,
} from "../../../server/loyalty-program";

async function sessionUser(request: Request) {
  return getMerchantAuth().api.getSession({ headers: request.headers });
}

export async function GET(request: Request) {
  const session = await sessionUser(request);
  if (!session)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const result = await programForOwner(session.user.id);
  if (!result)
    return NextResponse.json({ error: "Sin negocio." }, { status: 403 });
  return NextResponse.json(result);
}

export async function PUT(request: Request) {
  const session = await sessionUser(request);
  if (!session)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const result = await saveProgram(session.user.id, await request.json());
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
      (await request.json()) as {
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
