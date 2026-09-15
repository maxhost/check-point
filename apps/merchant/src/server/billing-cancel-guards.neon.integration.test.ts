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
 * Spec 0063 D6/D10 + spec 0064 A2 — LOS GUARDS DE `cancel`: lo que impide que una baja
 * legítima se destruya. Nacen de FAILs de revisor, y son la misma forma: estaban escritos en
 * la spec o en un docblock y NINGÚN test los pinneaba — el ADR 0054, un documento afirmando un
 * invariante que nadie verifica.
 *
 *  1. (decisión 3) El revert de `cancel` ante un error determinista corre SÓLO si ESTA
 *     petición creó el estado. Los tests de `billing.neon.integration.test.ts` que parecen
 *     cubrirlo son PRIMEROS pedidos (`createdNow === true`), así que dan idéntico con y sin el
 *     guard. Mutación MUT-A.
 *  2. (decisión 1) `settle-free` es el mismo handler que `cancel`, así que sobre una
 *     suscripción VIVA la cancela EN STRIPE en vez de settlear en local. Ningún test llamaba a
 *     `settle-free` con una suscripción viva. El daño es de plata: settlear en local deja de
 *     cobrarle al negocio un plan que Stripe le sigue facturando. Mutación MUT-D.
 *
 * EL TERCER GUARD ERA DE `resume` Y SE FUE CON LA RUTA (spec 0064 §4: la baja diferida no
 * existe, «no hay reanudar»). Borrar su test está autorizado por esa sección y declarado en el
 * handoff: no es un test que se saca para poner un gate en verde, es el test de una feature
 * que dejó de existir. Lo que ese test protegía —que una baja ajena con `cancel_at` explícito
 * no aterrice en `none`— sigue cubierto por el lado del webhook (`billing-derive.test.ts` y
 * `billing-webhook-writes…`), que es donde vive el discriminante del ADR 0060.
 *
 * Archivo propio por naturaleza, y porque `billing.neon.integration.test.ts` no tiene margen
 * (medido con el hook `file-size`). El corte lo decidió el orquestador.
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
  "api/billing — los guards de `cancel` (spec 0063 D6/D10 + spec 0064 A2)",
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
        // 1.er pedido: deja la marca puesta y se cae en la RED, que no prueba nada — el
        // estado queda PUESTO ([R1-B3]) y la suscripción puede estar cancelada en Stripe.
        fake.cancelError = new Stripe.errors.StripeConnectionError({
          message: "network",
        });
        expect((await post(CANCEL)).status).toBe(503);
        const pedido = await readSubscriptionRow(seed.business.id);
        expect(pedido.plan).toBe("plus");
        expect(pedido.pendingPlan).toBe("free");
        expect(pedido.downgradeRequestedAt).not.toBeNull();

        // 2.º pedido (el reintento de reparación): Stripe lo rechaza con un 4xx, que SÍ prueba
        // que no aplicó nada… pero de ESTE pedido, no del anterior. Sin el guard `createdNow`
        // el revert corre acá y borra una baja que Stripe puede tener confirmada → el tope
        // vuelve a 3 con la cancelación viva → `free` con 3 locales activos.
        fake.cancelError = new Stripe.errors.StripeInvalidRequestError({
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
    it("`settle-free` sobre una suscripción VIVA la CANCELA en Stripe, no settlea en local", async () => {
      await withLivePlus("vivo", async (seed, tag) => {
        expect((await post(SETTLE_FREE)).status).toBe(200);

        // Se lo pidió a Stripe: settlear en local dejaría de cobrarle al negocio un plan que
        // Stripe le sigue facturando. Es el ORÁCULO de MUT-D — las dos ramas terminan con la
        // fila en `free`, así que lo único que las distingue es la llamada.
        expect(fake.calls).toContain(`subscriptions.cancel:${subId(tag)}`);
        // SIN `prorate` ni `invoice_now`: los dos son `false` por default, que es literalmente
        // lo que el owner pidió (ADR 0063, «sin reembolso, no devolvemos plata»).
        expect(fake.cancelParams[0]).toBeUndefined();

        // Y la fila quedó settleada DESPUÉS de la cancelación, no antes.
        const row = await readSubscriptionRow(seed.business.id);
        expect(row.plan).toBe("free");
        expect(row.stripeSubscriptionId).toBeNull();
        expect(row.pendingPlan).toBeNull();
        expect(row.downgradeRequestedAt).toBeNull();
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
        fake.cancelError = plano({ rawType: "invalid_request_error" });
        expect((await post(CANCEL)).status).toBe(503);
        const row = await readSubscriptionRow(seed.business.id);
        expect(row.pendingPlan).toBeNull();
        expect(row.downgradeRequestedAt).toBeNull();
      });

      await withLivePlus("statuscode", async (seed) => {
        fake.cancelError = plano({ statusCode: 400 });
        expect((await post(CANCEL)).status).toBe(503);
        const row = await readSubscriptionRow(seed.business.id);
        expect(row.pendingPlan).toBeNull();
        expect(row.downgradeRequestedAt).toBeNull();
      });
    }, 60_000);

    /**
     * Spec 0064 — EL `catch` REGISTRA LA CAUSA. Pedido explícito de la spec: hoy el `catch`
     * descartaba el objeto de error entero, así que un 503 no dejaba rastro NI en los logs del
     * server y la cuarta pregunta del QA («¿por qué falla?») no tenía forma de contestarse.
     *
     * Y lo que NO se loguea, que es la otra mitad: ni la clave de Stripe, ni el secreto del
     * webhook, ni el id de la suscripción. Con el `businessId` se llega a la fila, que es de
     * donde sale todo lo demás sin escribirlo en un log que va a Vercel.
     */
    it("el `catch` de `cancel` registra la CAUSA, y no escribe secretos", async () => {
      await withLivePlus("log", async (seed, tag) => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
          fake.cancelError = new Stripe.errors.StripeConnectionError({
            message: "boom-de-stripe",
          });
          expect((await post(CANCEL)).status).toBe(503);

          const escrito = spy.mock.calls
            .flat()
            .map((arg) =>
              arg instanceof Error
                ? `${arg.name}:${arg.message}`
                : JSON.stringify(arg),
            )
            .join(" ");
          // LA CAUSA: sin esto el 503 es indistinguible de cualquier otro fallo.
          expect(escrito).toContain("boom-de-stripe");
          expect(escrito).toContain(seed.business.id);
          expect(escrito).not.toContain("sk_test_");
          expect(escrito).not.toContain("whsec_");
          expect(escrito).not.toContain(subId(tag));
        } finally {
          spy.mockRestore();
        }
      });
    }, 60_000);

    /**
     * S7 — LA LLAMADA DE RED NUNCA OCURRE CON EL LOCK TOMADO (`shared.ts:38-48`), que es la
     * regla que obliga a que el paso 3 de A2 viva FUERA de la transacción.
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
        fake.beforeCancel = async () => {
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
        // DURANTE el `subscriptions.cancel`, otro pudo tomar el lock del negocio: la red no
        // corrió adentro de la transacción.
        expect(lockLibre).toBe(true);
      });
    }, 60_000);
  },
);
