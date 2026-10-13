import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { DbTransaction } from "@mi-pasaporte/db";
import { posOrders } from "@mi-pasaporte/db/schema";
import { ModuleError } from "../../errors";

/**
 * Spec 0220 / ADR 0141 §4 y §5 — LA REGLA PARA NO APAGAR MESAS (owner 2026-10-13: «Mesas no se
 * apaga con ordenes abiertas en una mesa»). La llama el toggle generico del core bajo su lock
 * EXCLUSIVO; abrir o mover una orden a una mesa toma el mismo lock COMPARTIDO y relee Mesas
 * (`modules/pos/server/tables.ts`), asi que nunca queda una orden abierta con mesa y Mesas apagado.
 * Las mesas quedan guardadas: vuelven al reencender.
 */
export async function tablesBeforeDisable(
  tx: DbTransaction,
  businessId: string,
): Promise<ModuleError | null> {
  const [open] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(posOrders)
    .where(
      and(
        eq(posOrders.businessId, businessId),
        eq(posOrders.status, "open"),
        isNotNull(posOrders.diningTableId),
      ),
    );
  const openCount = Number(open?.count ?? 0);
  if (openCount === 0) return null;
  return new ModuleError(
    409,
    "tables_has_open_orders",
    "No puedes desactivar las mesas con órdenes abiertas en una mesa. Ciérralas o anúlalas primero.",
    { openCount },
  );
}
