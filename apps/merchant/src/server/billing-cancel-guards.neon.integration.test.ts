import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import Stripe from "stripe";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  billingRequest,
  livePlusState,
  readSubscriptionRow,
  subId,
} from "./billing-integration-support";
import { fakeStripe, type FakeStripe } from "./billing-stripe-fake";
import {
  seedBillingBusiness,
  stripeEnvEntries,
} from "./billing-webhook-support";
import { dropBusiness, type Seed } from "./counter-integration-support";
import { withDbTransaction } from "./db";
import { integrationEnabled } from "./locations-integration-support";

/**
 * Spec 0063, D6/D10 — LOS GUARDS DEL CICLO `cancel` / `resume`: lo que impide que una baja
 * legítima se destruya, y lo que impide que una reanudación deje la baja viva en Stripe. Los
 * tres nacen de FAILs de revisor, y los tres son la misma forma: estaban escritos en la spec o
 * en un docblock y NINGÚN test los pinneaba — el ADR 0054, un documento afirmando un
 * invariante que nadie verifica.
 *
 *  1. (decisión 3) El revert de `cancel` ante un error determinista corre SÓLO si ESTA
 *     petición creó el estado. Los dos tests de `billing.neon.integration.test.ts` que parecen
 *     cubrirlo son los dos PRIMEROS pedidos (`createdNow === true`), así que dan idéntico con
 *     y sin el guard. Mutación MUT-A.
 *  2. (decisión 1) `settle-free` es el mismo handler que `cancel`, así que sobre una
 *     suscripción VIVA programa la baja EN STRIPE en vez de settlear en local. Ningún test
 *     llamaba a `settle-free` con una suscripción viva. El daño es de plata: settlear en local
 *     deja de cobrarle al negocio un plan que Stripe le sigue facturando. Mutación MUT-D.
 *
 *  3. (`resume`, D6) La reanudación limpia el `cancel_at` EXPLÍCITO —el que setea el botón del
 *     dashboard de Stripe—, no sólo `cancel_at_period_end`. Sin eso, `clearPendingPlan` borra
 *     las tres columnas (incluida `downgrade_requested_at`) mientras Stripe conserva la baja:
 *     el webhook repone `pending_plan='free'` pero NO la marca, así que el `deleted` de fin de
 *     periodo llega con `downgrade_requested_at IS NULL` y aterriza en **`plan='none'`** — un
 *     owner que reanudó, bloqueado. Mutación MUT-J. (Cuando el `cancel_at` lo generó nuestro
 *     propio `cancel_at_period_end: true`, Stripe lo limpia solo al ponerlo en `false`: el
 *     guard es load-bearing para el EXPLÍCITO, que es el caso que el docblock nombra.)
 *
 * Archivo propio por naturaleza, y porque `billing.neon.integration.test.ts` está en **300
 * exactas** (medido con el hook `file-size`): cero margen. El corte lo decidió el orquestador.
 */
let fake: FakeStripe = fakeStripe();
const world = { businessId: "" };

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({
    api: { getSession: async () => ({ user: { id: "owner" } }) },
  }),
}));

vi.mock("./staff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./staff")>()),
  ownerContext: async () =>
    world.businessId ? { id: world.businessId, currencyCode: "USD" } : null,
}));

vi.mock("./stripe-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stripe-config")>();
  const { stripeConfigDouble } = await import("./billing-integration-support");
  return stripeConfigDouble(actual, () => fake);
});

import { POST as CANCEL } from "../app/api/billing/cancel/route";
import { POST as RESUME } from "../app/api/billing/resume/route";
import { POST as SETTLE_FREE } from "../app/api/billing/settle-free/route";

const post = (handler: (r: NextRequest) => Promise<Response>) =>
  handler(billingRequest({}));

/** Siembra un `plus` mensual VIVO con literales únicos por corrida —los ids de Stripe son
 * uniques GLOBALES y vitest paraleliza archivos— y limpia siempre. */
async function withLivePlus(
  prefix: string,
  body: (seed: Seed, tag: string) => Promise<void>,
): Promise<void> {
  const tag = `${prefix}${randomUUID().slice(0, 8)}`;
  const seed = await seedBillingBusiness("plus", livePlusState(fake, tag));
  world.businessId = seed.business.id;
  try {
    await body(seed, tag);
  } finally {
    await dropBusiness(seed.business.id);
  }
}

