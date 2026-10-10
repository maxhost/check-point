import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./locations-integration-support";
import { seedCampaign } from "./marketing-integration-support";
import { seedWelcomeCampaign } from "./marketing-welcome-support";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { campaigns, subscriptions } from "@mi-pasaporte/db/schema";
import { loadWelcomeCampaign } from "@mi-pasaporte/domain/server/marketing/welcome-store";
import { transitionCampaign } from "./marketing/campaign-actions";
import {
  activeCampaignsOutsideBase,
  pauseCampaignsForBilling,
} from "./marketing/plan-brake";
import { enableTemplate } from "./marketing/template-store";
import {
  campaignWorld as world,
  caughtCampaignError as caught,
  dropCampaignWorlds,
} from "./marketing-campaigns-support";

/**
 * ADR 0112 + ADR 0134 §4/§7 — LA BIENVENIDA Y LA VENTA CRUZADA EN EL PLAN BASE, contra Postgres.
 * El base («sirven al comercio y a la red») activa, reanuda y entrega esas dos; cualquier otra
 * campaña —una propia, `template_key` NULL— recibe 402 en el MISMO negocio (el control). Y un
 * negocio SIN ACCESO (o sin fila de suscripción: fail-closed) no tiene ni la Bienvenida.
 * Todo estado se LEE POR SQL (ADR 0054).
 */

afterAll(dropCampaignWorlds, 120_000);

const GIFT = { couponLabel: "Un café gratis", couponCost: "1.20" };
/** Spec 0143 (owner, 2026-10-03: «Exigir fecha de fin»): enabling a cross campaign needs an end. */
const CROSS_GIFT = { ...GIFT, endsAt: "2099-12-31T00:00:00.000Z" };
const ON = new Date("2026-09-01T12:00:00.000Z");
const NOW = new Date("2026-10-02T15:00:00.000Z");

async function statusOf(id: string) {
  const [row] = await getDb()
    .select({ status: campaigns.status, pauseReason: campaigns.pauseReason })
    .from(campaigns)
    .where(eq(campaigns.id, id));
  return row;
}

/** Una campaña PROPIA (`template_key` NULL) pausada por el owner: la que el base no incluye. */
function customPaused(seed: Awaited<ReturnType<typeof world>>) {
  return seedCampaign({
    businessId: seed.business.id,
    createdByUserId: seed.userId,
    locationIds: [seed.locationId],
    status: "paused",
    pauseReason: "owner",
  });
}

