import { eq } from "drizzle-orm";
import { withDbTransaction } from "@mi-pasaporte/db";
import { subscriptions } from "@mi-pasaporte/db/schema";
import {
  BillingError,
  billingErrorResponse,
  decideUnderLock,
  readBody,
  requireBillingOwner,
  stripeContext,
} from "../_auth";
import { NextResponse } from "next/server";

/**
 * Spec 0063 D6 + spec 0189 §D7 — `POST /api/billing/checkout` `{plan, interval, from?}`: abrir
 * Stripe Checkout para CONTRATAR un plan pago (`base`|`plus`, mensual|anual).
 *
 *  1. EL `businessId` NO VIENE DEL BODY: sale de `ownerContext` (vía `requireBillingOwner`).
 *  2. GATE: `decidePlanChange({kind: "subscribe"})` bajo el lock — con suscripción viva, 409
 *     `subscription_live` en vez de COBRAR DOS VECES; con locales o campañas de más para el
 *     plan elegido, 409 `downgrade_blocked*` con su contador.
 *  3. LA PRUEBA SE RESPETA (ADR 0134 §6): si a la prueba le quedan 48 h o más, la suscripción
 *     nace con `subscription_data.trial_end` = el fin de la prueba y el primer cobro cae ese
 *     día. Con menos, Stripe no acepta `trial_end` en Checkout y se cobra en el acto.
 *  4. EL CUSTOMER SE CREA Y SE PERSISTE ACÁ (no cuando llega un evento): es lo que hace que la
 *     reconciliación no sea un no-op y que no nazca un customer por intento ([R1-N2]).
 *  5. LOS `*_url` SALEN DE `MERCHANT_PUBLIC_ORIGIN`; si falta, 503 `origin_not_configured`
 *     ([R2-I10]): con la `idempotencyKey` fija, un fallback al `request.url` clavaría las
 *     `*_url` en el dominio de la primera sesión durante 24 h.
 *
 * LA `idempotencyKey` ES FIJA POR PLAN E INTERVALO (`checkout:${businessId}:${plan}:${interval}`)
 * para que no haya varias sesiones abiertas del mismo plan. A cambio, antes de redirigir se
 * verifica que la sesión esté ABIERTA; si no, 409 `checkout_session_stale` (mandar al owner a
 * una sesión completada es un FALSO ÉXITO).
 */
export async function POST(request: Request) {
  const gate = await requireBillingOwner(request);
  if ("response" in gate) return gate.response;
  const businessId = gate.business.id;
  try {
    const body = await readBody(request);
    const plan =
      body.plan === "base" ? "base" : body.plan === "plus" ? "plus" : null;
    const interval =
      body.interval === "year"
        ? "year"
        : body.interval === "month"
          ? "month"
          : null;
    if (plan === null || interval === null) {
      throw new BillingError(400, "invalid_input", "Solicitud inválida.");
    }
    // `from` decide a dónde vuelve Stripe ([R2-I8]). El default es `onboarding`; la consola
    // de suscripción manda `subscription`.
    const from = body.from === "subscription" ? "subscription" : "onboarding";
    const origin = publicOrigin();
    const { gateway, priceIds } = stripeContext();

    const { customerId, trialEnd } = await withDbTransaction(async (tx) => {
      const { row, decision } = await decideUnderLock(tx, businessId, {
        kind: "subscribe",
        plan,
        interval,
      });
      // Con `intent: subscribe`, lo único que no es `blocked` es `checkout`.
      if (decision.kind !== "checkout") throw new Error(decision.kind);
      return { customerId: row.stripeCustomerId, trialEnd: decision.trialEnd };
    });
    const customer = customerId ?? (await createCustomer(businessId, gateway));

    const metadata = { businessId, plan, interval };
    const session = await gateway.checkout.sessions.create(
      {
        mode: "subscription",
        line_items: [{ price: priceIds[plan][interval], quantity: 1 }],
        customer,
        // `client_reference_id` SÓLO lo escribe nuestro checkout: es el discriminante
        // legítimo con el que el webhook resuelve el negocio de la sesión (m1-b).
        client_reference_id: businessId,
        metadata,
        subscription_data: {
          metadata,
          // Unix SECONDS (las fechas de Stripe); sin `* 1000` al revés, cae en 1970.
          ...(trialEnd === null
            ? {}
            : { trial_end: Math.floor(trialEnd.getTime() / 1000) }),
        },
        success_url: `${origin}${landing(from)}?checkout=success`,
        cancel_url: `${origin}${landing(from)}?checkout=cancelled`,
      },
      { idempotencyKey: `checkout:${businessId}:${plan}:${interval}` },
    );
    if (session.status !== "open" || session.url === null) {
      throw new BillingError(
        409,
        "checkout_session_stale",
        "Ya hay un pago en curso para este plan. Espera unos minutos y vuelve a intentarlo.",
      );
    }
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return billingErrorResponse(
      error,
      "No pudimos abrir Stripe Checkout. Vuelve a intentarlo.",
    );
  }
}

