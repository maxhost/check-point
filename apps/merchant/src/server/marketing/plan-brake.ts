import { and, count, eq, inArray, sql } from "drizzle-orm";
import type { DbTransaction } from "@mi-pasaporte/db";
import { campaigns } from "@mi-pasaporte/db/schema";
import { billingAccess } from "@mi-pasaporte/domain/server/billing-access";
import {
  BASE_TEMPLATE_KEYS,
  effectivePlan,
} from "@mi-pasaporte/domain/server/entitlements/index";
import {
  campaignAllowedFor,
  type CampaignPlanRow,
} from "@mi-pasaporte/domain/server/marketing/plan-gate";

/**
 * Spec 0065 fase D + spec 0189 §D4 — LO QUE BILLING NECESITA SABER Y HACER CON LAS CAMPAÑAS.
 *
 * Vive en `marketing/` y no en `billing/` por la misma simetría que `activeLocationCount`
 * (`locations/shared.ts`): el predicado de «campaña activa» pertenece al dominio que lo define.
 *
 * Todas toman `tx` y NO abren transacción propia: corren bajo el `lockBusiness` del negocio
 * (ADR 0054 §2 — entre contar y escribir cabe una activación).
 */

const ACTIVE = "active";
const BILLING_BLOCKED = "billing_blocked";

/**
 * «La plantilla NO está en el plan base» (spec 0189 §D2): `template_key` nulo (campaña propia)
 * o fuera de `BASE_TEMPLATE_KEYS`, que se deriva del catálogo. Es `is null or not in` y no un
 * `not in` pelado: `NULL not in (…)` es NULL y las campañas propias dejarían de contarse.
 */
function outsideBase() {
  const keys = sql.join(
    BASE_TEMPLATE_KEYS.map((key) => sql`${key}`),
    sql`, `,
  );
  return sql`(${campaigns.templateKey} is null or ${campaigns.templateKey} not in (${keys}))`;
}

/**
 * Cuántas campañas `active` tiene el negocio FUERA del plan base. Alimenta
 * `downgrade_blocked_campaigns` (`billing/plan-change.ts`): bajar a base exige apagarlas antes
 * (ADR 0134 §9).
 */
export async function activeCampaignsOutsideBase(
  tx: DbTransaction,
  businessId: string,
): Promise<number> {
  const [row] = await tx
    .select({ value: count() })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.businessId, businessId),
        eq(campaigns.status, ACTIVE),
        outsideBase(),
      ),
    );
  return Number(row?.value ?? 0);
}

/**
 * SIN ACCESO → TODAS las campañas `active` (Bienvenida incluida, ADR 0134 §7) a `paused` con
 * `pause_reason='billing_blocked'`. Devuelve cuántas pausó. El tick cancela después sus turnos
 * (`campaign_paused`).
 *
 * `updatedAt` se escribe a mano: drizzle no tiene `$onUpdate` en esta tabla.
 */
export async function pauseCampaignsForBilling(
  tx: DbTransaction,
  businessId: string,
  now: Date,
): Promise<number> {
  const paused = await tx
    .update(campaigns)
    .set({ status: "paused", pauseReason: BILLING_BLOCKED, updatedAt: now })
    .where(
      and(eq(campaigns.businessId, businessId), eq(campaigns.status, ACTIVE)),
    )
    .returning({ id: campaigns.id });
  return paused.length;
}

/**
 * CON ACCESO → las campañas que el BLOQUEO pausó (`pause_reason='billing_blocked'`, y SOLO
 * esas: nunca una pausa `owner` ni `no_active_locations`) vuelven a `active` si el plan
 * EFECTIVO las permite (`campaignAllowedFor`, por plantilla) y no terminaron (`ends_at` nulo
 * o futuro). Las demás se quedan `paused` con `plan_downgraded`: el plan de hoy no las
 * incluye, y el motivo nuevo dice eso. Devuelve cuántas reanudó.
 *
 * H2 de la revisión: si el plan efectivo es el FALLBACK (suscripción viva sobre una fila cuyo
 * plan todavía no es pago — el evento `incomplete` o de precio desconocido que llega antes del
 * `active`), no se decide nada: las campañas se QUEDAN en `billing_blocked`. Reescribirlas como
 * `plan_downgraded` las dejaba fuera de esta función para siempre, y pagar no las devolvía.
 */
export async function resumeCampaignsAfterBilling(
  tx: DbTransaction,
  businessId: string,
  row: CampaignPlanRow | null,
  now: Date,
): Promise<number> {
  if (effectivePlan(row === null ? null : { ...row, now }) === null) return 0;
  const blocked = await tx
    .select({
      id: campaigns.id,
      templateKey: campaigns.templateKey,
      endsAt: campaigns.endsAt,
    })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.businessId, businessId),
        eq(campaigns.pauseReason, BILLING_BLOCKED),
      ),
    );
  const back: string[] = [];
  const kept: string[] = [];
  for (const campaign of blocked) {
    const running =
      campaign.endsAt === null || campaign.endsAt.getTime() > now.getTime();
    if (running && campaignAllowedFor(row, campaign.templateKey, now))
      back.push(campaign.id);
    else kept.push(campaign.id);
  }
  if (back.length > 0) {
    await tx
      .update(campaigns)
      .set({ status: ACTIVE, pauseReason: null, updatedAt: now })
      .where(inArray(campaigns.id, back));
  }
  if (kept.length > 0) {
    await tx
      .update(campaigns)
      .set({ status: "paused", pauseReason: "plan_downgraded", updatedAt: now })
      .where(inArray(campaigns.id, kept));
  }
  return back.length;
}

/**
 * Las DOS operaciones de arriba según el acceso de la fila (spec 0189 §D4): sin acceso pausa,
 * con acceso reanuda. La corren el barrido diario (`/api/internal/billing-sweep`) y el webhook
 * cuando escribe el plan (`billing/store.ts`), así que pagar devuelve las campañas en el acto.
 * Idempotente: una segunda corrida no encuentra nada que mover.
 */
export async function syncCampaignsWithAccess(
  tx: DbTransaction,
  businessId: string,
  row: CampaignPlanRow | null,
  now: Date,
): Promise<{ paused: number; resumed: number }> {
  if (billingAccess(row, now) === "blocked") {
    return {
      paused: await pauseCampaignsForBilling(tx, businessId, now),
      resumed: 0,
    };
  }
  return {
    paused: 0,
    resumed: await resumeCampaignsAfterBilling(tx, businessId, row, now),
  };
}
