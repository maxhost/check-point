import { eq, sql } from "drizzle-orm";
import type Stripe from "stripe";

import { getDb } from "../db";
import { stripeWebhookEvents } from "../schema";

/**
 * Spec 0063, D12 (ADR 0061) — EL CLAIM DEL WEBHOOK, con TRES resultados.
 *
 * Vive separado de `webhook.ts` por el límite de 300 líneas del repo (hook `file-size`:
 * dividir, no extender), no porque sea otra preocupación: el orden de operaciones y el
 * porqué de cada paso están escritos en `webhook.ts` (D5.b).
 *
 * LA REGLA QUE ORDENA TODO LO DE ABAJO, y es la única que hay que recordar:
 *
 *   Un 2xx es una promesa: «este evento ya no es tuyo, no lo mandes más». Sólo se puede
 *   hacer esa promesa cuando el evento está REALMENTE terminado. Retirarse porque otro lo
 *   tiene tomado NO es terminarlo.
 *
 * Por eso el claim NO devuelve `boolean`: colapsar `already_processed` con `in_flight`
 * haría que un reintento rechazado por el lease contestara 200, Stripe lo diera por
 * entregado y un evento cuya primera entrega MURIÓ no se procesara NUNCA — el bug del
 * §Problema-4 que esta spec vino a matar, reintroducido por la puerta de atrás y con una
 * ventana más chica. Es, además, una REGRESIÓN neta respecto de no tener lease: sin él las
 * dos entregas solapadas ganan y escriben (el `UPDATE` es idempotente), así que el estado
 * final queda correcto; con lease y 200 quedaría sin escribir nunca.
 *
 * | resultado           | condición sobre la fila                              | respuesta HTTP            |
 * |---------------------|------------------------------------------------------|---------------------------|
 * | `claimed`           | no había fila, o `processed_at IS NULL` + lease vencido | sigue el procesamiento  |
 * | `already_processed` | `processed_at IS NOT NULL`                           | 200 `{duplicate:true}`    |
 * | `in_flight`         | `processed_at IS NULL` y `received_at` en la ventana  | 409 `"Evento en proceso."`|
 *
 * El despacho de las tres respuestas está en `webhook.ts`; acá vive sólo la clasificación.
 */

/**
 * LA VENTANA DEL LEASE, en segundos. NO es un número mágico y NO es configurable por env:
 *
 *  - No es mágico: tiene una cota inferior derivable. Tiene que ser ESTRICTAMENTE MAYOR que
 *    `maxDuration` de `app/api/stripe/webhook/route.ts` (10 s), porque pasado ese tope el
 *    proceso que tomó el evento está muerto con certeza y el evento tiene que poder
 *    re-tomarse. 60 s da 6× de margen. Agrandarla es seguro (un reintento in-window sólo se
 *    demora); achicarla por debajo de `maxDuration` rompe la premisa y deja eventos clavados
 *    hasta que Stripe se rinda. Si algún día sube `maxDuration`, SUBE LA VENTANA PRIMERO.
 *    La desigualdad está aseverada en `billing-webhook-claim.neon.integration.test.ts`, no
 *    sólo escrita acá.
 *  - No es por env (D12.f, PROHIBIDO explícitamente): suena razonable para poder bajarla en
 *    los tests, pero dejaría el guard colgando de una variable que prod puede tener distinta
 *    y el test pinnearía una ventana que en prod no existe. Los tests envejecen LA FILA por
 *    SQL (`received_at = now() - interval '2 minutes'`), que es lo que de verdad varía en
 *    producción.
 */
export const LEASE_WINDOW_SECONDS = 60;

/**
 * `sql.raw` y no un parámetro: el valor es una constante entera de este módulo (nunca entrada
 * de nadie), y así el plan queda con el literal `'00:01:00'::interval` que el §D12.c
 * transcribe del `EXPLAIN` sobre Neon, en vez de un `$n` sin tipo.
 */
const LEASE_INTERVAL = sql.raw(`interval '${LEASE_WINDOW_SECONDS} seconds'`);

export type ClaimResult = "claimed" | "already_processed" | "in_flight";

/**
 * El ejecutor entra POR PARAMETRO y no por `getDb()` adentro, por una razón que costó un rojo
 * falso: el test que asevera la FORMA del statement con `toSQL()` no necesita —ni debe— una
 * conexión viva. Con `getDb()` adentro, ese test explotaba con `DATABASE_URL no está
 * configurada` en cualquier corrida sin las env de integración: un rojo que parecía el guard
 * mordiendo y era el entorno. Ahora el test construye un ejecutor sin conectar y el rojo sólo
 * puede venir de la forma del SQL.
 */
export type ClaimExecutor = ReturnType<typeof getDb>;

