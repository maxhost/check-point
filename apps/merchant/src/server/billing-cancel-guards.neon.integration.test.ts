import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import Stripe from "stripe";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  billingRequest,
  livePlusState,
  subId,
} from "./billing-integration-support";
import { fakeStripe, type FakeStripe } from "./billing-stripe-fake";
import {
  seedBillingBusiness,
  stripeEnvEntries,
} from "./billing-webhook-support";
import { dropBusiness, type Seed } from "./counter-integration-support";
import { withDbTransaction } from "@mi-pasaporte/db";
import { integrationEnabled } from "./locations-integration-support";

/**
 * Spec 0189 §D7 — LOS GUARDS DE LAS RUTAS QUE HABLAN CON STRIPE (`cancel`, `plan`): que el
 * fallo de Stripe deje la CAUSA en el log sin secretos, y que la llamada de red NUNCA ocurra con
 * el lock del negocio tomado.
 *
 * Los guards de la baja INMEDIATA del ADR 0063 (el revert ante un rechazo determinista, el
 * reintento que no borra la baja ya pedida, saldar a gratis una suscripción viva) se fueron
 * con esa baja: el ADR 0134 §8 la revirtió a «al fin del periodo» y `cancel` ya no escribe nada
 * antes de que Stripe confirme. Sus tests se borraron con su feature (declarado en el handoff).
 */
let fake: FakeStripe = fakeStripe();
const world = { businessId: "" };

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({
    api: {
      // Spec 0072: el doble declara `emailVerified` porque `requireApiOwner` corre el
      // gate de email en las 10 superficies del owner. Edicion del DOBLE.
      getSession: async () => ({
        user: { id: "owner", emailVerified: true },
      }),
    },
  }),
}));

vi.mock("./staff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./staff")>()),
  // Spec 0072: `ownerContext` selecciona ademas el eje `status`, y `requireApiOwner` es
  // fail-closed — una fila sin `status` NO opera. Edicion del DOBLE, no de una asercion.
  ownerContext: async () =>
    world.businessId
      ? {
          id: world.businessId,
          slug: "int",
          currencyCode: "USD",
          status: "active",
          suspensionReason: null,
        }
      : null,
}));

vi.mock("./stripe-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stripe-config")>();
  const { stripeConfigDouble } = await import("./billing-integration-support");
  return stripeConfigDouble(actual, () => fake);
});

import { POST as CANCEL } from "../app/api/billing/cancel/route";
import { POST as PLAN } from "../app/api/billing/plan/route";

const post = (handler: (r: NextRequest) => Promise<Response>, body = {}) =>
  handler(billingRequest(body));

/** Siembra un `plus` mensual VIVO con literales únicos por corrida —los ids de Stripe son
 * uniques GLOBALES y vitest paraleliza archivos— y limpia siempre. */
async function withLivePlus(
  prefix: string,
  body: (seed: Seed, tag: string) => Promise<void>,
): Promise<void> {
  const tag = `${prefix}${randomUUID().slice(0, 8)}`;
  const seed = await seedBillingBusiness("plus", {
    ...livePlusState(fake, tag),
    trialEndsAt: new Date(Date.now() - 86_400_000),
  });
  world.businessId = seed.business.id;
  try {
    await body(seed, tag);
  } finally {
    await dropBusiness(seed.business.id);
  }
}

describe.skipIf(!integrationEnabled)(
  "api/billing — los guards de las rutas que llaman a Stripe (spec 0189 §D7)",
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
          fake.updateError = new Stripe.errors.StripeConnectionError({
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
    it.each([
      ["cancel", CANCEL, {}],
      ["plan", PLAN, { to: "base" }],
    ] as const)(
      "`%s`: la llamada a Stripe NO ocurre con el lock del negocio tomado",
      async (_name, handler, body) => {
        await withLivePlus("sinlock", async (seed) => {
          let lockLibre: boolean | null = null;
          const probe = async () => {
            // Sólo la PRIMERA llamada de red: si una mutación agregara otra fuera del lock,
            // la segunda observación taparía a la primera y el test quedaría verde.
            if (lockLibre !== null) return;
            lockLibre = await withDbTransaction(async (tx) => {
              await tx.execute(
                sql`select id from core.business where id = ${seed.business.id} for update nowait`,
              );
              return true;
            }).catch(() => false);
          };
          fake.beforeUpdate = probe;

          expect((await post(handler, body)).status).toBe(200);
          // DURANTE el `subscriptions.update`, otro pudo tomar el lock del negocio.
          expect(lockLibre).toBe(true);
        });
      },
      60_000,
    );
  },
);
