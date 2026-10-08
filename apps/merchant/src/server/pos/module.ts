import { and, eq, sql } from "drizzle-orm";
import { type DbTransaction, getDb, withDbTransaction } from "@mi-pasaporte/db";
import { businesses, posOrders } from "@mi-pasaporte/db/schema";
import { PosError, posDisabled } from "./errors";

/**
 * Spec 0169 / ADR 0130 §5 — EL MODULO POS por comercio (`core.business.pos_enabled`, apagado por
 * defecto, en todos los planes). Encender/apagar y crear una orden se SERIALIZAN sobre la fila de
 * `core.business`: apagar la toma `FOR UPDATE` y cuenta las abiertas; crear la toma `FOR SHARE` y
 * relee el modulo. Sin eso, una orden creada mientras se apaga quedaria abierta en un modulo
 * apagado — justo lo que el owner prohibio («no se puede desactivar con ordenes abiertas»).
 */

/** Lectura sin lock, la del guard (`requirePosOperator`). */
export async function readPosEnabled(businessId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ posEnabled: businesses.posEnabled })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);
  return row?.posEnabled === true;
}

/** La relectura de CREAR, bajo `FOR SHARE` de la fila del negocio, en la transaccion que inserta
 * la orden. Apagado entre medio → 403 `pos_disabled`. */
export async function assertPosEnabledLocked(
  tx: DbTransaction,
  businessId: string,
): Promise<void> {
  const [row] = await tx
    .select({ posEnabled: businesses.posEnabled })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .for("share");
  if (row?.posEnabled !== true) throw posDisabled();
}

/**
 * `PUT /api/merchant/business/pos` (owner). Encender no tiene condicion; apagar con alguna orden
 * `open` del negocio es 409 `pos_has_open_orders` con `openCount` (el modal pide cerrarlas).
 * Idempotente: apagar un modulo apagado o encender uno encendido contesta lo mismo.
 * Apagar NO borra el permiso `pos` de quien lo tiene: queda sin efecto (lo corta el guard).
 */
export async function setPosEnabled(
  businessId: string,
  enabled: boolean,
): Promise<{ enabled: boolean }> {
  return withDbTransaction(async (tx) => {
    await tx
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.id, businessId))
      .for("update");
    if (!enabled) {
      const [open] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(posOrders)
        .where(
          and(
            eq(posOrders.businessId, businessId),
            eq(posOrders.status, "open"),
          ),
        );
      const openCount = Number(open?.count ?? 0);
      if (openCount > 0) {
        throw new PosError(
          409,
          "pos_has_open_orders",
          "No puedes desactivar el POS con órdenes abiertas. Ciérralas o anúlalas primero.",
          { openCount },
        );
      }
    }
    await tx
      .update(businesses)
      .set({ posEnabled: enabled })
      .where(eq(businesses.id, businessId));
    return { enabled };
  });
}
