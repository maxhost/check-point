import { NextResponse } from "next/server";
import { getMerchantAuth } from "../../../server/auth";
import {
  LoyaltyError,
  programForOwner,
  publishProgram,
  type PublishInput,
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

export async function POST(request: Request) {
  const session = await sessionUser(request);
  if (!session)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const result = await publishProgram(
      session.user.id,
      (await request.json()) as PublishInput,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof LoyaltyError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "No pudimos publicar el programa." },
      { status: 503 },
    );
  }
}
