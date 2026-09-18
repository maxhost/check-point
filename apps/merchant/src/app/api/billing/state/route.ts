import {
  billingErrorResponse,
  billingStateResponse,
  requireBillingOwner,
} from "../_auth";

export const dynamic = "force-dynamic";

/**
 * Spec 0074 §D2 — `GET /api/billing/state`, EL PLAN Y LA SUSCRIPCION.
 *
 * **No compone nada: delega en `billingStateResponse`**, que ya existe y que **ya es la
 * respuesta de las cuatro rutas POST de billing**. Es §D0 aplicado: el conocimiento de plan
 * vivia en tres lugares y ya divergio una vez (0072 §P1); un `GET` que armara su propio objeto
 * a mano seria el cuarto. De ahi sale, gratis, la allow-list positiva `toSubscriptionView` —lo
 * unico que hay entre Stripe y el navegador (mutacion M4)—: `stripeCustomerId`,
 * `stripeSubscriptionId` y `downgradeRequestedAt` no pueden viajar.
 *
 * **SI pasa por `requireApiOwner`** —al reves que `/api/merchant/session`— y emite los cinco
 * `code` de la 0072 en su orden (ADR 0073 §1). Es dato del owner: un integrante recibe
 * SIEMPRE `not_owner`, aunque su email no este verificado y aunque el negocio este suspendido.
 *
 * **El lock se hereda a proposito y es COSTO DECLARADO, no perseguido.**
 * `billingStateResponse` abre transaccion y toma `lockBusiness` antes de leer porque su
 * contrato pide que la lectura y la decision de `canCancel` ocurran en la misma transaccion
 * lockeada. Un camino de lectura sin lock, para ahorrarselo, produciria un `canCancel` que
 * puede mentir — y seria el segundo lugar donde vive la regla.
 */
export async function GET(request: Request) {
  const auth = await requireBillingOwner(request);
  if ("response" in auth) return auth.response;
  try {
    return await billingStateResponse(auth.business.id);
  } catch (error) {
    // Un fallo de base sale como el 503 con `code` que el contrato de billing declara, nunca
    // como un 500 pelado (leccion de la spec 0068 §3).
    return billingErrorResponse(error, "No pudimos leer tu suscripción.");
  }
}