function landing(from: "onboarding" | "subscription"): string {
  return from === "subscription" ? "/backoffice/subscription" : "/backoffice";
}

/** El origen público canónico. 503 y no un fallback: ver el punto 4 del bloque de arriba. */
function publicOrigin(): string {
  const origin = process.env.MERCHANT_PUBLIC_ORIGIN;
  if (!origin) {
    throw new BillingError(
      503,
      "origin_not_configured",
      "El pago no está configurado todavía. Escríbenos y lo resolvemos.",
    );
  }
  return origin.replace(/\/+$/, "");
}

/**
 * Crea el customer y LO PERSISTE antes de redirigir.
 *
 * HALLAZGO PARA EL ORQUESTADOR, declarado acá y en la spec: esta escritura debería vivir en
 * el dominio, con el resto de los `SET`. EL COSTO ES REAL Y ESTÁ MEDIDO; LA IMPOSIBILIDAD NO
 * —y la primera versión de este comentario afirmaba la segunda; lo cazó un revisor—.
 *
 * Medido: dentro de `billing/store.ts` NO entra (con esa 6.ª función el archivo da 313-314
 * líneas y el hook `file-size` sale `EXIT=2`, contra el `EXIT=0` del archivo real). Lo que NO
 * se sostiene es la conclusión: el encargo de la fase D1 prohibía PARTIR `store.ts`, no CREAR
 * UN ARCHIVO NUEVO en `server/billing/` — que es exactamente lo que esta spec ya hizo cinco
 * veces (`derive-rules.ts`, `applicability.ts`, `claim.ts`, `webhook-apply.ts`, `gateway.ts`).
 * O sea: sí puede vivir en el dominio, en un archivo propio; no se hizo en la D1 porque habría
 * sido alcance nuevo sin que el orquestador decidiera el corte. Mientras tanto es una SEGUNDA
 * superficie de escritura sobre `core.subscription` —una columna, un solo escritor— y hay que
 * moverla.
 */
async function createCustomer(
  businessId: string,
  gateway: ReturnType<typeof stripeContext>["gateway"],
): Promise<string> {
  // La `idempotencyKey` es FIJA por negocio a propósito: dos checkouts concurrentes del mismo
  // owner tienen que recibir EL MISMO customer. Sin ella, Stripe crea dos y el segundo pisa la
  // columna — la fila apuntaría a un customer sin la suscripción que se está pagando, y D8
  // reconciliaría contra el customer equivocado. Es la única llamada de la fase que no tenía
  // clave; las otras tres la llevan desde el principio.
  const created = await gateway.customers.create(
    { metadata: { businessId } },
    { idempotencyKey: `billing:customer:${businessId}` },
  );
  await withDbTransaction((tx) =>
    tx
      .update(subscriptions)
      .set({ stripeCustomerId: created.id, updatedAt: new Date() })
      .where(eq(subscriptions.businessId, businessId)),
  );
  return created.id;
}
