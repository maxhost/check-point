import { NextResponse } from "next/server";
import { getMerchantAuth } from "../../../server/auth";
import { ownerContext } from "../../../server/staff";
import { withDbTransaction, type DbTransaction } from "../../../server/db";
import {
  activeLocationCount,
  lockBusiness,
} from "../../../server/locations/shared";
import { activeCampaignCount } from "../../../server/marketing/plan-brake";
import {
  asStripeGateway,
  decidePlanChange,
  readSubscription,
  toSubscriptionView,
  type PlanChangeDecision,
  type PlanChangeInput,
  type PlanIntent,
  type StripeGateway,
  type SubscriptionRow,
} from "../../../server/billing";
import {
  getStripeClient,
  getStripeConfiguration,
} from "../../../server/stripe-config";

/**
 * Spec 0063, D6 — EL GATE Y LAS PIEZAS COMPARTIDAS de `api/billing/**`. Calcado de
 * `app/api/locations/_auth.ts`, incluido el motivo: reusa `ownerContext`, que es el MISMO
 * resolvedor owner+activo que usa `api/staff/*` (`staff.ts:38-55`), en vez de una segunda
 * copia que pueda derivar en el filtro de `status`.
 *
 * EL `businessId` NO VIENE DEL BODY. Hoy `checkout` lo tomaba del body y verificaba membresía
 * sobre ESE negocio; la propiedad que `locations-routes.test.ts` ya pinnea para locales
 * —«actúa sobre el negocio del CALLER, nunca sobre uno nombrado en el request»— vale para las
 * cinco rutas. Lo que hace SEGURO usar `ownerContext` (que devuelve el negocio más viejo,
 * `staff.ts:33`) es que el onboarding rechaza un segundo negocio por usuario
 * (`api/onboarding/business/route.ts:89-99`, 409) — [R2-M6].
 */

/** Error de dominio de billing: status HTTP + `code` estable + mensaje. Calcado de
 * `LocationError`; `archiveCount` viaja sólo en `downgrade_blocked`, que es lo que alimenta
 * el modal de D7, y `deactivateCount` sólo en `downgrade_blocked_campaigns` (spec 0065).
 *
 * SON DOS CLAVES Y NO UNA: el contador dice QUÉ hay que hacer, y meter el de campañas en
 * `archiveCount` le diría a cualquier cliente «archivá N locales» cuando lo que sobra son
 * campañas. El modal ya no mostraría el número equivocado —usa el `message` del servidor—
 * pero el contrato sí. */
export class BillingError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly archiveCount?: number,
    readonly deactivateCount?: number,
  ) {
    super(message);
  }
}

export async function requireBillingOwner(
  request: Request,
): Promise<{ business: { id: string } } | { response: NextResponse }> {
  const session = await getMerchantAuth().api.getSession({
    headers: request.headers,
  });
  if (!session) {
    return {
      response: NextResponse.json({ error: "No autorizado." }, { status: 401 }),
    };
  }
  const business = await ownerContext(session.user.id);
  if (!business) {
    return {
      response: NextResponse.json(
        { error: "Solo el owner puede gestionar la suscripción." },
        { status: 403 },
      ),
    };
  }
  return { business: { id: business.id } };
}

/** `{ error, code, archiveCount? }` — la forma de fallo del contrato de D6. Lo que no sea un
 * `BillingError` es un 503: nunca se filtra el mensaje de una excepción cualquiera. */
export function billingErrorResponse(
  error: unknown,
  fallback: string,
): NextResponse {
  if (error instanceof BillingError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        ...(error.archiveCount === undefined
          ? {}
          : { archiveCount: error.archiveCount }),
        ...(error.deactivateCount === undefined
          ? {}
          : { deactivateCount: error.deactivateCount }),
      },
      { status: error.status },
    );
  }
  return NextResponse.json(
    { error: fallback, code: "unavailable" },
    { status: 503 },
  );
}

/**
 * El body, tolerante con la AUSENCIA de body: un cliente que no manda nada no puede comerse un
 * 400 ni un 503. Los campos que sí importan los valida cada ruta, así que la tolerancia no
 * tapa nada.
 *
 * SUS ÚNICOS LLAMADORES SON `checkout` (lee `interval` y `from`) E `interval` (lee `to`).
 * `cancel`, `resume` y `settle-free` NO lo llaman: reciben `{}` y no leen el body. La
 * distinción no es trivia — una versión anterior de este docblock las nombraba a las tres, y
 * eso hizo que la primera sonda de la mutación MUT-B se escribiera contra `cancel` y saliera
 * VERDE por el motivo equivocado. El oráculo real vive en `billing-routes.test.ts` y tiene que
 * usar una ruta que SÍ lea el body.
 */
