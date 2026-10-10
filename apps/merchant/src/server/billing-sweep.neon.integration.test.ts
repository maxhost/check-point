import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { integrationEnabled } from "./locations-integration-support";
import { seedCampaign } from "./marketing-integration-support";
import { seedWelcomeCampaign } from "./marketing-welcome-support";
import {
  campaignWorld,
  dropCampaignWorlds,
} from "./marketing-campaigns-support";
import { enableTemplate } from "./marketing/template-store";
import { runBillingSweep } from "./marketing/billing-sweep";
import { getDb } from "@mi-pasaporte/db";
import { campaigns, subscriptions } from "@mi-pasaporte/db/schema";
import { POST as SWEEP } from "../app/api/internal/billing-sweep/route";

/**
 * Spec 0189 §Plan de pruebas, T9 — EL BARRIDO DIARIO DE COBRO contra Postgres.
 *
 *  1. Sin acceso, con campañas `active` (Bienvenida incluida) → todas `billing_blocked`; una
 *     pausada por el OWNER queda igual.
 *  2. Recupera el acceso como `base` → la Bienvenida y la Venta cruzada vuelven; la que el base
 *     no incluye queda `paused` / `plan_downgraded` (el spec nombra «En riesgo»: hoy esa
 *     plantilla está apagada por el ADR 0115, así que el caso usa una campaña PROPIA —
 *     `template_key` NULL—, que el base tampoco incluye por la misma entrada del catálogo).
 *  3. Segunda corrida → `{paused: 0, resumed: 0}`.
 *
 * ORÁCULO DE M4 (la cruzada vuelve con `base`) y de M6 (la pausada por el owner no se toca).
 * El barrido va ACOTADO a este negocio: sin el recorte pausaría las campañas de otro archivo
 * que corre en paralelo sobre la misma rama.
 */
const GIFT = { couponLabel: "Un café gratis", couponCost: "1.20" };
const CROSS_GIFT = { ...GIFT, endsAt: "2099-12-31T00:00:00.000Z" };

async function states(ids: Record<string, string>) {
  const rows = await getDb()
    .select({
      id: campaigns.id,
      status: campaigns.status,
      reason: campaigns.pauseReason,
    })
    .from(campaigns)
    .where(inArray(campaigns.id, Object.values(ids)));
  const byId = new Map(
    rows.map((row) => [row.id, `${row.status}/${row.reason}`]),
  );
  return Object.fromEntries(
    Object.entries(ids).map(([name, id]) => [name, byId.get(id)]),
  );
}

describe.skipIf(!integrationEnabled)(
  "el barrido de cobro (spec 0189, T9)",
  () => {
    afterAll(dropCampaignWorlds, 120_000);
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("pausa sin acceso, reanuda con `base` lo que el base incluye, y es idempotente", async () => {
      const seed = await campaignWorld("base", "Barrido");
      const [row] = await getDb()
        .select({ id: subscriptions.stripeSubscriptionId })
        .from(subscriptions)
        .where(eq(subscriptions.businessId, seed.business.id));
      const ids = {
        welcome: await seedWelcomeCampaign(seed, {
          activatedAt: new Date(Date.now() - 86_400_000),
        }),
        cross: (
          await enableTemplate(
            seed.business.id,
            seed.userId,
            "cross",
            CROSS_GIFT,
          )
        ).id,
        custom: await seedCampaign({
          businessId: seed.business.id,
          createdByUserId: seed.userId,
          locationIds: [seed.locationId],
          status: "active",
        }),
        owner: await seedCampaign({
          businessId: seed.business.id,
          createdByUserId: seed.userId,
          locationIds: [seed.locationId],
          status: "paused",
          pauseReason: "owner",
        }),
      };
      const sweep = () => runBillingSweep(new Date(), [seed.business.id]);
      const where = eq(subscriptions.businessId, seed.business.id);

      // 1. La suscripción muere y la prueba ya venció: SIN acceso.
      await getDb()
        .update(subscriptions)
        .set({ stripeSubscriptionId: null })
        .where(where);
      expect(await sweep()).toEqual({ paused: 3, resumed: 0 });
      expect(await states(ids)).toEqual({
        welcome: "paused/billing_blocked",
        cross: "paused/billing_blocked",
        custom: "paused/billing_blocked",
        owner: "paused/owner",
      });

      // 2. Paga el plan BASE: vuelve lo que el base incluye.
      await getDb()
        .update(subscriptions)
        .set({ plan: "base", stripeSubscriptionId: row.id })
        .where(where);
      expect(await sweep()).toEqual({ paused: 0, resumed: 2 });
      expect(await states(ids)).toEqual({
        welcome: "active/null",
        cross: "active/null",
        custom: "paused/plan_downgraded",
        owner: "paused/owner",
      });

      // 3. Idempotente.
      expect(await sweep()).toEqual({ paused: 0, resumed: 0 });
    }, 120_000);

    it("una prueba EXTENDIDA a mano (sin webhook) devuelve las campañas en el barrido", async () => {
      const seed = await campaignWorld("plus", "Barrido extendido");
      const welcome = await seedWelcomeCampaign(seed, {
        activatedAt: new Date(Date.now() - 86_400_000),
      });
      const where = eq(subscriptions.businessId, seed.business.id);
      await getDb()
        .update(subscriptions)
        .set({ stripeSubscriptionId: null })
        .where(where);
      const sweep = () => runBillingSweep(new Date(), [seed.business.id]);
      expect(await sweep()).toEqual({ paused: 1, resumed: 0 });
      // `/extender-prueba`: solo mueve `trial_ends_at`.
      await getDb()
        .update(subscriptions)
        .set({ trialEndsAt: new Date(Date.now() + 7 * 86_400_000) })
        .where(where);
      expect(await sweep()).toEqual({ paused: 0, resumed: 1 });
      expect(await states({ welcome })).toEqual({ welcome: "active/null" });
    }, 120_000);

    it("la ruta exige `CRON_SECRET`: sin él, 401 y no barre nada", async () => {
      vi.stubEnv("CRON_SECRET", "secreto-de-prueba");
      const sinClave = await SWEEP(
        new Request("https://merchant.test/api/internal/billing-sweep", {
          method: "POST",
        }),
      );
      expect(sinClave.status).toBe(401);
      const otraClave = await SWEEP(
        new Request("https://merchant.test/api/internal/billing-sweep", {
          method: "POST",
          headers: { authorization: "Bearer otra" },
        }),
      );
      expect(otraClave.status).toBe(401);
    }, 60_000);
  },
);
