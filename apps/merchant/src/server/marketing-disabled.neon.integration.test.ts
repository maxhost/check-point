import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  integrationEnabled,
  seedConsumer,
} from "./counter-integration-support";
import {
  NEAR,
  seedCampaign,
  seedLocation,
  seedMembership,
  seedTurn,
  seedWalletPass,
} from "./marketing-integration-support";
import { dropCampaigns } from "./marketing-read-support";
import { seedPushCampaign, seedWebPush } from "./marketing-push-support";
import {
  campaignBody,
  campaignWorlds,
  campaignWorld as world,
  caughtCampaignError as caught,
  dropCampaignWorlds,
} from "./marketing-campaigns-support";
import { getDb } from "@mi-pasaporte/db";
import {
  campaignPushes,
  campaignTurns,
  campaigns,
  passPlacements,
  valleyDetections,
} from "@mi-pasaporte/db/schema";
import {
  createCampaign,
  getCampaign,
  listCampaigns,
} from "./marketing/campaign-store";
import { enableTemplate, listTemplates } from "./marketing/template-store";
import { runMarketingTick } from "./marketing/tick";

/**
 * Spec 0138 / ADR 0115 — LO APAGADO, contra una base real y con el módulo REAL
 * (`enabled-campaigns.ts`, sin mock): solo `welcome` y `cross` existen, el compositor y el
 * paso 4 no corren. Cada caso se lee por SQL o por el status del `CampaignError` (el que la
 * ruta traduce a HTTP). Los negocios son **Plus**: el freno de plan (402, el guard hermano)
 * no puede cortar antes que el chequeo de encendido. Oráculos de M1–M8 de la spec; el de M9
 * (valle en «Mis beneficios») y la API de valle están en `marketing-disabled-valley…`.
 */

afterAll(async () => {
  // Turns, pushes and placements first (FK order), then the businesses.
  for (const id of campaignWorlds) await dropCampaigns(id);
  await dropCampaignWorlds();
}, 180_000);

const DAY = 86_400_000;
const NOW = new Date("2026-09-16T12:00:00.000Z");
const NS = "marketing_tick_test_disabled";

const campaignCount = async (businessId: string) =>
  (
    await getDb()
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.businessId, businessId))
  ).length;

describe.skipIf(!integrationEnabled)("spec 0138 — la API del merchant", () => {
  it("ORACULO DE M1 — GET templates lista exactamente welcome y cross", async () => {
    const seed = await world("plus", "Apagadas catalogo");
    expect((await listTemplates(seed.business.id)).map((t) => t.key)).toEqual([
      "welcome",
      "cross",
    ]);
  }, 120_000);

  it("ORACULO DE M2 — enable de missed_you en un Plus es 404 not_found y no crea filas", async () => {
    const seed = await world("plus", "Apagadas enable");
    const error = await caught(() =>
      enableTemplate(seed.business.id, seed.userId, "missed_you", {}, NOW),
    );
    expect(error).toMatchObject({ status: 404, code: "not_found" });
    expect(await campaignCount(seed.business.id)).toBe(0);
  }, 120_000);

  it("ORACULO DE M3 — POST campaigns (compositor) en un Plus es 409 campaign_disabled y no crea filas", async () => {
    const seed = await world("plus", "Apagadas compositor");
    const error = await caught(() =>
      createCampaign(seed.business.id, seed.userId, campaignBody(seed)),
    );
    expect(error).toMatchObject({
      status: 409,
      code: "campaign_disabled",
      message: "Esta campaña no está disponible por ahora.",
    });
    expect(await campaignCount(seed.business.id)).toBe(0);
  }, 120_000);

  it("ORACULOS DE M4 y M5 — una compositor `active` no se lista y por id es 404", async () => {
    const seed = await world("plus", "Apagadas por id");
    const id = await seedCampaign({
      businessId: seed.business.id,
      createdByUserId: seed.userId,
      locationIds: [seed.locationId],
    });
    expect(await campaignCount(seed.business.id)).toBe(1);
    expect(
      (await listCampaigns(seed.business.id)).map((c) => c.id),
    ).not.toContain(id);
    expect(await caught(() => getCampaign(seed.business.id, id))).toMatchObject(
      { status: 404, code: "not_found" },
    );
  }, 120_000);
});

