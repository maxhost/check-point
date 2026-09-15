import type Stripe from "stripe";

import { fromUnixSeconds } from "./derive-rules";
import type { StripeGateway } from "./gateway";

/**
 * Spec 0064, A4 — LOS DATOS DEL COBRO que la sección de suscripción muestra: cuándo se
 * renueva y cuánto se pagó la última vez, con el link al recibo de Stripe.
 *
 * NO SALEN DE NUESTRA BASE, y no es una omisión: `core.subscription` no guarda importes ni
 * facturas, y guardarlos sería una segunda copia de la verdad de Stripe que puede derivar
 * (el mismo motivo por el que D8 reconcilia en vez de confiar en la fila).
 *
 * COSTO DECLARADO Y ACEPTADO (anexo A4): hasta DOS llamadas de red por render de una pantalla
 * de baja frecuencia. Se lanzan en paralelo, así que el costo es el de la más lenta.
 */
export type LastPaidInvoice = {
  /** En la unidad mínima de la moneda (centavos): lo formatea la UI, no este módulo. */
  amountPaid: number;
  currency: string;
  /** `hosted_invoice_url`, con fallback a `invoice_pdf`. `null` si Stripe no publicó ninguno. */
  receiptUrl: string | null;
};

export type BillingFacts = {
  renewalAt: Date | null;
  lastPaidInvoice: LastPaidInvoice | null;
};

/**
 * Spec 0064, fase B — LO QUE DE ESTOS HECHOS CRUZA AL NAVEGADOR.
 *
 * `renewalAt` viaja como STRING ISO y no como `Date`, por el MISMO motivo que `pendingPlanAt`
 * en `view.ts` ([R2-M4]): un `Date` cruzando el límite server→client de Next se serializa
 * distinto según el camino, y el oráculo de props (`expectCrossesExactly`) rechaza cualquier
 * valor no plano — `nonPlainPaths` lo reportaría con su camino.
 *
 * LO QUE SÍ CRUZA Y ESTÁ DECIDIDO: el link del recibo (decisión O-2 del anexo, del
 * ORQUESTADOR y no del owner). Es el mismo link que Stripe le manda al owner por email, así
 * que no abre ninguna amenaza nueva. LO QUE NO CRUZA NI PUEDE CRUZAR: `stripeCustomerId` y
 * `stripeSubscriptionId`, que son las llaves con las que se PIDEN estos datos y se quedan en
 * el server component (regla de `CLAUDE.md`, ya cazada como fuga en marca — spec 0025).
 */
export type BillingFactsView = {
  renewalAt: string | null;
  lastPaidInvoice: LastPaidInvoice | null;
};

export function toBillingFactsView(facts: BillingFacts): BillingFactsView {
  return {
    renewalAt: facts.renewalAt === null ? null : facts.renewalAt.toISOString(),
    lastPaidInvoice: facts.lastPaidInvoice,
  };
}

export const NO_BILLING_FACTS: BillingFactsView = {
  renewalAt: null,
  lastPaidInvoice: null,
};

const NOTHING: BillingFacts = { renewalAt: null, lastPaidInvoice: null };

/**
 * ESTA FUNCIÓN NO PUEDE TIRAR NUNCA. Mismo contrato que `reconcileFromStripe`: cualquier
 * fallo devuelve el campo en `null` y la UI omite el dato. Una pantalla de plan no se cae
 * porque Stripe no conteste, y menos una que es la única salida de un estado de cobro.
 *
 * Los dos lados están aislados entre sí a propósito: que `invoices.list` falle no puede
 * borrar la fecha de renovación que el `retrieve` ya trajo, ni al revés. Con un solo `try`
 * alrededor de los dos, un fallo de cualquiera vaciaría los dos campos.
 *
 * Y SIN LOS IDS NO SE LLAMA A NADA: un negocio `free` no tiene suscripción ni, muchas veces,
 * customer. Llamar igual sería un round-trip garantizado a un 400 en el render más común.
 */
export async function readBillingFacts(
  gw: StripeGateway,
  ids: { stripeCustomerId: string | null; stripeSubscriptionId: string | null },
): Promise<BillingFacts> {
  const [renewalAt, lastPaidInvoice] = await Promise.all([
    readRenewalAt(gw, ids.stripeSubscriptionId),
    readLastPaidInvoice(gw, ids.stripeCustomerId),
  ]);
  return { renewalAt, lastPaidInvoice };
}

/**
 * La fecha de renovación sale de `items.data[0].current_period_end` — el MISMO campo del que
 * `derive-rules.ts:79` deriva `pending_plan_at`, y con el MISMO acceso defensivo: `items` es
 * un `ApiList` truncado y sin orden contractual, así que `data[0]` pelado sobre una lista
 * vacía tira `TypeError`. Acá ese `TypeError` no rompería una transacción, pero sí rompería
 * el render de la página entera — que es peor, porque la página es la salida del estado.
 *
 * Es unix SECONDS: sin el `* 1000` de `fromUnixSeconds` la fecha cae en 1970 y el bug es
 * VISUAL, no de tipos.
 */
async function readRenewalAt(
  gw: StripeGateway,
  stripeSubscriptionId: string | null,
): Promise<Date | null> {
  if (stripeSubscriptionId === null) return NOTHING.renewalAt;
  try {
    const subscription = await gw.subscriptions.retrieve(stripeSubscriptionId);
    return fromUnixSeconds(subscription.items?.data?.[0]?.current_period_end);
  } catch {
    return null;
  }
}

/**
 * LA ÚLTIMA FACTURA PAGADA (respuesta literal del owner: «claro que la última que tiene
 * pagada»), elegida por `created` MÁXIMO ENTRE LAS DEVUELTAS.
 *
 * NO SE TOMA `data[0]`, y no es prolijidad: que la lista venga ordenada descendente no es
 * contractual en ningún lado del SDK, y es el bug exacto que este repo ya pagó una vez (un
 * `select` sin `order by` seguido de `.at(-1)`, que dejó un test flaky persiguiendo otra
 * causa). Un recibo equivocado es peor que ninguno: el owner lo abre y ve otro importe.
 *
 * `status: "paid"` es load-bearing: sin él la lista trae también las `open` y las `draft`, y
 * la «última» sería una factura que el merchant NO pagó — con su importe y su link.
 */
async function readLastPaidInvoice(
  gw: StripeGateway,
  stripeCustomerId: string | null,
): Promise<LastPaidInvoice | null> {
  if (stripeCustomerId === null) return NOTHING.lastPaidInvoice;
  try {
    const list = await gw.invoices.list({
      customer: stripeCustomerId,
      status: "paid",
      limit: 10,
    });
    const chosen = pickLatest(list.data);
    if (!chosen) return null;
    return {
      amountPaid: chosen.amount_paid,
      currency: chosen.currency,
      // `?? null` y no `|| null`: los dos campos son `?string | null` en el SDK, así que hay
      // que cubrir el `undefined` además del `null`.
      receiptUrl: chosen.hosted_invoice_url ?? chosen.invoice_pdf ?? null,
    };
  } catch {
    return null;
  }
}

/** La de `created` MÁXIMO. Sin `sort` ni copia: un solo barrido y ninguna mutación del array
 * que devolvió el SDK. */
function pickLatest(data: Stripe.Invoice[]): Stripe.Invoice | null {
  let latest: Stripe.Invoice | null = null;
  for (const invoice of data) {
    if (latest === null || invoice.created > latest.created) latest = invoice;
  }
  return latest;
}
