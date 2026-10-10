import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type Stripe from "stripe";

import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { campaigns, subscriptions } from "@mi-pasaporte/db/schema";
import { integrationEnabled } from "./locations-integration-support";
import { seedWelcomeCampaign } from "./marketing-welcome-support";
import {
  campaignWorld,
  dropCampaignWorlds,
} from "./marketing-campaigns-support";
import { runBillingSweep } from "./marketing/billing-sweep";
import { applySubscriptionState } from "./billing/store";

/**
 * Spec 0189 §D4 — H2 de la revisión (sonda del revisor convertida en test). Un comercio con la
 * prueba VENCIDA paga: el primer evento que se aplica trae la suscripción `incomplete` (el plan
 * todavía no se escribe; acceso `subscribed` con plan efectivo de FALLBACK) y el segundo,
 * `active` + `base`. La Bienvenida que el bloqueo pausó tiene que VOLVER al pagar.
 *
 * ORÁCULO DE LA MUTACIÓN MH2: sin la condición del fallback en `resumeCampaignsAfterBilling`,
 * el evento `incomplete` reescribe la Bienvenida como `plan_downgraded` y nunca vuelve.
 */
async function stateOf(id: string): Promise<string> {
  const [row] = await getDb()
    .select({ status: campaigns.status, reason: campaigns.pauseReason })
    .from(campaigns)
    .where(eq(campaigns.id, id));
  return `${row.status}/${row.reason}`;
}

describe.skipIf(!integrationEnabled)(
  "pagar devuelve las campañas aunque el primer evento sea `incomplete` (H2)",
  () => {
    afterAll(dropCampaignWorlds, 120_000);

    it("incomplete → la Bienvenida queda `billing_blocked`; active + base → vuelve", async () => {
      const seed = await campaignWorld("plus", "Incomplete antes de active");
      const welcome = await seedWelcomeCampaign(seed, {
        activatedAt: new Date(Date.now() - 86_400_000),
      });
      // Prueba vencida (la del mundo) y sin suscripción: BLOQUEADO.
      await getDb()
        .update(subscriptions)
        .set({
          plan: "trial",
          stripeSubscriptionId: null,
          status: "active",
          interval: null,
        })
        .where(eq(subscriptions.businessId, seed.business.id));
      expect(await runBillingSweep(new Date(), [seed.business.id])).toEqual({
        paused: 1,
        resumed: 0,
      });
      expect(await stateOf(welcome)).toBe("paused/billing_blocked");

      const subscription = {
        id: `sub_incomplete_${randomUUID().slice(0, 8)}`,
        customer: `cus_incomplete_${randomUUID().slice(0, 8)}`,
      } as Pick<Stripe.Subscription, "id" | "customer">;
      const quiet = {
        pendingPlan: null,
        pendingPlanAt: null,
        clearDowngradeRequest: false,
      };
      await withDbTransaction((tx) =>
        applySubscriptionState(tx, {
          businessId: seed.business.id,
          subscription,
          write: { ...quiet, status: "incomplete" },
          lastEventAt: null,
        }),
      );
      // El plan efectivo es el fallback: no se decide nada todavía.
      expect(await stateOf(welcome)).toBe("paused/billing_blocked");

      await withDbTransaction((tx) =>
        applySubscriptionState(tx, {
          businessId: seed.business.id,
          subscription,
          write: {
            ...quiet,
            status: "active",
            plan: "base",
            interval: "month",
          },
          lastEventAt: null,
        }),
      );
      expect(await stateOf(welcome)).toBe("active/null");
      // Y el barrido no tiene nada más que hacer.
      expect(await runBillingSweep(new Date(), [seed.business.id])).toEqual({
        paused: 0,
        resumed: 0,
      });
    }, 120_000);
  },
);
