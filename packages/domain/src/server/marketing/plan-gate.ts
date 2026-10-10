import { eq } from "drizzle-orm";
import type { DbTransaction } from "@mi-pasaporte/db";
import { subscriptions } from "@mi-pasaporte/db/schema";
import { can, type EntitlementContext } from "../entitlements";
import type { TemplateKey } from "./templates";

/**
 * Spec 0065, fase D — EL GATE DE PLAN DE LAS CAMPAÑAS (402 `plan_not_allowed`).
 *
 * Es la MITAD BLANDA del freno por plan: dice quién puede componer y activar. La otra
 * mitad es el bloqueo duro de la bajada a base (`downgrade_blocked_campaigns`, en
 * `billing/plan-change.ts`) y el barrido de cobro (`marketing/plan-brake.ts`, spec 0189).
 *
 * El mensaje vive acá y NO en cada `throw` porque las dos superficies que lo lanzan
 * (`createCampaign` y `transitionCampaign`) están en archivos distintos: con dos textos,
 * el día que cambie el nombre del plan uno de los dos queda viejo. El `throw` sí queda en
 * cada llamador — `CampaignError` vive en `campaign-store.ts`, que importa este módulo, y
 * lanzarlo desde acá cerraría un ciclo de imports (`CLAUDE.md`: un ciclo dentro de un
 * support de test ya colgó la suite entera una vez).
 */
export const PLAN_NOT_ALLOWED_MESSAGE = "Las campañas son del plan Plus.";

/** Lo mínimo de `core.subscription` con lo que se decide (spec 0189 §D3): las columnas del eje
 * de acceso más el plan. Es el `EntitlementContext` sin el reloj, que se pasa aparte. */
export type CampaignPlanRow = Omit<EntitlementContext, "now">;

/** Las plantillas con flag PROPIO del catálogo. Literales tipados contra `TemplateKey` para que
 * un renombre no compile. */
const WELCOME: TemplateKey = "welcome";
const CROSS: TemplateKey = "cross";

/**
 * Spec 0189 §D3 — EL FRENO DECIDE POR PLANTILLA, sobre el PLAN EFECTIVO (`can()`, que ya mira
 * el acceso: un negocio sin suscripción viva y con la prueba vencida es `none` y no puede nada):
 *  - `welcome` → `campaigns.welcome` (ADR 0112; en el base, ADR 0134 §4);
 *  - `cross` → `campaigns.cross` (Venta cruzada, en el base, ADR 0134 §4);
 *  - cualquier otra —incluida `valley` y `null`, una campaña propia— → `campaigns.enabled`.
 *
 * Un `row` nulo es un negocio SIN fila de suscripción: fail-closed, no puede nada.
 *
 * **NO mira `core.business.status`** (ADR 0073 §1): un negocio suspendido se corta en
 * `requireApiOwner` con 403 `business_suspended`, no con un «mejorá tu plan».
 */
export function campaignAllowedFor(
  row: CampaignPlanRow | null,
  templateKey: string | null,
  now: Date,
): boolean {
  const ctx = row === null ? null : { ...row, now };
  if (templateKey === WELCOME) return can(ctx, "campaigns.welcome");
  if (templateKey === CROSS) return can(ctx, "campaigns.cross");
  return can(ctx, "campaigns.enabled");
}

async function readPlanRow(
  tx: DbTransaction,
  businessId: string,
): Promise<CampaignPlanRow | null> {
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
  return row ?? null;
}

/**
 * La fila del negocio + la decisión, DENTRO de la transacción del llamador: el gate se lee
 * en el mismo `tx` que escribe la campaña, o entre la verificación y la escritura cabe una
 * baja (ADR 0054 §2, el mismo motivo por el que el conteo de locales va bajo el lock).
 *
 * Es el freno de crear una campaña PROPIA (`campaign-store.ts`): `templateKey` nulo →
 * `campaigns.enabled`. Activar o reanudar una plantilla pasa por `planAllowsCampaign`.
 */
export async function planAllowsCampaigns(
  tx: DbTransaction,
  businessId: string,
  now = new Date(),
): Promise<boolean> {
  return campaignAllowedFor(await readPlanRow(tx, businessId), null, now);
}

/** La misma lectura que `planAllowsCampaigns`, decidida POR PLANTILLA con
 * `campaignAllowedFor` (activar una plantilla y reanudar una campaña). */
export async function planAllowsCampaign(
  tx: DbTransaction,
  businessId: string,
  templateKey: string | null,
  now = new Date(),
): Promise<boolean> {
  return campaignAllowedFor(
    await readPlanRow(tx, businessId),
    templateKey,
    now,
  );
}