describe.skipIf(!integrationEnabled)("spec 0138 — el tick", () => {
  it("ORACULOS DE M6, M7 y M8 — ni turnos, ni push, ni paso 4; la detección de valle vieja queda", async () => {
    const seed = await world("plus", "Apagadas tick");
    const door = await seedLocation({ businessId: seed.business.id, ...NEAR });
    const dormant = async () => {
      const consumer = await seedConsumer();
      const membershipId = await seedMembership({
        consumerId: consumer.id,
        programId: seed.programId,
        businessId: seed.business.id,
        enrolledAt: new Date(NOW.getTime() - 400 * DAY),
      });
      await seedWalletPass(consumer.id);
      return { consumerId: consumer.id, membershipId };
    };
    // Paso 1: una compositor `active` con su puerta y un dormido con pase.
    const composer = await seedCampaign({
      businessId: seed.business.id,
      createdByUserId: seed.userId,
      locationIds: [door],
    });
    const forComposer = await dormant();
    // Paso 1b: una `missed_you` `active` por push y otro dormido alcanzable.
    await seedPushCampaign({
      businessId: seed.business.id,
      userId: seed.userId,
      templateKey: "missed_you",
      dormantDays: 30,
    });
    const forPush = await dormant();
    // Reachable by push: an Apple pass alone is not (it needs a registered device).
    await seedWebPush(forPush.consumerId);
    // Paso 4: un consumidor con turno vivo y una fila de `pass_placement` que el
    // planificador reescribiría (no lleva el turno).
    const placed = await dormant();
    await seedTurn({
      campaignId: composer,
      businessId: seed.business.id,
      consumerId: placed.consumerId,
      membershipId: placed.membershipId,
      locationId: door,
      status: "active",
      windowStart: new Date(NOW.getTime() - DAY),
      windowEnd: new Date(NOW.getTime() + 5 * DAY),
      messageSnapshot: "2x1 en picadas",
    });
    await getDb()
      .insert(passPlacements)
      .values({
        consumerId: placed.consumerId,
        locationId: door,
        slotKind: "turn",
        businessId: seed.business.id,
        relevantText: "texto viejo",
        computedAt: new Date(NOW.getTime() - 3 * DAY),
      });
    // Valle: una detección vieja (> 7 días) de la puerta.
    const staleAt = new Date(NOW.getTime() - 30 * DAY);
    await getDb().insert(valleyDetections).values({
      locationId: door,
      computedAt: staleAt,
      status: "none",
      scans: 0,
      hoursVersion: 0,
    });
    const placement = () =>
      getDb()
        .select()
        .from(passPlacements)
        .where(eq(passPlacements.consumerId, placed.consumerId));
    const before = await placement();

    const summary = await runMarketingTick({
      now: NOW,
      random: () => 1,
      lockNamespace: NS,
      businessIds: [seed.business.id],
      consumerIds: [forComposer, forPush, placed].map((p) => p.consumerId),
    });

    const turns = await getDb()
      .select({ id: campaignTurns.id })
      .from(campaignTurns)
      .where(eq(campaignTurns.businessId, seed.business.id));
    const pushes = await getDb()
      .select({ id: campaignPushes.id })
      .from(campaignPushes)
      .where(eq(campaignPushes.businessId, seed.business.id));
    const [detection] = await getDb()
      .select({ computedAt: valleyDetections.computedAt })
      .from(valleyDetections)
      .where(eq(valleyDetections.locationId, door));
    expect({
      turns: turns.length,
      pushes: pushes.length,
      consumers: (summary as { consumers: number }).consumers,
      detection: detection.computedAt.toISOString(),
    }).toEqual({
      turns: 1, // el sembrado, ninguno nuevo
      pushes: 0,
      consumers: 0,
      detection: staleAt.toISOString(),
    });
    expect(summary).toMatchObject({
      campaigns: 0,
      enqueued: 0,
      activated: 0,
      holdouts: 0,
      refreshes: 0,
      pushDecided: 0,
    });
    expect(await placement()).toEqual(before);
  }, 180_000);
});
