import { NextResponse } from "next/server";
import { getMerchantAuth } from "../../../../server/auth";
import { SUPPORTED_COUNTRIES } from "../../../../server/location-providers";
import { currencyForCountry } from "../../../../lib/currencies";
import { BUSINESS_CATEGORIES } from "../../../../lib/business-categories";

export const dynamic = "force-dynamic";

/**
 * Spec 0069 §D3 / ADR 0070 §8 y §14 — el prellenado de la pantalla 2 del wizard.
 *
 * Tres invariantes que son el contrato de esta ruta:
 *
 * 1. **`countries` va SIEMPRE completa.** La deteccion por IP es una sugerencia, jamas un
 *    filtro: un comerciante detras de una VPN tiene que poder elegir su pais igual. Un
 *    `x-vercel-ip-country` de un pais NO soportado devuelve `suggestedCountryCode: null`
 *    y la lista **intacta**.
 * 2. **El timezone NO sale de aca.** Lo resuelve el cliente con
 *    `Intl.DateTimeFormat().resolvedOptions().timeZone`, que ahi es exacto y en el
 *    servidor seria adivinado. Esta escrito en el contrato para que la UI no lo espere.
 * 3. **NO exige email verificado** (ADR 0070 §11): la verificacion bloquea lo posterior
 *    al wizard, no el wizard. Agregarle el gate dejaria el alta cerrada con llave.
 */
const coordinate = (raw: string | null) => {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

export async function GET(request: Request) {
  const session = await getMerchantAuth().api.getSession({
    headers: request.headers,
  });
  if (!session) {
    return NextResponse.json(
      { error: "No autorizado.", code: "unauthorized" },
      { status: 401 },
    );
  }
  const countries = SUPPORTED_COUNTRIES.map((country) => ({
    code: country.code,
    name: country.name,
    currencyCode: currencyForCountry(country.code),
  }));
  const detected = request.headers
    .get("x-vercel-ip-country")
    ?.trim()
    .toUpperCase();
  const suggestedCountryCode =
    detected && countries.some((country) => country.code === detected)
      ? detected
      : null;
  const latitude = coordinate(request.headers.get("x-vercel-ip-latitude"));
  const longitude = coordinate(request.headers.get("x-vercel-ip-longitude"));
  return NextResponse.json({
    countries,
    suggestedCountryCode,
    // Sesgo para el autocomplete de Geoapify. Las dos coordenadas o ninguna: media
    // posicion no sesga nada y obligaria a la UI a chequear cada campo por separado.
    bias:
      latitude !== null && longitude !== null ? { latitude, longitude } : null,
    categories: BUSINESS_CATEGORIES.map((category) => ({
      gcid: category.gcid,
      displayName: category.displayName,
    })),
  });
}
