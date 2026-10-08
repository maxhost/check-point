import { and, asc, desc, eq, gte, isNotNull, max, sql, sum } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { posOrderItems, posOrders } from "@mi-pasaporte/db/schema";

/** Ventana del ranking de mas vendidos: los ultimos 30 dias corridos, contados por `closed_at`. */
export const BEST_SELLERS_WINDOW_DAYS = 30;

/**
 * `bestSellingProductIds` de `GET /api/pos/catalog` (spec 0169 §Contrato): los productos del
 * catalogo ordenados por unidades vendidas en el POS, de mayor a menor.
 *
 * - Cuenta las ordenes **cerradas** (con y sin pase); las anuladas y las abiertas no.
 * - Por local: solo las ordenes de `locationId`; sin local, las de todo el negocio.
 * - Empate: la venta mas reciente primero, despues el id (orden estable).
 * - Solo devuelve ids que estan en `catalogIds` (el catalogo que la misma respuesta manda): un
 *   producto borrado, archivado o no disponible en ese local no aparece.
 */
export async function bestSellingProductIds(
  businessId: string,
  locationId: string | null,
  catalogIds: readonly string[],
): Promise<string[]> {
  const units = sum(posOrderItems.quantity);
  const rows = await getDb()
    .select({ productId: posOrderItems.productId })
    .from(posOrderItems)
    .innerJoin(posOrders, eq(posOrders.id, posOrderItems.posOrderId))
    .where(
      and(
        eq(posOrders.businessId, businessId),
        eq(posOrders.status, "closed"),
        gte(
          posOrders.closedAt,
          sql`now() - make_interval(days => ${BEST_SELLERS_WINDOW_DAYS})`,
        ),
        locationId === null ? undefined : eq(posOrders.locationId, locationId),
        isNotNull(posOrderItems.productId),
      ),
    )
    .groupBy(posOrderItems.productId)
    .orderBy(
      desc(units),
      desc(max(posOrders.closedAt)),
      asc(posOrderItems.productId),
    );
  const inCatalog = new Set(catalogIds);
  return rows
    .map((row) => row.productId as string)
    .filter((id) => inCatalog.has(id));
}
