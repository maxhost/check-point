import { eq } from "drizzle-orm";
import { withDbTransaction } from "../../../../server/db";
import { subscriptions } from "../../../../server/schema";
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
 * Spec 0063, D6 — `POST /api/billing/checkout`. Antes de esta spec era la ÚNICA ruta de
 * billing y su único llamador era el onboarding; ahora la comparte con la sección de
 * suscripción, y cambia en cuatro cosas:
 *
 *  1. EL `businessId` NO VIENE DEL BODY. Antes lo tomaba del body y verificaba membresía
 *     sobre ESE negocio (cualquier miembro, incluido un staff, y sin mirar `status`). Ahora
 *     sale de `ownerContext`, igual que en locales. Mutación M6.
 *  2. GATE DE PLAN: `decidePlanChange` con `intent: "upgrade"` — un negocio con suscripción
 *     viva recibe 409 `subscription_live` en vez de abrir un segundo Checkout y COBRAR DOS
 *     VECES.
 *  3. EL CUSTOMER SE CREA Y SE PERSISTE ACÁ (decisión 5 del orquestador), no cuando llega un
 *     evento: es lo que hace que la reconciliación de D8 no sea un no-op, y de paso deja de
 *     crear un customer nuevo por intento ([R1-N2]).
 *  4. LOS `*_url` SALEN DE `MERCHANT_PUBLIC_ORIGIN`, no de `new URL(request.url).origin`
 *     ([R2-I10]). Si falta: **503 `origin_not_configured`**. Un fallback silencioso al
 *     `request.url` devuelve el bug por la puerta de atrás — con la `idempotencyKey` FIJA,
 *     una primera sesión creada desde `www.` deja las `*_url` clavadas en ese dominio para
 *     las 24 h siguientes.
 *
 * LA `idempotencyKey` SE CONSERVA FIJA (`checkout:${businessId}:${interval}`): cambiarla
 * permitiría varias sesiones abiertas a la vez. A cambio, antes de redirigir se verifica que
 * la sesión esté ABIERTA (`status === "open"` y `url !== null`); si no, 409
 * `checkout_session_stale`, porque mandar al owner a una sesión ya completada es un FALSO
 * ÉXITO que termina en «pagué y sigo en free».
 */
export async function POST(request: Request) {
  const gate = await requireBillingOwner(request);
  if ("response" in gate) return gate.response;
  const businessId = gate.business.id;
  try {
    const body = await readBody(request);
    const interval =
      body.interval === "year"
        ? "year"
        : body.interval === "month"
          ? "month"
          : null;
    if (interval === null) {
      throw new BillingError(400, "invalid_input", "Solicitud inválida.");
    }
    // `from` decide a dónde vuelve Stripe ([R2-I8]): sin esto, el que paga en el ALTA
    // aterriza en una pantalla que no pidió. El default es `onboarding` porque hoy el único
    // llamador es el alta y no manda el campo; la consola de D2 manda `subscription`.
    const from = body.from === "subscription" ? "subscription" : "onboarding";
    const origin = publicOrigin();
    const { gateway, priceIds } = stripeContext();

    const customerId = await withDbTransaction(async (tx) => {
      const { row } = await decideUnderLock(tx, businessId, {
        kind: "upgrade",
        interval,
      });
      return row.stripeCustomerId;
    });
    const customer = customerId ?? (await createCustomer(businessId, gateway));

    const session = await gateway.checkout.sessions.create(
      {
        mode: "subscription",
        line_items: [
          {
            price: interval === "month" ? priceIds.monthly : priceIds.yearly,
            quantity: 1,
          },
        ],
        customer,
        // `client_reference_id` SÓLO lo escribe nuestro checkout: es el discriminante
        // legítimo con el que el webhook resuelve el negocio de la sesión (m1-b).
        client_reference_id: businessId,
        metadata: { businessId, interval },
        subscription_data: { metadata: { businessId, interval } },
        success_url: `${origin}${landing(from)}?checkout=success`,
        cancel_url: `${origin}${landing(from)}?checkout=cancelled`,
      },
      { idempotencyKey: `checkout:${businessId}:${interval}` },
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
