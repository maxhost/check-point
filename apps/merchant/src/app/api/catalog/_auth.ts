import { NextResponse } from "next/server";
import { getMerchantAuth } from "../../../server/auth";
import {
  CatalogError,
  type OwnerBusiness,
  ownerBusiness,
} from "../../../server/catalog";

/** Resolves the owner's business or returns the 401/403 response to send. */
export async function requireOwner(
  request: Request,
): Promise<{ business: OwnerBusiness } | { response: NextResponse }> {
  const session = await getMerchantAuth().api.getSession({
    headers: request.headers,
  });
  if (!session) {
    return {
      response: NextResponse.json({ error: "No autorizado." }, { status: 401 }),
    };
  }
  const business = await ownerBusiness(session.user.id);
  if (!business) {
    return {
      response: NextResponse.json({ error: "Sin negocio." }, { status: 403 }),
    };
  }
  return { business };
}

export function catalogError(error: unknown, fallback: string): NextResponse {
  if (error instanceof CatalogError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }
  return NextResponse.json({ error: fallback }, { status: 503 });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new CatalogError(400, "El cuerpo de la solicitud no es válido.");
  }
}
