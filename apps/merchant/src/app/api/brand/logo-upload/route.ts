import { NextResponse } from "next/server";
import { getMerchantAuth } from "../../../../server/auth";
import { BrandError, createLogoUpload } from "../../../../server/brand";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getMerchantAuth().api.getSession({
    headers: request.headers,
  });
  if (!session)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    return NextResponse.json(
      await createLogoUpload(session.user.id, await request.json()),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof BrandError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "No pudimos preparar la carga del logo." },
      { status: 503 },
    );
  }
}