/**
 * (D5.g + D12.c) LA ORTOGRAFÍA DEL `setWhere` ES LOAD-BEARING, y está demostrado mutándola:
 *
 *  - con `WHERE excluded.processed_at IS NULL` —el error natural, porque `excluded` es la
 *    fila PROPUESTA y ahí `processed_at` siempre es `NULL`— el claim sobre una fila YA
 *    PROCESADA devuelve 1 fila: LA OTORGA. El guard se vuelve un no-op con el statement
 *    visualmente idéntico (mutación M7, que comparte observable con M3).
 *  - `setWhere` referencia LA TABLA, y drizzle la renderiza calificada
 *    (`"core"."stripe_webhook_event"."processed_at"`, verificado con `toSQL()`).
 *
 * LOS DOS PREDICADOS SON GUARDS DE VERDAD, y eso es lo que el ADR 0054 exige demostrar: el
 * `EXPLAIN` sobre Neon los pone en el MISMO nodo post-lock, no en un `InitPlan` /
 * `One-Time Filter` que se evaluaría ANTES del lock:
 *
 *   Conflict Filter: ((stripe_webhook_event.processed_at IS NULL)
 *                 AND (stripe_webhook_event.received_at < (now() - '00:01:00'::interval)))
 *
 * `received_at` se re-escribe con `now()` —el reloj de POSTGRES— y no con el `new Date()` del
 * proceso: el predicado del lease compara contra `now()`, así que escribir la columna con el
 * reloj de la lambda haría que la ventana dependiera del desfase entre Vercel y Neon. D12.c
 * fija el statement así.
 *
 * [R1-M1] sigue intacto: esto es UN statement por `getDb()` (neon-http, autocommit), así que
 * el claim commitea antes del `retrieve` y no hay nada lento después de él dentro de la misma
 * transacción — un `ON CONFLICT DO UPDATE` que falla el filtro deja la fila LOCKEADA hasta el
 * commit.
 *
 * `payload_version` sale de `event.api_version`: es el dato que prueba en qué versión
 * serializó Stripe el payload (en prod, `2020-08-27`).
 *
 * EL STATEMENT ESTÁ EXTRAÍDO EN `claimStatement` PARA QUE TENGA ORÁCULO, y eso salió de una
 * mutación del revisor que quedó VERDE: cambiar `sql\`now()\`` por `new Date()` no ponía rojo
 * NINGUNO de los 17 tests de integración del webhook, o sea que el párrafo de arriba sobre el
 * reloj de Postgres era una afirmación sin pinnear (ADR 0054 del lado del comentario). Ahora
 * `billing-webhook-claim.neon.integration.test.ts` asevera la forma renderizada con `toSQL()`.
 * Es un chequeo de FORMA y se etiqueta como tal: la propiedad de COMPORTAMIENTO —qué pasa con
 * un reloj desfasado— exigiría dos relojes y NO está cubierta. Lo que el test cierra es que el
 * statement no vuelva a escribir la columna con el reloj del proceso sin que nadie lo note.
 */
export function claimStatement(db: ClaimExecutor, event: Stripe.Event) {
  return db
    .insert(stripeWebhookEvents)
    .values({
      eventId: event.id,
      eventType: event.type,
      payloadVersion: event.api_version ?? "unknown",
    })
    .onConflictDoUpdate({
      target: stripeWebhookEvents.eventId,
      set: { receivedAt: sql`now()` },
      setWhere: sql`${stripeWebhookEvents.processedAt} is null and ${stripeWebhookEvents.receivedAt} < now() - ${LEASE_INTERVAL}`,
    })
    .returning({ eventId: stripeWebhookEvents.eventId });
}

export async function claimEvent(event: Stripe.Event): Promise<ClaimResult> {
  const claimed = await claimStatement(getDb(), event);
  if (claimed.length > 0) return "claimed";
  return classifyRejection(event.id);
}

/**
 * ESTE `SELECT` NO ES UN GUARD, Y HAY QUE LEERLO ASÍ. Está escrito diciéndolo porque el
 * próximo lector va a suponer que sí lo es y va a querer «arreglarle» la atomicidad —
 * metiéndolo en un CTE junto al upsert, que además sería EXACTAMENTE el error del ADR 0054
 * (un `SELECT` en un CTE previo se evalúa ANTES del lock, como `InitPlan`, una sola vez).
 *
 * Es un CLASIFICADOR DE LA RESPUESTA. El upsert devuelve 0 filas en los DOS casos de rechazo
 * y no dice cuál es cuál; esto corre SÓLO en el camino de rechazo (el raro) para elegir entre
 * 200 y 409. La carrera contra la entrega #1 existe y es BENIGNA EN LOS DOS ÓRDENES:
 *
 *  - si la entrega #1 termina justo en el medio, leemos `processed_at` puesto → 200
 *    `{duplicate:true}` → CORRECTO: el evento está terminado de verdad;
 *  - si leemos `NULL` → 409 → Stripe reintenta → CORRECTO: no prometimos nada que no fuera
 *    cierto, y el peor caso es que el reintento se demore.
 *
 * Ningún orden pierde el evento y ninguno miente. Ésa es la propiedad, y es la razón por la
 * que no hace falta un statement único.
 *
 * El caso «no hay fila» (alguien la borró entre el upsert y esta lectura) cae también en
 * `in_flight` → 409 → Stripe reintenta, que es el lado seguro de equivocarse: nunca
 * prometemos terminado algo que no leímos terminado.
 *
 * ESE CASO NO TIENE ORÁCULO Y SE DECLARA, en vez de dejar la frase de arriba sonando a
 * propiedad verificada: un revisor lo mutó (devolver `already_processed` cuando no hay fila) y
 * quedó VERDE en 11/11. No se pinnea porque sólo es alcanzable con un `DELETE` externo entre
 * dos statements —no hay ningún camino del producto que lo produzca— y fabricarlo exigiría
 * inyectar el `db` en esta función sólo para el test. Si algún día se agrega un borrado de
 * eventos viejos, ESTE es el renglón que hay que volver a mirar.
 */
async function classifyRejection(eventId: string): Promise<ClaimResult> {
  const [row] = await getDb()
    .select({ processedAt: stripeWebhookEvents.processedAt })
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.eventId, eventId));
  return row?.processedAt == null ? "in_flight" : "already_processed";
}
