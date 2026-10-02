import { eq } from "drizzle-orm";
import type { DbTransaction } from "@mi-pasaporte/db";
import { subscriptions } from "@mi-pasaporte/db/schema";
import { can } from "../entitlements";
import type { TemplateKey } from "./templates";

/**
 * Spec 0065, fase D — EL GATE DE PLAN DE LAS CAMPAÑAS (402 `plan_not_allowed`).
 *
 * Es la MITAD BLANDA del freno por plan: dice quién puede componer y activar. La otra
 * mitad es el bloqueo duro del downgrade (`downgrade_blocked_campaigns`, en
 * `billing/plan-change.ts`) y el freno defensivo del webhook (`plan-brake.ts`).
 *
 * El mensaje vive acá y NO en cada `throw` porque las dos superficies que lo lanzan
 * (`createCampaign` y `transitionCampaign`) están en archivos distintos: con dos textos,
 * el día que cambie el nombre del plan uno de los dos queda viejo. El `throw` sí queda en
 * cada llamador — `CampaignError` vive en `campaign-store.ts`, que importa este módulo, y
 * lanzarlo desde acá cerraría un ciclo de imports (`CLAUDE.md`: un ciclo dentro de un
 * support de test ya colgó la suite entera una vez).
 */
export const PLAN_NOT_ALLOWED_MESSAGE = "Las campañas son del plan Plus.";

/** Lo mínimo de `core.subscription` con lo que se decide. Misma forma que lee
 * `decidePlanChange`, para que las dos reglas del freno miren los mismos campos. */
export type CampaignPlanRow = {
  plan: string;
  pendingPlan: string | null;
  status: string;
  stripeSubscriptionId: string | null;
};

/**
 * DECISIÓN PURA, delegada en la capa de entitlements (spec 0072 §D2.5). La regla —las tres
 * condiciones— vive ahora en UNA fila del catálogo (`campaigns.enabled`), y este archivo
 * conserva la firma porque `createCampaign` y `transitionCampaign` la llaman.
 *
 * Las tres condiciones y el agujero que cierra cada una, para que no se pierdan al mover
 * la regla de lugar:
 *
 *  1. `byPlan` — el plan vigente (`plus` es el único con `true`).
 *  2. `pendingRule: "min"` — `pending_plan` no baja de `plus`. Es el MISMO criterio que
 *     `effectiveLocationLimit`: con una baja ya programada el negocio sigue en `plus`
 *     hasta el fin del período, y activar ahí deja campañas corriendo el día que el plan
 *     aterriza en `free`. Un `pending_plan` vacío NO es una baja programada ([R1-N8] de la
 *     spec 0063: sin ese detalle el tope caía solo).
 *  3. `requiresLiveSubscription: true` — el tope de locales por sí solo es un `Math.min` y
 *     **no mira `status` ni `stripe_subscription_id`**, o sea que no sabe nada de «viva».
 *     En prod hay un `plus` con `interval` NULL y sin `stripe_subscription_id` (A1 de la
 *     spec 0063): sin esta condición, ese negocio activaría campañas sin pagar. Se declara
 *     POR ENTRADA y no como un `effectivePlan` único, porque locales SÍ los conserva
 *     (ADR 0073 §2).
 *
 * CORRIGE UNA DIVERGENCIA DE LA FASE B1, declarada acá porque no es un detalle: el
 * `planAllows` que B1 dejó en `campaign-actions.ts` miraba SÓLO `plan === 'plus'` y
 * declaraba —como decisión del orquestador— que una baja programada no frenaba la
 * activación. La spec dice lo contrario en «Freno por plan» («la fuente son
 * `subscription.plan` + `pending_plan` … MÁS `hasLiveSubscription`»), y la fase D es donde
 * esa sección se implementa. Gana la spec.
 *
 * **NO mira `core.business.status`** (ADR 0073 §1): un negocio suspendido se corta en
 * `requireApiOwner` con 403 `business_suspended`, no con un «mejorá tu plan».
 */
export function campaignsAllowedFor(row: CampaignPlanRow | null): boolean {
  if (row === null) return false;
  return can(row, "campaigns.enabled");
}

/** La plantilla «Bienvenida». El catálogo de plantillas no exporta la clave como valor,
 * así que va literal, tipada contra su `TemplateKey` para que un renombre no compile. */
const WELCOME: TemplateKey = "welcome";

/**
 * ADR 0112 / spec 0129 — EL FRENO DECIDE POR PLANTILLA. La Bienvenida consulta su propia
 * entrada del catálogo, `campaigns.welcome` (incluida en todos los planes, sin exigir
 * suscripción viva); cualquier otra plantilla —o `null`, una campaña propia— sigue con
 * `campaignsAllowedFor` sin cambios.
 *
 * Un `row` nulo es un negocio SIN fila de suscripción: para la Bienvenida eso es «sin plan»,
 * que la entrada admite por su `fallback` (decisión 1 del ADR 0112).
 */
export function campaignAllowedFor(
  row: CampaignPlanRow | null,
  templateKey: string | null,
): boolean {
  if (templateKey === WELCOME)
    return can(row ?? { plan: null }, "campaigns.welcome");
  return campaignsAllowedFor(row);
}

async function readPlanRow(
  tx: DbTransaction,
  businessId: string,
): Promise<CampaignPlanRow | null> {
  const [row] = await tx
    .select({
      plan: subscriptions.plan,
      pendingPlan: subscriptions.pendingPlan,
      status: subscriptions.status,
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
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
 * Es el freno de crear una campaña PROPIA (`campaign-store.ts`), que sigue con
 * `campaigns.enabled`. Activar o reanudar una plantilla pasa por `planAllowsCampaign`, que
 * decide por su clave (ADR 0112).
 */
export async function planAllowsCampaigns(
  tx: DbTransaction,
  businessId: string,
): Promise<boolean> {
  return campaignsAllowedFor(await readPlanRow(tx, businessId));
}

/** La misma lectura que `planAllowsCampaigns`, decidida POR PLANTILLA con
 * `campaignAllowedFor` (activar una plantilla y reanudar una campaña, ADR 0112). */
export async function planAllowsCampaign(
  tx: DbTransaction,
  businessId: string,
  templateKey: string | null,
): Promise<boolean> {
  return campaignAllowedFor(await readPlanRow(tx, businessId), templateKey);
}
