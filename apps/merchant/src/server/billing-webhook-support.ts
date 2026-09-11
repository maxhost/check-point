import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";

import {
  STRIPE_TEST_ENV,
  eventBody,
  webhookRequest,
} from "./billing-integration-support";
import {
  seedLocationsBusiness,
  type SeededSubscription,
} from "./locations-integration-support";
import { POST as webhookPost } from "../app/api/stripe/webhook/route";
import { getDb } from "./db";
import { stripeWebhookEvents } from "./schema";

/**
 * Spec 0063 — la ENTREGA de un evento por la ruta real, compartida por los tests de
 * integración del webhook (`billing-webhook*.neon.integration.test.ts`) y por el de
 * `store.ts`, que necesita al webhook para la carrera de la mutación M4.
 *
 * Archivo propio por el límite de 300 líneas del repo: el preámbulo (secreto, registro de
 * ids, `deliver`, seed) son ~60 líneas y se repetía en tres archivos. El `vi.mock` de
 * `stripe-config` NO puede vivir acá —tiene que estar en cada `.test.ts`— y son 6 líneas.
 */

export const WEBHOOK_SECRET = STRIPE_TEST_ENV.STRIPE_WEBHOOK_SECRET_TEST;

export type EventDelivery = {
  id: string;
  type: string;
  created?: number;
  object: Record<string, unknown>;
};

/**
 * Registro de los ids de evento que un archivo creó, para borrarlos en el `afterAll`:
 * `core.stripe_webhook_event` no tiene FK a `core.business`, así que `dropBusiness` no se las
 * lleva.
 */
export function eventIdRegistry() {
  const ids: string[] = [];
  return {
    ids,
    next(tag: string) {
      const id = `evt_${tag}_${randomUUID()}`;
      ids.push(id);
      return id;
    },
  };
}

/** El POST firmado a la ruta real. El `secret` es parámetro para que un test pueda firmar con
 * el EQUIVOCADO y comprobar que el 400 llega por la firma y no por la configuración. */
export function deliver(
  spec: EventDelivery,
  secret: string = WEBHOOK_SECRET,
): Promise<Response> {
  return webhookPost(webhookRequest(eventBody(spec), secret));
}

/** Un negocio con su suscripción en el estado pedido ([R2-I7]). El nombre es único para que
 * dos tests concurrentes no colisionen. */
export function seedBillingBusiness(
  plan: "free" | "plus" | "none",
  state: SeededSubscription = {},
) {
  return seedLocationsBusiness(
    `Billing ${randomUUID().slice(0, 8)}`,
    plan,
    state,
  );
}

/** Las 5 env de Stripe, puestas con el `vi.stubEnv` del test (no se importa `vitest` acá). */
export function stripeEnvEntries(): [string, string][] {
  return Object.entries(STRIPE_TEST_ENV);
}

/**
 * (D12.f) ENVEJECER LA FILA DEL EVENTO POR SQL. Es como se prueba el reintento FUERA de la
 * ventana del lease sin dormir 60 s: es el estado real que tendria un evento viejo, no un
 * doble. Vive aca porque lo necesitan DOS archivos de integracion — el del claim (fase C) y el
 * de claim/allow-list (fase B), cuyo test del `retrieve` fallido reintenta despues de la
 * ventana desde que existe el lease.
 *
 * Lo que esta PROHIBIDO para conseguir lo mismo es lo contrario: volver la ventana
 * configurable por env para bajarla en los tests. Eso dejaria el guard colgando de una
 * variable que prod puede tener distinta, y el test pinneando una ventana que en prod no
 * existe.
 */
export async function ageEventRow(
  eventId: string,
  seconds: number,
): Promise<void> {
  await getDb()
    .update(stripeWebhookEvents)
    .set({ receivedAt: sql`now() - make_interval(secs => ${seconds})` })
    .where(eq(stripeWebhookEvents.eventId, eventId));
}
