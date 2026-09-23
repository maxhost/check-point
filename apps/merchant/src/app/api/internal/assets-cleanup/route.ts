import { NextResponse } from "next/server";
import { cleanupExpiredBrandAssets } from "../../../../server/brand";
import { cleanupExpiredLoyaltyAssets } from "../../../../server/loyalty-program";
import { cleanupExpiredCatalogAssets } from "../../../../server/catalog";
import { cleanupExpiredCatalogImports } from "../../../../server/catalog-import";

export const runtime = "nodejs";

/**
 * Spec 0090 §7 — la limpieza de la importacion **cuelga de este cron que ya existe**, en vez
 * de pedir uno nuevo: los dos de `vercel.json` son el maximo del plan Hobby y un tercero hace
 * que Vercel rechace el deploy entero.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const [brand, loyalty, catalog, catalogImports] = await Promise.all([
    cleanupExpiredBrandAssets(),
    cleanupExpiredLoyaltyAssets(),
    cleanupExpiredCatalogAssets(),
    cleanupExpiredCatalogImports(),
  ]);
  return NextResponse.json({
    ok: true,
    brand,
    loyalty,
    catalog,
    catalogImports,
  });
}
