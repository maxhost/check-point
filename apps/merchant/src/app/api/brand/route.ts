import { NextResponse } from "next/server";
import {
  apiOwnerFailureResponse,
  requireApiOwner,
} from "../../../server/api-owner";
import {
  BrandError,
  type BrandRecord,
  brandForBusiness,
  saveBrand,
} from "../../../server/brand";

export const runtime = "nodejs";

/**
 * Spec 0072 §D3 — las dos superficies de `/api/brand` resuelven owner con
 * `requireApiOwner`, el resolvedor unico. Antes resolvian a mano con `getSession` + el
 * resolvedor ad hoc del dominio, que **no filtra `memberships.status='active'`** y no tiene
 * gate de email: un integrante de baja y un owner sin verificar editaban la marca.
 */
const MESSAGES = {
  notOwner: "Solo el owner puede gestionar la marca.",
  emailNotVerified: "Verificá tu email para gestionar la marca.",
};

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
  const auth = await requireApiOwner(request, MESSAGES);
  if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
  const brand = await brandForBusiness(auth.business.id);
  if (!brand)
    return NextResponse.json(
      { error: "Sin negocio.", code: "not_owner" },
      { status: 403 },
    );
  return NextResponse.json(brandResponse(brand));
}

export async function PUT(request: Request) {
  const auth = await requireApiOwner(request, MESSAGES);
  if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
  try {
    // `saveBrand` sigue recibiendo el `userId` y resolviendo su propio negocio: cambiarle la
    // firma tocaria su optimistic lock y sus tests, y esta spec unifica el GUARD, no el
    // dominio. El guard de arriba ya decidio que este usuario es owner activo de un negocio
    // que opera.
    const brand = await saveBrand(auth.userId, await readJson(request));
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