export async function readBody(
  request: Request,
): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** El cliente de Stripe como `StripeGateway` + los price ids. Una configuración incompleta es
 * 503 y no 500: no es culpa del request. */
export function stripeContext(): {
  gateway: StripeGateway;
  priceIds: { monthly: string; yearly: string };
} {
  try {
    const configuration = getStripeConfiguration();
    return {
      gateway: asStripeGateway(getStripeClient(configuration)),
      priceIds: {
        monthly: configuration.monthlyPriceId,
        yearly: configuration.yearlyPriceId,
      },
    };
  } catch {
    throw new BillingError(
      503,
      "stripe_not_configured",
      "El plan Plus aún no está configurado.",
    );
  }
}

export async function requireRow(
  tx: DbTransaction,
  businessId: string,
): Promise<SubscriptionRow> {
  const row = await readSubscription(tx, businessId);
  if (!row) {
    throw new BillingError(
      503,
      "subscription_unavailable",
      "No pudimos leer tu suscripción.",
    );
  }
  return row;
}

/** La fila + el conteo, en la forma que `decidePlanChange` espera. UNA sola construcción para
 * las dos superficies que deciden (la ruta y el `canCancel` de la respuesta): con dos, un
 * campo puesto distinto haría que la UI ofreciera lo que el servidor rechaza. */
function planInput(
  row: SubscriptionRow,
  counts: { activeLocations: number; activeCampaigns: number },
  intent: PlanIntent,
): PlanChangeInput {
  return {
    currentPlan: row.plan,
    currentInterval: row.interval,
    pendingPlan: row.pendingPlan,
    status: row.status,
    stripeSubscriptionId: row.stripeSubscriptionId,
    activeLocations: counts.activeLocations,
    activeCampaigns: counts.activeCampaigns,
    intent,
  };
}

/**
 * LOCK → LEER → CONTAR → DECIDIR, en ese orden y dentro de la MISMA transacción. Es el
 * read-modify-write de D6: el conteo de locales que alimenta `downgrade_blocked` tiene que
 * leerse bajo el lock del negocio, o entre la verificación y la escritura cabe un
 * desarchivado (ADR 0054 §2).
 *
 * Un `blocked` sale como `BillingError` 409 con su `code` — los 402/503 los produce la ruta.
 */
export async function decideUnderLock(
  tx: DbTransaction,
  businessId: string,
  intent: PlanIntent,
): Promise<{
  row: SubscriptionRow;
  activeLocations: number;
  decision: PlanChangeDecision;
}> {
  await lockBusiness(tx, businessId);
  const row = await requireRow(tx, businessId);
  const activeLocations = await activeLocationCount(tx, businessId);
  // El conteo de campañas va bajo el MISMO lock y por el mismo motivo que el de locales
  // (spec 0065, fase D): entre contar y escribir el plan cabe una activación.
  const activeCampaigns = await activeCampaignCount(tx, businessId);
  const decision = decidePlanChange(
    planInput(row, { activeLocations, activeCampaigns }, intent),
  );
  if (decision.kind === "blocked") {
    throw new BillingError(
      409,
      decision.code,
      decision.message,
      decision.archiveCount,
      decision.deactivateCount,
    );
  }
  return { row, activeLocations, decision };
}

/**
 * El cuerpo de éxito del contrato de D6: `{ subscription, activeLocations, canCancel }`.
 * `subscription` pasa SIEMPRE por `toSubscriptionView` — la allow-list positiva de D7 — así
 * que `stripeCustomerId`, `stripeSubscriptionId` y `downgradeRequestedAt` no pueden viajar.
 *
 * `canCancel` sale de `decidePlanChange`, NO de una segunda regla de conteo que pueda
 * divergir del servidor. Ojo (ADR 0058 §8): `false` no deshabilita el botón en la UI; el
 * bloqueo duro es el 409 de acá.
 */
export async function billingStateResponse(
  businessId: string,
): Promise<NextResponse> {
  const state = await withDbTransaction(async (tx) => {
    await lockBusiness(tx, businessId);
    const row = await requireRow(tx, businessId);
    const activeLocations = await activeLocationCount(tx, businessId);
    const activeCampaigns = await activeCampaignCount(tx, businessId);
    const decision = decidePlanChange(
      planInput(
        row,
        { activeLocations, activeCampaigns },
        { kind: "downgrade" },
      ),
    );
    return {
      subscription: toSubscriptionView(row),
      activeLocations,
      canCancel:
        decision.kind === "schedule_downgrade" ||
        decision.kind === "settle_to_free",
    };
  });
  return NextResponse.json(state);
}
