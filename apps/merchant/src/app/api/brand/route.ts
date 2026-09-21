import { NextResponse } from "next/server";
import { apiOwnerFailureResponse } from "../../../server/api-owner";
import { requireApiPermission } from "../../../server/api-permission";
import {
  BrandError,
  type BrandRecord,
  brandForBusiness,
  saveBrand,
} from "../../../server/brand";

export const runtime = "nodejs";

/**
 * Spec 0072 §D3 — las dos superficies de `/api/brand` dejaron de resolver a mano con
 * `getSession` + el resolvedor ad hoc del dominio, que **no filtra
 * `memberships.status='active'`** y no tiene gate de email.
 *
 * **Spec 0086 §3 — y ahora el guard es `requireApiPermission` con el alcance `brand`.**
 * Conserva los pasos 1, 4 y 5 de la escalera y suma los dos del medio; el `code` de rechazo
 * pasa de `not_owner` a `not_member` / `missing_permission`.
 */
const MESSAGES = {
  missingPermission: "No tienes permiso para gestionar la marca.",
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
  const auth = await requireApiPermission(request, "brand", MESSAGES);
  if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
  const brand = await brandForBusiness(auth.business.id);
  if (!brand)
    return NextResponse.json(
      { error: "Sin negocio.", code: "not_member" },
      { status: 403 },
    );
  return NextResponse.json(brandResponse(brand));
}

export async function PUT(request: Request) {
  const auth = await requireApiPermission(request, "brand", MESSAGES);
  if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
  try {
    // Spec 0086 §10 — **EL `businessId` DEL GUARD VIAJA AL WRITER.** Hasta la enmienda,
    // `saveBrand` re-resolvia el negocio por `userId` con `role='owner'`, asi que un
    // integrante con `brand` pasaba esta puerta y moria abajo con «No tienes un negocio como
    // owner». El `userId` sigue yendo porque el optimistic lock y la auditoria lo usan.
    const brand = await saveBrand(
      auth.userId,
      await readJson(request),
      auth.business.id,
    );
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
