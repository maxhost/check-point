import { NextResponse } from "next/server";
import { getMerchantAuth } from "../../../server/auth";
import {
  BrandError,
  type BrandRecord,
  ownerBusiness,
  saveBrand,
} from "../../../server/brand";

export const runtime = "nodejs";

async function sessionUser(request: Request) {
  return getMerchantAuth().api.getSession({ headers: request.headers });
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new BrandError(400, "El cuerpo de la solicitud no es válido.");
  }
}

/** Client-facing shape: never leaks the internal R2 `logoObjectKey`, only a public path. */
function brandResponse(brand: BrandRecord) {
  const { logoObjectKey, ...rest } = brand;
  return {
    ...rest,
    logoPath: logoObjectKey
      ? `/api/public/brands/${brand.id}/logo?v=${brand.logoVersion}`
      : null,
  };
}

export async function GET(request: Request) {
  const session = await sessionUser(request);
  if (!session)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const brand = await ownerBusiness(session.user.id);
  if (!brand)
    return NextResponse.json({ error: "Sin negocio." }, { status: 403 });
  return NextResponse.json(brandResponse(brand));
}

export async function PUT(request: Request) {
  const session = await sessionUser(request);
  if (!session)
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const brand = await saveBrand(session.user.id, await readJson(request));
    return NextResponse.json(brandResponse(brand));
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