describe.skipIf(!integrationEnabled)(
  "api/billing — los guards del ciclo `cancel` / `resume` (spec 0063, D6/D10)",
  () => {
    beforeEach(() => {
      fake = fakeStripe();
      world.businessId = "";
      for (const [name, value] of stripeEnvEntries()) vi.stubEnv(name, value);
      vi.stubEnv("MERCHANT_PUBLIC_ORIGIN", "https://checkpass.test");
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    /**
     * MUT-A. `cancel` es idempotente y es EL CAMINO DE REPARACIÓN: el owner reintenta el mismo
     * pedido. Si ese reintento falla con un error determinista, revertir borraría una baja que
     * Stripe YA tiene confirmada → el tope vuelve a 3 con la cancelación viva → `free` con 3
     * locales activos al cerrar el periodo. Es el daño que [R1-B3] existe para impedir,
     * alcanzado por el otro camino.
     */
    it("un REINTENTO de `cancel` que falla determinista NO borra la baja ya pedida", async () => {
      await withLivePlus("repar", async (seed) => {
        // 1.er pedido: entra limpio y deja la marca puesta.
        expect((await post(CANCEL)).status).toBe(200);
        const pedido = await readSubscriptionRow(seed.business.id);
        expect(pedido.pendingPlan).toBe("free");
        expect(pedido.downgradeRequestedAt).not.toBeNull();

        // 2.º pedido (el reintento de reparación): Stripe lo rechaza con un 4xx, que SÍ prueba
        // que no aplicó nada… pero de ESTE pedido, no del anterior.
        fake.updateError = new Stripe.errors.StripeInvalidRequestError({
          message: "no such subscription",
          statusCode: 400,
        });
        expect((await post(CANCEL)).status).toBe(503);

        const despues = await readSubscriptionRow(seed.business.id);
        expect(despues.pendingPlan).toBe("free");
        expect(despues.downgradeRequestedAt).toEqual(
          pedido.downgradeRequestedAt,
        );
      });
    }, 60_000);

    /**
     * MUT-D. `settle-free` y `cancel` son el MISMO handler, así que lo que decide es la FILA y
     * nunca la URL: sobre una suscripción viva no se settlea en local, se programa la baja en
     * Stripe. El barrido del filesystem de `billing-routes.test.ts` no ve esto — mira que
     * exista el `export POST`, no el cuerpo.
     */
    it("`settle-free` sobre una suscripción VIVA programa la baja EN STRIPE, no en local", async () => {
      await withLivePlus("vivo", async (seed, tag) => {
        expect((await post(SETTLE_FREE)).status).toBe(200);

        // Se lo pidió a Stripe: settlear en local dejaría de cobrarle al negocio un plan que
        // Stripe le sigue facturando.
        expect(fake.calls).toContain(`subscriptions.update:${subId(tag)}`);
        expect(fake.updateParams[0]).toEqual({ cancel_at_period_end: true });

        // Y la fila quedó como una baja PROGRAMADA, no como un `free` ya aplicado.
        const row = await readSubscriptionRow(seed.business.id);
        expect(row.plan).toBe("plus");
        expect(row.pendingPlan).toBe("free");
        expect(row.downgradeRequestedAt).not.toBeNull();
        expect(row.stripeSubscriptionId).toBe(subId(tag));
      });
    }, 60_000);

    /**
     * MUT-J. `cancel_at` es INDEPENDIENTE de `cancel_at_period_end`
     * (`Subscriptions.d.ts:129`) y se puede setear desde el dashboard: es el actor por el que
     * existe el ADR 0060. Un `resume` que no lo limpia deja a Stripe con la baja VIVA mientras
     * la fila se limpia entera — y el desenlace es `plan='none'` sobre un negocio que reanudó.
     */
    it("`resume` limpia el `cancel_at` EXPLÍCITO, no sólo `cancel_at_period_end`", async () => {
      await withLivePlus("reanuda", async (seed, tag) => {
        // Una baja con FECHA explícita, como la deja el botón del dashboard de Stripe.
        const periodEnd = Math.floor(Date.UTC(2026, 9, 1) / 1000);
        fake.subscriptions.get(subId(tag))!.cancel_at = periodEnd;

        expect((await post(CANCEL)).status).toBe(200);

        // S11 — EL ORDEN DE `resume` ES EL INVERSO DEL DE `cancel`, y acá se mide: durante la
        // llamada a Stripe la fila TODAVÍA tiene la baja programada, porque el estado
        // conservador es «seguir capado». Al revés, un fallo de red devolvería el tope a 3 con
        // la cancelación viva en Stripe.
        let duranteStripe: Awaited<
          ReturnType<typeof readSubscriptionRow>
        > | null = null;
        fake.beforeUpdate = async () => {
          duranteStripe = await readSubscriptionRow(seed.business.id);
        };
        expect((await post(RESUME)).status).toBe(200);
        expect(duranteStripe!.pendingPlan).toBe("free");
        expect(duranteStripe!.downgradeRequestedAt).not.toBeNull();

        // S12 — la clave lleva el `pending_plan_at`, así que un ciclo
        // `cancel → resume → cancel → resume` estrena una clave nueva en vez de comerse la
        // respuesta cacheada de Stripe.
        expect(fake.updateKeys.at(-1)).toBe(
          `billing:resume:${subId(tag)}:${new Date(periodEnd * 1000).toISOString()}`,
        );

        // El oráculo es lo que se le PIDIÓ a Stripe, no lo que el fake devolvió.
        expect(fake.updateParams.at(-1)).toEqual({
          cancel_at_period_end: false,
          cancel_at: null,
        });
        expect(fake.subscriptions.get(subId(tag))!.cancel_at).toBeNull();

        // Y la fila quedó sin baja programada: las TRES columnas juntas. Dejar
        // `downgrade_requested_at` puesto haría que un `deleted` ajeno se clasificara
        // «esperado» y aterrizara en `free` en vez de `none`.
        const row = await readSubscriptionRow(seed.business.id);
        expect([
          row.pendingPlan,
          row.pendingPlanAt,
          row.downgradeRequestedAt,
        ]).toEqual([null, null, null]);
      });
    }, 60_000);

    /**
     * S9 — LA CLASIFICACIÓN DEL ERROR NO MIRA SÓLO `type`. El docblock de
     * `isDeterministicRejection` justifica mirar `type`, `rawType` y `statusCode` en vez de un
     * `instanceof` (que se rompe si el que construyó el error cargó otra copia del módulo),
     * pero los únicos errores que la suite construía traían `type`, así que las otras dos ramas
     * eran INALCANZABLES y el barrido las encontró verdes. Acá se les pasa un error PLANO con
     * `rawType` y otro sólo con `statusCode`, que es lo que llega si el SDK cambia de forma.
     */
    it("el revert clasifica un 4xx por `rawType` y por `statusCode`, no sólo por `type`", async () => {
      const plano = (extra: Record<string, unknown>) =>
        Object.assign(new Error("no such subscription"), extra);

      await withLivePlus("rawtype", async (seed) => {
        fake.updateError = plano({ rawType: "invalid_request_error" });
        expect((await post(CANCEL)).status).toBe(503);
        const row = await readSubscriptionRow(seed.business.id);
        expect(row.pendingPlan).toBeNull();
        expect(row.downgradeRequestedAt).toBeNull();
      });

      await withLivePlus("statuscode", async (seed) => {
        fake.updateError = plano({ statusCode: 400 });
        expect((await post(CANCEL)).status).toBe(503);
        const row = await readSubscriptionRow(seed.business.id);
        expect(row.pendingPlan).toBeNull();
        expect(row.downgradeRequestedAt).toBeNull();
      });
    }, 60_000);

    /**
     * S7 — LA LLAMADA DE RED NUNCA OCURRE CON EL LOCK TOMADO (`shared.ts:38-48`), que es la
     * regla que obliga a que el paso 3 de D6 viva FUERA de la transacción.
     *
     * EL ORÁCULO USA `FOR UPDATE NOWAIT` A PROPÓSITO, y ese detalle es todo el test: preguntar
     * por el lock con un `SELECT … FOR UPDATE` normal BLOQUEA, así que la mutación no fallaría
     * con una aserción sino con `Test timed out in 60000ms` —un rojo que no dice QUÉ propiedad
     * se rompió, y que además deja transacciones colgadas que envenenan la rama (pasó de
     * verdad en el barrido del revisor)—. `NOWAIT` contesta al instante: si el lock está
     * tomado, Postgres tira `55P03` en vez de esperar, y el fallo queda como
     * `expected false to be true`.
     */
    it("la llamada a Stripe NO ocurre con el lock del negocio tomado", async () => {
      await withLivePlus("sinlock", async (seed) => {
        let lockLibre: boolean | null = null;
        fake.beforeUpdate = async () => {
          // Sólo la PRIMERA llamada de red: si una mutación agregara otra fuera del lock, la
          // segunda observación taparía a la primera y el test quedaría verde.
          if (lockLibre !== null) return;
          lockLibre = await withDbTransaction(async (tx) => {
            await tx.execute(
              sql`select id from core.business where id = ${seed.business.id} for update nowait`,
            );
            return true;
          }).catch(() => false);
        };

        expect((await post(CANCEL)).status).toBe(200);
        // DURANTE el `subscriptions.update`, otro pudo tomar el lock del negocio: la red no
        // corrió adentro de la transacción.
        expect(lockLibre).toBe(true);
      });
    }, 60_000);
  },
);
