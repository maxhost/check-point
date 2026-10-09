import { NextResponse } from "next/server";
import {
  assertLocationInBusiness,
  parseUuid,
} from "@mi-pasaporte/domain/server/counter/core";
import { businessCatalog } from "../../../../server/counter/resolve-catalog";
import { posError, requirePosOperator } from "../../../../server/pos/auth";
import { bestSellingProductIds } from "../../../../server/pos/best-sellers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `GET /api/pos/catalog?locationId=` (spec 0169): el catalogo del mostrador (`businessCatalog`,
 * filtrado por `availableAtCounter`) SIN los productos sin precio, para cargar la orden, mas
 * `bestSellingProductIds` (`server/pos/best-sellers.ts`). Un local ajeno o archivado → 422. */
export async function GET(request: Request) {
  const auth = await requirePosOperator(request);
  if ("response" in auth) return auth.response;
  try {
    const raw = new URL(request.url).searchParams.get("locationId");
    const locationId = raw
      ? await assertLocationInBusiness(
          auth.business.id,
          parseUuid(raw, "locationId"),
        )
      : null;
    const catalog = await businessCatalog(auth.business.id, locationId);
    // El POS cobra a precio de catalogo: un producto SIN precio (null) no llega; precio 0 si.
    const products = catalog.products.filter(
      (product) => product.unitPrice !== null,
    );
    return NextResponse.json({
      ...catalog,
      products,
      bestSellingProductIds: await bestSellingProductIds(
        auth.business.id,
        locationId,
        products.map((product) => product.id),
      ),
    });
  } catch (error) {
    return posError(error, "No pudimos leer el catálogo.");
  }
}