describe.skipIf(!integrationEnabled)(
  "Bienvenida y Venta cruzada en el plan base (ADR 0134 §4)",
  () => {
    it("ORACULO DE M4 (activar): un negocio BASE activa la Bienvenida y la Venta cruzada; una propia es 402", async () => {
      const base = await world("base", "Base plantillas");
      const welcome = await enableTemplate(
        base.business.id,
        base.userId,
        "welcome",
        GIFT,
      );
      const cross = await enableTemplate(
        base.business.id,
        base.userId,
        "cross",
        CROSS_GIFT,
      );
      expect(await statusOf(welcome.id)).toEqual({
        status: "active",
        pauseReason: null,
      });
      expect(await statusOf(cross.id)).toEqual({
        status: "active",
        pauseReason: null,
      });

      const custom = await customPaused(base);
      expect(
        await caught(() =>
          transitionCampaign(base.business.id, custom, "activate"),
        ),
      ).toMatchObject({ status: 402, code: "plan_not_allowed" });
      expect(await statusOf(custom)).toMatchObject({ status: "paused" });
    }, 120_000);

    it("la entrega LEE la Bienvenida de un negocio base", async () => {
      const base = await world("base", "Base entrega");
      const id = await seedWelcomeCampaign(base, { activatedAt: ON });
      expect(await loadWelcomeCampaign(getDb(), base.business.id, NOW)).toEqual(
        expect.objectContaining({
          id,
          businessId: base.business.id,
          couponLabel: "Un café gratis",
          monthlyCap: 50,
        }),
      );
    }, 120_000);

    it("SIN fila de suscripción no hay Bienvenida: ni se activa (402) ni se entrega (fail-closed)", async () => {
      const bare = await world("base", "Sin fila");
      const id = await seedWelcomeCampaign(bare, { activatedAt: ON });
      await getDb()
        .delete(subscriptions)
        .where(eq(subscriptions.businessId, bare.business.id));
      expect(
        await caught(() =>
          enableTemplate(bare.business.id, bare.userId, "cross", CROSS_GIFT),
        ),
      ).toMatchObject({ status: 402, code: "plan_not_allowed" });
      expect(
        await loadWelcomeCampaign(getDb(), bare.business.id, NOW),
      ).toBeNull();
      expect(await statusOf(id)).toMatchObject({ status: "active" });
    }, 120_000);

    it("SIN ACCESO (sin suscripción viva, la prueba vencida) ni la cruzada ni la Bienvenida: 402", async () => {
      const blocked = await world("base", "Sin acceso");
      await getDb()
        .update(subscriptions)
        .set({ stripeSubscriptionId: null })
        .where(eq(subscriptions.businessId, blocked.business.id));
      for (const [key, gift] of [
        ["cross", CROSS_GIFT],
        ["welcome", GIFT],
      ] as const) {
        expect(
          await caught(() =>
            enableTemplate(blocked.business.id, blocked.userId, key, gift),
          ),
          key,
        ).toMatchObject({ status: 402, code: "plan_not_allowed" });
      }
      const live = await getDb()
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(eq(campaigns.businessId, blocked.business.id));
      expect(live).toEqual([]);
    }, 120_000);

    it("reanudar en base: la Bienvenida y la cruzada pausadas vuelven (200); una propia es 402", async () => {
      // Un plus que corría las tres y bajó a base: la forma que deja el cambio de plan.
      const seed = await world("plus", "Base reanudar");
      const welcome = await enableTemplate(
        seed.business.id,
        seed.userId,
        "welcome",
        GIFT,
      );
      const cross = await enableTemplate(
        seed.business.id,
        seed.userId,
        "cross",
        CROSS_GIFT,
      );
      const custom = await customPaused(seed);
      await transitionCampaign(seed.business.id, welcome.id, "pause");
      await transitionCampaign(seed.business.id, cross.id, "pause");
      await getDb()
        .update(subscriptions)
        .set({ plan: "base" })
        .where(eq(subscriptions.businessId, seed.business.id));

      for (const id of [welcome.id, cross.id]) {
        const resumed = await transitionCampaign(
          seed.business.id,
          id,
          "activate",
        );
        expect(resumed.campaign.status).toBe("active");
      }
      expect(
        await caught(() =>
          transitionCampaign(seed.business.id, custom, "activate"),
        ),
      ).toMatchObject({ status: 402, code: "plan_not_allowed" });
    }, 120_000);

    it("el conteo de la bajada a base NO cuenta Bienvenida ni cruzada; el bloqueo pausa TODAS", async () => {
      const seed = await world("plus", "Base conteo");
      const welcome = await seedWelcomeCampaign(seed, { activatedAt: ON });
      const custom = await seedCampaign({
        businessId: seed.business.id,
        createdByUserId: seed.userId,
        locationIds: [seed.locationId],
        status: "active",
      });
      const cross = await enableTemplate(
        seed.business.id,
        seed.userId,
        "cross",
        CROSS_GIFT,
      );

      const counted = await withDbTransaction((tx) =>
        activeCampaignsOutsideBase(tx, seed.business.id),
      );
      // Solo la propia (NULL key): `is null or not in`, no un `not in` pelado.
      expect(counted).toBe(1);

      const paused = await withDbTransaction((tx) =>
        pauseCampaignsForBilling(tx, seed.business.id, NOW),
      );
      expect(paused).toBe(3);
      const rows = await getDb()
        .select({ id: campaigns.id, reason: campaigns.pauseReason })
        .from(campaigns)
        .where(inArray(campaigns.id, [welcome, custom, cross.id]));
      expect(new Set(rows.map((row) => row.reason))).toEqual(
        new Set(["billing_blocked"]),
      );
    }, 120_000);
  },
);
