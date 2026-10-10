import {
  billingErrorResponse,
  billingStateResponse,
  requireBillingOwner,
} from "../_auth";

export const dynamic = "force-dynamic";

/**
 * Spec 0074 §D2 + spec 0189 §D10 — `GET /api/billing/state`, EL ESTADO DE COBRO.
 *
 * **No compone nada: delega en `billingStateResponse`**, que es también la respuesta de éxito
 * de `plan`/`interval`/`cancel`/`resume`: un solo lugar arma el contrato de §D10, con la
 * allow-list positiva `toSubscriptionView` como lo único entre Stripe y el navegador.
 *
 * **Pasa por `requireBillingOwner`** (owner + email verificado + eje `status`) con
 * `allowBlocked`: un negocio sin acceso SÍ la lee — es la pantalla donde paga.
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
