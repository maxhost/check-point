import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { seedConsumer } from "./counter-integration-support";
import { integrationEnabled } from "./locations-integration-support";
import { seedWelcomeCampaign } from "./marketing-welcome-support";
import {
  campaignWorld,
  dropCampaignWorlds,
} from "./marketing-campaigns-support";
import { enableTemplate } from "./marketing/template-store";
import { getDb } from "@mi-pasaporte/db";
import {
  consumerAccounts,
  programMemberships,
  subscriptions,
} from "@mi-pasaporte/db/schema";
import {
  enrollAccount,
  getEnrollLanding,
} from "@mi-pasaporte/domain/server/consumer/enrollment";
import { loadWelcomeCampaign } from "@mi-pasaporte/domain/server/marketing/welcome-store";
import { loadCrossCampaigns } from "@mi-pasaporte/domain/server/marketing/cross-store";
import type { Seed } from "./counter-integration-support";

/**
 * Spec 0189 §Plan de pruebas, T8 — LAS CONSULTAS DEL CONSUMIDOR Y DEL MARKETING frente al eje de
 * acceso (`accessSql` / `businessHasAccessSql`). Un comercio SIN ACCESO se comporta como uno
 * suspendido en estos puntos (ADR 0134 §7): no admite altas (404 `program_unavailable`), su
 * landing dice «no disponible» (`null`), su Bienvenida no se emite y su Venta cruzada no es
 * candidata. Con acceso, las cuatro andan. Mismo negocio, mismo estado del mundo, solo cambia
 * la suscripción.
 *
 * ORÁCULO DE M3: el alta llama a `enrollAccount`, cuyo ÚNICO filtro de acceso es el de
 * `loadEnrollableProgram` (la landing es otro camino, `enroll-landing.ts`).
 *
 * El GRANT del rol del cliente (`checkpass_consumer`, migración 0069) lo prueba la suite de
 * `apps/consumer` (`consumer-role…`), que corre la landing CON ese rol.
 */
const LIVE = { stripeSubscriptionId: "" };
const GIFT = { couponLabel: "Un café gratis", couponCost: "1.20" };
const CROSS_GIFT = { ...GIFT, endsAt: "2099-12-31T00:00:00.000Z" };

describe.skipIf(!integrationEnabled)(
  "consultas del consumidor y del marketing sin acceso (spec 0189, T8)",
  () => {
    let seed: Seed;
    let welcomeId: string;
    let crossId: string;
    const consumers: string[] = [];

    async function setAccess(on: boolean) {
      await getDb()
        .update(subscriptions)
        .set({ stripeSubscriptionId: on ? LIVE.stripeSubscriptionId : null })
        .where(eq(subscriptions.businessId, seed.business.id));
    }

    async function newConsumer(): Promise<string> {
      const { id } = await seedConsumer();
      consumers.push(id);
      return id;
    }

    beforeAll(async () => {
      // Un `plus` PAGANDO con la prueba vencida: el acceso lo da SOLO la suscripción, así que
      // apagarla deja al negocio bloqueado sin tocar nada más.
      seed = await campaignWorld("plus", "Acceso consumidor");
      const [row] = await getDb()
        .select({ id: subscriptions.stripeSubscriptionId })
        .from(subscriptions)
        .where(eq(subscriptions.businessId, seed.business.id));
      LIVE.stripeSubscriptionId = row.id ?? "";
      welcomeId = await seedWelcomeCampaign(seed, {
        activatedAt: new Date(Date.now() - 86_400_000),
      });
      crossId = (
        await enableTemplate(seed.business.id, seed.userId, "cross", CROSS_GIFT)
      ).id;
    }, 120_000);

    afterAll(async () => {
      await getDb()
        .delete(programMemberships)
        .where(eq(programMemberships.businessId, seed.business.id));
      for (const id of consumers) {
        await getDb()
          .delete(consumerAccounts)
          .where(eq(consumerAccounts.id, id));
      }
      await dropCampaignWorlds();
    }, 120_000);

    it("SIN acceso: alta 404, landing `null`, sin Bienvenida y la cruzada no es candidata", async () => {
      await setAccess(false);
      try {
        await expect(
          enrollAccount(seed.programId, await newConsumer()),
        ).rejects.toMatchObject({ status: 404, code: "program_unavailable" });
        expect(await getEnrollLanding(seed.programId)).toBeNull();
        expect(
          await loadWelcomeCampaign(getDb(), seed.business.id, new Date()),
        ).toBeNull();
        expect(await loadCrossCampaigns(getDb(), new Date(), crossId)).toEqual(
          [],
        );
      } finally {
        await setAccess(true);
      }
    }, 120_000);

    it("CON acceso: el alta entra, la landing existe, la Bienvenida y la cruzada están", async () => {
      const membership = await enrollAccount(
        seed.programId,
        await newConsumer(),
      );
      expect(membership).toMatchObject({ programId: seed.programId });
      expect(await getEnrollLanding(seed.programId)).toMatchObject({
        programId: seed.programId,
      });
      expect(
        await loadWelcomeCampaign(getDb(), seed.business.id, new Date()),
      ).toMatchObject({ id: welcomeId });
      expect(
        (await loadCrossCampaigns(getDb(), new Date(), crossId)).map(
          (campaign) => campaign.id,
        ),
      ).toEqual([crossId]);
    }, 120_000);
  },
);
