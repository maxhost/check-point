import { NextResponse } from "next/server";
import { getMerchantAuth } from "../../../server/auth";
import { BrandError, ownerBusiness, saveBrand } from "../../../server/brand";

export const runtime = "nodejs";

async function sessionUser(request: Request) {
  return getMerchantAuth().api.getSession({ headers: request.headers });
}

export async function GET(request: Request) {
  const session = await sessionUser(request);
  if (!session)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const brand = await ownerBusiness(session.user.id);
  if (!brand)
    return NextResponse.json({ error: "Sin negocio." }, { status: 403 });
  return NextResponse.json({
    ...brand,
    logoPath: brand.logoObjectKey
      ? `/api/public/brands/${brand.id}/logo?v=${brand.logoVersion}`
      : null,
  });
}

export async function PUT(request: Request) {
  const session = await sessionUser(request);
  if (!session)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const brand = await saveBrand(session.user.id, await request.json());
    return NextResponse.json({
      ...brand,
      logoPath: brand.logoObjectKey
        ? `/api/public/brands/${brand.id}/logo?v=${brand.logoVersion}`
        : null,
    });
  } catch (error) {
    if (error instanceof BrandError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "No pudimos guardar la marca." },
      { status: 503 },
    );
  }
}
