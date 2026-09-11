import { handleStripeWebhook } from "../../../../server/billing/webhook";

/**
 * Spec 0063, D5 — la ruta es una cáscara: todo el orden de operaciones (firma → claim →
 * allow-list → `retrieve` fuera de transacción → segunda transacción con `lockBusiness`)
 * vive en `server/billing/webhook.ts`, que es donde tiene oráculo.
 *
 * `runtime = "nodejs"` es explícito y no decorativo: `constructEvent` verifica la firma con
 * `node:crypto` y la derivación corre dentro de una transacción interactiva sobre el pool de
 * WebSockets de Neon. En el edge runtime ninguna de las dos cosas está garantizada.
 *
 * `maxDuration` TAMPOCO es decorativo, y es la premisa de la que cuelga el lease del claim
 * (D12.d / ADR 0061): la ventana del lease (`LEASE_WINDOW_SECONDS`, 60 s) tiene que ser
 * ESTRICTAMENTE MAYOR que este valor, porque recién pasado este tope el proceso que tomó un
 * evento está muerto con certeza y el evento se puede re-tomar. Sin declararlo, esa premisa
 * vivía en un default de Vercel que no controlamos ni versionamos. La desigualdad está
 * aseverada en `billing-webhook-claim.neon.integration.test.ts`.
 *
 * Va en la RUTA y no en `vercel.json`: un valor que el plan no admite hace que Vercel rechace
 * el deploy ENTERO (ya pasó con un 3er cron). 10 s está por debajo del tope de cualquier plan
 * y bien por encima del camino real (firma → claim → un `retrieve` → una transacción).
 */
export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request: Request) {
  return handleStripeWebhook(request);
}
