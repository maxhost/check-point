import { and, eq, sql } from "drizzle-orm";
import type { DbTransaction } from "@mi-pasaporte/db";
import { posOrders } from "@mi-pasaporte/db/schema";
import { ModuleError } from "../../errors";

/**
 * Spec 0169 / 0220 — ADR 0130 §5 y ADR 0141 §4 — LA REGLA PARA NO APAGAR EL POS. El toggle es el
 * generico del core (`PUT /api/modules/pos`, `modules/activation.ts`): la llama al APAGAR, bajo su
 * advisory lock EXCLUSIVO y despues de `module_required_by` (Mesas encendido va primero). Con alguna
 * orden `open` del negocio → 409 `pos_has_open_orders` con `openCount` (el modal pide cerrarlas).
 *
 * Crear una orden toma el MISMO lock en modo compartido y relee el modulo (`lockModuleEnabled`,
 * `orders.ts`): sin eso, una orden creada mientras se apaga quedaria abierta en un modulo apagado —
 * justo lo que el owner prohibio («no se puede desactivar con ordenes abiertas»). Apagar NO borra el
 * permiso `pos` de quien lo tiene: queda sin efecto (lo corta el despachador con `module_disabled`).
 */
export async function posBeforeDisable(
  tx: DbTransaction,
  businessId: string,
): Promise<ModuleError | null> {
  const [open] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(posOrders)
    .where(
      and(eq(posOrders.businessId, businessId), eq(posOrders.status, "open")),
    );
  const openCount = Number(open?.count ?? 0);
  if (openCount === 0) return null;
  return new ModuleError(
    409,
    "pos_has_open_orders",
    "No puedes desactivar el POS con órdenes abiertas. Ciérralas o anúlalas primero.",
    { openCount },
  );
}
