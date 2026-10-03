import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import { valleyWindows } from "@mi-pasaporte/db/schema";
import { integrationEnabled } from "./counter-integration-support";
import {
  base,
  crossConsumer,
  dropCrossWorlds,
  north,
} from "./consumer-cross-support";
import {
  TUESDAY,
  at,
  claimValley,
  listedBy,
  readValleyCoupons,
  setWindows,
  valleyBusiness,
  valleyCampaign,
  valleyOffersOf,
} from "./consumer-valley-support";
import { caughtCampaignError as caught } from "./marketing-campaigns-support";
import { claimCrossOffer } from "@mi-pasaporte/domain/server/consumer/cross-offers";
import {
  clearMerchantWindows,
  listValleyLocations,
  replaceMerchantWindows,
} from "./marketing/valley-windows";

/**
 * Spec 0138 / ADR 0115 — «Horas valle» APAGADO, contra una base real y con el módulo REAL
 * (`enabled-campaigns.ts`, sin mock). Separado de `marketing-disabled…` solo por tamaño.
 * Una campaña de valle `active` con su ventana abierta AHORA: «Mis beneficios» no la
 * ofrece, ninguno de los dos reclamos la emite (404, el mismo de una inexistente), y la API
 * de ventanas del merchant es 404 `not_found`. Oráculo de M9 de la spec.
 */

afterAll(dropCrossWorlds, 180_000);

describe.skipIf(!integrationEnabled)("spec 0138 — valle apagado", () => {
  it("ORACULO DE M9 — una oferta de valle abierta no se lista, y sus dos reclamos son 404 sin cupón", async () => {
    const here = base(61);
    const x = await valleyBusiness(
      "Valle apagado",
      `gcid:bar-apagado-${Date.now()}`,
      north(here, 300),
    );
    const campaignId = await valleyCampaign(x);
    await setWindows(x.seed.locationId, [
      { weekday: TUESDAY, startHour: 0, endHour: 24 },
    ]);
    const consumer = await crossConsumer();
    const now = at("12:00");

    expect(listedBy(await valleyOffersOf(consumer.id, here, now), x)).toEqual(
      [],
    );
    expect(
      await claimValley(consumer.id, campaignId, x.seed.locationId, here, now),
    ).toEqual({ status: 404 });
    // Sin `locationId` (el reclamo de la cruzada): 404, no el 400 que revelaría que existe.
    expect(await claimCrossOffer(consumer.id, campaignId, here, now)).toEqual({
      status: 404,
    });
    expect(await readValleyCoupons(campaignId)).toEqual([]);
  }, 180_000);

  it("la API de ventanas de valle del merchant es 404 not_found y no escribe", async () => {
    const x = await valleyBusiness(
      "Valle API apagada",
      `gcid:bar-api-${Date.now()}`,
      base(62),
    );
    const id = x.seed.business.id;
    const window = { windows: [{ weekday: 2, startHour: 15, endHour: 17 }] };
    for (const call of [
      () => listValleyLocations(id),
      () => replaceMerchantWindows(id, x.seed.locationId, window),
      () => clearMerchantWindows(id, x.seed.locationId),
    ])
      expect(await caught(call)).toMatchObject({
        status: 404,
        code: "not_found",
      });
    expect(
      await getDb()
        .select({ locationId: valleyWindows.locationId })
        .from(valleyWindows)
        .where(eq(valleyWindows.locationId, x.seed.locationId)),
    ).toEqual([]);
  }, 180_000);
});
