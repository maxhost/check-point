import { NextResponse } from "next/server";
import { BUSINESS_CATEGORIES } from "../../../../lib/business-categories";

export const dynamic = "force-dynamic";

/**
 * GET /api/onboarding/prefill — contrato P3 de la spec 0155: las categorias del paso 1 del
 * alta.
 *
 * **Es PUBLICA**: el paso 1 (el negocio) va antes que el email, asi que todavia no hay
 * sesion (ADR 0121 §1). Solo devuelve la lista curada, que no es de nadie.
 *
 * Ya no trae `countries`, `suggestedCountryCode` ni `bias` (spec 0069 §D3): el pais sale
 * del lugar de Google, la zona de sus coordenadas y el sesgo lo aplica el servidor en
 * `POST /api/places/autocomplete`.
 */
export async function GET() {
  return NextResponse.json({
    categories: BUSINESS_CATEGORIES.map((category) => ({
      gcid: category.gcid,
      displayName: category.displayName,
    })),
  });
}
