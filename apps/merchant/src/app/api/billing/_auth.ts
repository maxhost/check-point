import { NextResponse } from "next/server";
import {
  apiOwnerFailureResponse,
  requireApiOwner,
} from "../../../server/api-owner";
import { withDbTransaction, type DbTransaction } from "@mi-pasaporte/db";
import {
  activeLocationCount,
  lockBusiness,
} from "../../../server/locations/shared";
import { activeCampaignsOutsideBase } from "../../../server/marketing/plan-brake";
import {
  asStripeGateway,
  decidePlanChange,
  readSubscription,
  toSubscriptionView,
  type PlanChangeDecision,
  type PlanChangeInput,
  type PlanIntent,
  type PriceIds,
  type StripeGateway,
  type SubscriptionRow,
} from "../../../server/billing";
import {
  getStripeClient,
  getStripeConfiguration,
} from "../../../server/stripe-config";
import {
  billingAccess,
  trialDaysLeft,
} from "@mi-pasaporte/domain/server/billing-access";
import { PLAN_PRICES_USD } from "@mi-pasaporte/domain/server/entitlements/index";

/**
 * Spec 0063, D6 — EL GATE Y LAS PIEZAS COMPARTIDAS de `api/billing/**`. Calcado de
 * `app/api/locations/_auth.ts`, incluido el motivo: reusa `ownerContext`, que es el MISMO
 * resolvedor owner+activo que usa `api/staff/*` (`staff.ts:38-55`), en vez de una segunda
 * copia que pueda derivar en el filtro de `status`.
 *
 * EL `businessId` NO VIENE DEL BODY. Hoy `checkout` lo tomaba del body y verificaba membresía
 * sobre ESE negocio; la propiedad que `locations-routes.test.ts` ya pinnea para locales
 * —«actúa sobre el negocio del CALLER, nunca sobre uno nombrado en el request»— vale para las
 * rutas. Lo que hace SEGURO usar `ownerContext` (que devuelve el negocio más viejo,
 * `staff.ts:33`) es que el onboarding rechaza un segundo negocio por usuario
 * (la ruta del alta del negocio contesta 409 al segundo) — [R2-M6].
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

/**
 * **Desde la spec 0072 delega en `requireApiOwner`**, el resolvedor unico de las superficies
 * del owner: gate de email verificado y eje `core.business.status`.
 *
 * **`allowBlocked: true` (spec 0189 §D4)**: es la UNICA superficie de API que un negocio sin
 * acceso (prueba vencida, sin suscripcion viva) sigue usando — el owner bloqueado entra, ve su
 * suscripcion y paga. Sin esto, el 402 `payment_required` le cerraria justo la puerta de pago.
 */
export async function requireBillingOwner(
  request: Request,
): Promise<{ business: { id: string } } | { response: NextResponse }> {
  const auth = await requireApiOwner(
    request,
    {
      notOwner: "Solo la persona propietaria puede gestionar la suscripción.",
      emailNotVerified: "Verifica tu email para gestionar la suscripción.",
    },
    { allowBlocked: true },
  );
  if ("failure" in auth) {
    return { response: apiOwnerFailureResponse(auth.failure) };
  }
  return { business: { id: auth.business.id } };
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
 * SUS ÚNICOS LLAMADORES SON `checkout` (lee `plan`, `interval` y `from`), `plan` e `interval`
 * (leen `to`). `cancel` y `resume` NO lo llaman: no leen el body. La
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

/** El cliente de Stripe como `StripeGateway` + los cuatro price ids (spec 0189 §D5). Una
 * configuración incompleta es 503 y no 500: no es culpa del request. */
export function stripeContext(): {
  gateway: StripeGateway;
  priceIds: PriceIds;
} {
  try {
    const configuration = getStripeConfiguration();
    return {
      gateway: asStripeGateway(getStripeClient(configuration)),
      priceIds: configuration.priceIds,
    };
  } catch {
    throw new BillingError(
      503,
      "stripe_not_configured",
      "Los planes aún no están configurados.",
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

/** La fila + los conteos, en la forma que `decidePlanChange` espera. UNA sola construcción
 * para todas las rutas que deciden. */
function planInput(
  row: SubscriptionRow,
  counts: { activeLocations: number; activeCampaignsOutsideBase: number },
  intent: PlanIntent,
  now: Date,
): PlanChangeInput {
  return {
    currentPlan: row.plan,
    currentInterval: row.interval,
    pendingPlan: row.pendingPlan,
    status: row.status,
    stripeSubscriptionId: row.stripeSubscriptionId,
    trialEndsAt: row.trialEndsAt,
    now,
    activeLocations: counts.activeLocations,
    activeCampaignsOutsideBase: counts.activeCampaignsOutsideBase,
    intent,
  };
}

/**
 * LOCK → LEER → CONTAR → DECIDIR, en ese orden y dentro de la MISMA transacción. Los conteos
 * que alimentan `downgrade_blocked*` se leen bajo el lock del negocio, o entre la verificación
 * y la escritura cabe un desarchivado o una activación (ADR 0054 §2).
 *
 * Un `blocked` sale como `BillingError` 409 con su `code` — los 402/503 los produce la ruta.
 * Las llamadas a Stripe ocurren DESPUÉS, fuera de esta transacción (regla de `shared.ts`).
 */
export async function decideUnderLock(
  tx: DbTransaction,
  businessId: string,
  intent: PlanIntent,
  now = new Date(),
): Promise<{
  row: SubscriptionRow;
  activeLocations: number;
  decision: PlanChangeDecision;
}> {
  await lockBusiness(tx, businessId);
  const row = await requireRow(tx, businessId);
  const activeLocations = await activeLocationCount(tx, businessId);
  const outside = await activeCampaignsOutsideBase(tx, businessId);
  const decision = decidePlanChange(
    planInput(
      row,
      { activeLocations, activeCampaignsOutsideBase: outside },
      intent,
      now,
    ),
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
 * Spec 0189 §D10 — EL ESTADO DE COBRO: el cuerpo de `GET /api/billing/state` y el de éxito de
 * `plan`/`interval`/`cancel`/`resume`. `subscription` pasa SIEMPRE por `toSubscriptionView` —la
 * allow-list positiva— así que `stripeCustomerId`, `stripeSubscriptionId` y
 * `downgradeRequestedAt` no pueden viajar. Los precios son de EXHIBICIÓN (el cobro es de
 * Stripe). Se lee bajo `lockBusiness`, igual que las decisiones.
 */
export async function billingStateResponse(
  businessId: string,
  now = new Date(),
): Promise<NextResponse> {
  const state = await withDbTransaction(async (tx) => {
    await lockBusiness(tx, businessId);
    const row = await requireRow(tx, businessId);
    const access = billingAccess(row, now);
    return {
      subscription: toSubscriptionView(row),
      access,
      trialDaysLeft: trialDaysLeft(access, row.trialEndsAt, now),
      activeLocations: await activeLocationCount(tx, businessId),
      activeCampaignsOutsideBase: await activeCampaignsOutsideBase(
        tx,
        businessId,
      ),
      prices: PLAN_PRICES_USD,
      currency: "USD",
    };
  });
  return NextResponse.json(state);
}
