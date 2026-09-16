import { and, count, eq } from "drizzle-orm";
import type { DbTransaction } from "../db";
import { campaigns } from "../schema";

/**
 * Spec 0065, fase D — LO QUE BILLING NECESITA SABER DE LAS CAMPAÑAS.
 *
 * Vive en `marketing/` y no en `billing/` por la misma simetría que `activeLocationCount`
 * (`locations/shared.ts:63`), que billing también importa: el predicado de «campaña
 * activa» pertenece al dominio que lo define, y billing lo consume. Con la copia del lado
 * de billing, el día que `status` gane un valor los dos conteos divergen en silencio.
 *
 * Las dos funciones toman `tx` y NO abren transacción propia: las dos lecturas que las
 * usan ocurren bajo el `lockBusiness` del negocio (ADR 0054 §2 — entre contar y escribir
 * cabe una activación).
 */

/** El predicado de «campaña activa», UNO SOLO: el mismo que bloquea la baja y el que el
 * freno defensivo pausa. */
const ACTIVE = "active";

/**
 * Cuántas campañas `active` tiene el negocio. Alimenta `downgrade_blocked_campaigns`
 * (`billing/plan-change.ts`) y, por él, el modal de la baja.
 */
export async function activeCampaignCount(
  tx: DbTransaction,
  businessId: string,
): Promise<number> {
  const [row] = await tx
    .select({ value: count() })
    .from(campaigns)
    .where(
      and(eq(campaigns.businessId, businessId), eq(campaigns.status, ACTIVE)),
    );
  return Number(row?.value ?? 0);
}

/**
 * EL FRENO DEFENSIVO (spec 0065, «Freno por plan», residual del ORQUESTADOR): el bloqueo
 * duro vive en NUESTRA ruta, y el plan puede aterrizar en `free`/`none` sin pasar por ella
 * — cancelación desde el dashboard de Stripe o impago (ADR 0060/0063, que ya pagaron esta
 * lección). Para que «un negocio free no corre campañas» no dependa de un camino que no
 * controlamos, la bajada de plan pausa las campañas activas EN LA MISMA TRANSACCIÓN que
 * escribe el plan. El tick cancela después sus turnos con `cancel_reason='plan_downgraded'`.
 *
 * Devuelve cuántas pausó, que es lo que el log del webhook reporta. Reanudar exige volver
 * a `plus`: `transitionCampaign` pasa por el gate de `plan-gate.ts`.
 *
 * `updatedAt` se escribe a mano porque drizzle no tiene `$onUpdate` en esta tabla y una
 * pausa que no mueve la marca haría que el listado del backoffice ordenara por una fecha
 * que ya no describe la fila.
 */
export async function pauseCampaignsForDowngrade(
  tx: DbTransaction,
  businessId: string,
  now: Date,
): Promise<number> {
  const paused = await tx
    .update(campaigns)
    .set({ status: "paused", pauseReason: "plan_downgraded", updatedAt: now })
    .where(
      and(eq(campaigns.businessId, businessId), eq(campaigns.status, ACTIVE)),
    )
    .returning({ id: campaigns.id });
  return paused.length;
}
