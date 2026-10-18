import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  billingRequest,
  livePlusState,
  readSubscriptionRow,
} from "./billing-integration-support";
import { fakeStripe, type FakeStripe } from "./billing-stripe-fake";
import {
  seedBillingBusiness,
  stripeEnvEntries,
} from "./billing-webhook-support";
import { dropBusiness } from "./counter-integration-support";
import { withDbTransaction } from "@mi-pasaporte/db";
import { lockBusiness } from "./locations/shared";
import { integrationEnabled } from "./locations-integration-support";

/**
 * Spec 0063, D6 — LA SUPERFICIE COMPARTIDA DE `app/api/billing/_auth.ts`: lo que vale para las
 * rutas que deciden porque vive en `decideUnderLock`. Nace del barrido sistemático de afirmaciones
 * (S1), que encontró sin oráculo la propiedad más central de la spec.
 *
 * `decideUnderLock` documenta «el conteo de locales que alimenta `downgrade_blocked` tiene que
 * leerse BAJO EL LOCK, o entre la verificación y la escritura cabe un desarchivado (ADR 0054
 * §2)». El lock del WEBHOOK sí tenía oráculo (mutación M4); el de la RUTA no: sacar
 * `lockBusiness` de `decideUnderLock` dejaba 39/39 en verde.
 *
 * CÓMO SE PINNEA, y por qué así: una carrera «a ver si sale» sería flaky —los dos órdenes son
 * estados válidos—. Esto es DETERMINISTA: el test TOMA el lock del negocio y verifica que
 * mientras lo tenga la ruta NO ESCRIBIÓ NADA, leyéndolo por otra conexión; y que en cuanto se
 * libera, escribe. Ver adentro por qué el oráculo NO puede ser «la ruta no terminó».
 */
let fake: FakeStripe = fakeStripe();
const world = { businessId: "" };

vi.mock("./backoffice-membership", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./backoffice-membership")>();
  const { legacyMembershipFixtures } =
    await import("./backoffice-membership-fixture.test-support");
  return { ...actual, ...legacyMembershipFixtures() };
});

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

const post = () => CANCEL(billingRequest({}) as NextRequest);

describe.skipIf(!integrationEnabled)(
  "api/billing — el read-modify-write bajo lock de `_auth.ts` (spec 0063, D6)",
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

    it("un `cancel` ESPERA al que tiene el lock del negocio, y recién después decide", async () => {
      const tag = `lock${randomUUID().slice(0, 8)}`;
      const seed = await seedBillingBusiness("plus", {
        ...livePlusState(fake, tag),
        trialEndsAt: new Date(Date.now() - 86_400_000),
      });
      world.businessId = seed.business.id;
      try {
        let terminado = false;
        let enVuelo: Promise<Response> | null = null;

        await withDbTransaction(async (tx) => {
          await lockBusiness(tx, seed.business.id);
          enVuelo = post().then((response) => {
            terminado = true;
            return response;
          });
          // Tiempo de sobra para que la ruta llegue al lock y se quede ahí.
          await new Promise((resolve) => setTimeout(resolve, 2_000));

          // LA PROPIEDAD (spec 0189): con el lock tomado por otro, la ruta NO DECIDIÓ — y
          // como la llamada a Stripe va DESPUÉS de decidir, el doble no recibió nada. Sin
          // `lockBusiness` en `decideUnderLock`, la decisión corre igual y el `update` ya
          // estaría en `fake.calls` (la escritura local, en cambio, espera igual: la ruta
          // vuelve a tomar el lock para escribir, así que la FILA no discrimina).
          //
          // OJO CON EL ORÁCULO QUE NO SIRVE: «la ruta no terminó» queda VERDE con y sin el
          // guard, porque la escritura y `billingStateResponse` TAMBIÉN toman el lock.
          expect(fake.calls).toEqual([]);
          const durante = await readSubscriptionRow(seed.business.id);
          expect(durante.pendingPlan).toBeNull();
          expect(terminado).toBe(false);
        });

        // Y en cuanto se libera, avanza y decide con lo que hay: no se perdió el pedido.
        const response = await enVuelo!;
        expect(response.status).toBe(200);
        expect(terminado).toBe(true);
        // Spec 0189: cancelar PROGRAMA el fin al cierre del periodo y el plan se conserva.
        const row = await readSubscriptionRow(seed.business.id);
        expect([row.plan, row.pendingPlan]).toEqual(["plus", "none"]);
        expect(row.downgradeRequestedAt).not.toBeNull();
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 60_000);
  },
);
