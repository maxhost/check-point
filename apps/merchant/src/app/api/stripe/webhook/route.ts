import { handleStripeWebhook } from "../../../../server/billing/webhook";

/**
 * Spec 0063, D5 — la ruta es una cáscara: todo el orden de operaciones (firma → claim →
 * allow-list → `retrieve` fuera de transacción → segunda transacción con `lockBusiness`)
 * vive en `server/billing/webhook.ts`, que es donde tiene oráculo.
 *
 * `runtime = "nodejs"` es explícito y no decorativo: `constructEvent` verifica la firma con
 * `node:crypto` y la derivación corre dentro de una transacción interactiva sobre el pool de
 * WebSockets de Neon. En el edge runtime ninguna de las dos cosas está garantizada.
 */
export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleStripeWebhook(request);
}
