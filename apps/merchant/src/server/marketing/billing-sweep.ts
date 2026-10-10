import { eq, sql } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { subscriptions } from "@mi-pasaporte/db/schema";
import { accessSql } from "@mi-pasaporte/domain/server/billing-access";
import { lockBusiness } from "../locations/shared";
import { syncCampaignsWithAccess } from "./plan-brake";

/**
 * Spec 0189 §D4 — EL BARRIDO DIARIO DE COBRO (`/api/internal/billing-sweep`). Vencer la prueba
 * no dispara ningún evento: sin esto, las campañas activas de un negocio que perdió el acceso
 * seguirían enviando. Y al revés, una prueba EXTENDIDA a mano (skill `/extender-prueba`) no
 * pasa por el webhook: el barrido es lo que le devuelve las campañas.
 *
 * Dos pasos:
 *  1. CANDIDATOS por SQL (`accessSql`, la definición SQL del eje): negocios con campañas
 *     `active` SIN acceso, o con campañas pausadas por `billing_blocked` CON acceso.
 *  2. Por negocio, UNA transacción con `lockBusiness`: se relee la fila y se decide con
 *     `billingAccess` (TS) bajo el lock — entre la lectura de candidatos y la escritura cabe un
 *     pago — y `syncCampaignsWithAccess` pausa o reanuda.
 *
 * Idempotente: una segunda corrida no encuentra candidatos y devuelve `{paused: 0, resumed: 0}`.
 * Lag declarado (ADR 0134): entre el vencimiento y el barrido, hasta ~24 h.
 */
export async function runBillingSweep(
  now = new Date(),
  /** SOLO para las suites de integración: acota el barrido a sus negocios para no pausar las
   * campañas de otro archivo que corre en paralelo sobre la misma rama (el mismo recorte que
   * `cancelTurns(db, businessIds)` de `turn-lifecycle.ts`). La ruta nunca lo pasa. */
  businessIds?: string[],
): Promise<{ paused: number; resumed: number }> {
  const scope =
    businessIds === undefined
      ? sql``
      : businessIds.length === 0
        ? sql`and false`
        : sql`and c.business_id in (${sql.join(
            businessIds.map((id) => sql`${id}`),
            sql`, `,
          )})`;
  const result = await getDb().execute<{ business_id: string }>(sql`
    select distinct c.business_id
    from core.campaign c
    left join core.subscription s on s.business_id = c.business_id
    where ((c.status = 'active' and not ${accessSql("s", now)})
       or (c.pause_reason = 'billing_blocked' and ${accessSql("s", now)}))
      ${scope}
    order by c.business_id`);
  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  let paused = 0;
  let resumed = 0;
  for (const { business_id: businessId } of rows) {
    const moved = await withDbTransaction(async (tx) => {
      await lockBusiness(tx, businessId);
      const [row] = await tx
        .select({
          plan: subscriptions.plan,
          status: subscriptions.status,
          stripeSubscriptionId: subscriptions.stripeSubscriptionId,
          trialEndsAt: subscriptions.trialEndsAt,
        })
        .from(subscriptions)
        .where(eq(subscriptions.businessId, businessId))
        .limit(1);
      return syncCampaignsWithAccess(tx, businessId, row ?? null, now);
    });
    paused += moved.paused;
    resumed += moved.resumed;
  }
  return { paused, resumed };
}
