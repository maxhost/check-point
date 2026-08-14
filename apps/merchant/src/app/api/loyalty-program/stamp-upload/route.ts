import { NextResponse } from "next/server";
import { getMerchantAuth } from "../../../../server/auth";
import {
  LoyaltyError,
  createStampUpload,
  ownerBusiness,
} from "../../../../server/loyalty-program";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getMerchantAuth().api.getSession({
    headers: request.headers,
  });
  if (!session)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const business = await ownerBusiness(session.user.id);
  if (!business)
    return NextResponse.json({ error: "Sin negocio." }, { status: 403 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "El cuerpo de la solicitud no es válido." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(await createStampUpload(business.id, body), {
      status: 201,
    });
  } catch (error) {
    if (error instanceof LoyaltyError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "No pudimos preparar la carga del sello." },
      { status: 503 },
    );
  }
}
