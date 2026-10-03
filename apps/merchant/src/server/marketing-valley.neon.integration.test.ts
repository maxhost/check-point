import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { campaignKindEnabled } from "@mi-pasaporte/domain/server/marketing/enabled-campaigns";
import { integrationEnabled } from "./locations-integration-support";
import { seedConsumer } from "./counter-integration-support";
import { seedMembership } from "./marketing-integration-support";
import { getDb } from "@mi-pasaporte/db";
import { businesses, orders, valleyDetections } from "@mi-pasaporte/db/schema";
import { runMarketingTick } from "./marketing/tick";
import {
  clearMerchantWindows,
  listValleyLocations,
  replaceMerchantWindows,
} from "./marketing/valley-windows";
import { putLocationHours } from "./locations";
import {
  campaignWorld as world,
  caughtCampaignError as caught,
  dropCampaignWorlds,
} from "./marketing-campaigns-support";
import type { Seed } from "./counter-integration-support";

/**
 * Spec 0113 — the merchant's side against a real base: the windows API (H2) and the tick's
 * detection (the migration and `enable` are in `marketing-valley-enable…`). Every state is
 * READ BY SQL.
 * ORACULO DE M9: a location with the merchant's own window, and 8 weeks of scans that make
 * the network propose ANOTHER one — after the tick the merchant's is still there and rules.
 */

afterAll(dropCampaignWorlds, 120_000);

const BA = "America/Argentina/Buenos_Aires";
/** Tuesday 2026-10-06 09:00 in Buenos Aires: the 8 weeks are 2026-08-11 … 2026-10-05. */
const NOW = new Date("2026-10-06T09:00:00-03:00");
const NS = "valley-tick";

async function valleyWorld(label: string): Promise<Seed> {
  const seed = await world("plus", label);
  await getDb()
    .update(businesses)
    .set({ timezone: BA })
    .where(eq(businesses.id, seed.business.id));
  return seed;
}

/**
 * 8 Tuesdays of scans at the location, Buenos Aires wall clock: 10:00 and 11:00 busy (10
 * each), 12:00 almost empty (1). 21 a week → 168 in total (≥ 150). With no hours loaded
 * (V3) the open hours are 10, 11, 12 → the median is 10 → 12:00 is slack in 8 of 8 weeks.
 */
async function seedTuesdays(seed: Seed): Promise<void> {
  const consumer = await seedConsumer();
  const membershipId = await seedMembership({
    consumerId: consumer.id,
    programId: seed.programId,
    businessId: seed.business.id,
  });
  const rows = [];
  for (let week = 0; week < 8; week += 1) {
    const day = new Date(Date.UTC(2026, 7, 11 + week * 7))
      .toISOString()
      .slice(0, 10);
    for (const [hour, count] of [
      [10, 10],
      [11, 10],
      [12, 1],
    ] as const)
      for (let i = 0; i < count; i += 1)
        rows.push({
          businessId: seed.business.id,
          locationId: seed.locationId,
          programId: seed.programId,
          membershipId,
          consumerId: consumer.id,
          mode: "quick",
          total: "10.00",
          currencyCode: "USD",
          accrualKind: "points",
          unitsGranted: 1,
          balanceAfter: 1,
          createdByUserId: seed.userId,
          clientRequestId: randomUUID(),
          createdAt: new Date(
            `${day}T${String(hour).padStart(2, "0")}:${String(i * 5).padStart(2, "0")}:00-03:00`,
          ),
        });
  }
  await getDb().insert(orders).values(rows);
}

const tick = (seed: Seed) =>
  runMarketingTick({
    now: NOW,
    random: () => 1,
    lockNamespace: NS,
    businessIds: [seed.business.id],
  });

async function detectionOf(locationId: string) {
  const [row] = await getDb()
    .select()
    .from(valleyDetections)
    .where(eq(valleyDetections.locationId, locationId));
  return row ?? null;
}

describe.skipIf(!integrationEnabled || !campaignKindEnabled("valley"))(
  "valley — merchant side and migration 0058",
  () => {
    it("the windows API: [] is 400, a foreign location 404, PUT rules, DELETE goes back to the network", async () => {
      const seed = await valleyWorld("Valle ventanas");
      const foreign = await valleyWorld("Valle ajeno");
      const empty = await caught(() =>
        replaceMerchantWindows(
          seed.business.id,
          seed.locationId,
          { windows: [] },
          NOW,
        ),
      );
      expect(empty).toMatchObject({
        status: 400,
        fields: { windows: expect.any(String) },
      });
      for (const id of [foreign.locationId, "not-a-uuid"])
        expect(
          await caught(() =>
            replaceMerchantWindows(seed.business.id, id, {
              windows: [{ weekday: 2, startHour: 15, endHour: 17 }],
            }),
          ),
        ).toMatchObject({ status: 404 });
      expect(
        await caught(() =>
          clearMerchantWindows(seed.business.id, foreign.locationId),
        ),
      ).toMatchObject({ status: 404 });

      const view = await replaceMerchantWindows(
        seed.business.id,
        seed.locationId,
        { windows: [{ weekday: 2, startHour: 15, endHour: 17 }] },
        NOW,
      );
      expect(view).toMatchObject({
        locationId: seed.locationId,
        hoursSet: false,
        detection: null,
        networkWindows: [],
        merchantWindows: [{ weekday: 2, startHour: 15, endHour: 17 }],
        effective: "merchant",
      });
      expect(view.heatmap).toHaveLength(7);
      expect(view.heatmap.every((row) => row.length === 24)).toBe(true);
      await clearMerchantWindows(seed.business.id, seed.locationId);
      const [after] = await listValleyLocations(seed.business.id, NOW);
      expect(after).toMatchObject({
        merchantWindows: [],
        effective: "network",
      });
      // The foreign business's locations never appear in the caller's list.
      expect(
        (await listValleyLocations(seed.business.id, NOW)).map(
          (l) => l.locationId,
        ),
      ).toEqual([seed.locationId]);
    }, 180_000);

    it("ORACULO DE M9 — the tick proposes the network's window and leaves the merchant's in place, ruling", async () => {
      const seed = await valleyWorld("Valle tick");
      await seedTuesdays(seed);
      await replaceMerchantWindows(
        seed.business.id,
        seed.locationId,
        { windows: [{ weekday: 2, startHour: 15, endHour: 17 }] },
        NOW,
      );
      await tick(seed);
      const [view] = await listValleyLocations(seed.business.id, NOW);
      expect(view).toMatchObject({
        detection: { status: "proposed", scans: 168 },
        networkWindows: [{ weekday: 2, startHour: 12, endHour: 13 }],
        merchantWindows: [{ weekday: 2, startHour: 15, endHour: 17 }],
        effective: "merchant",
        hoursSet: false,
      });
      expect(view.heatmap[1].slice(9, 14)).toEqual([0, 80, 80, 8, 0]);
      expect(
        (await detectionOf(seed.locationId))?.computedAt.toISOString(),
      ).toBe(NOW.toISOString());
    }, 180_000);

    it("V4 — the tick recomputes only a stale detection: new opening hours bump hours_version and it runs again", async () => {
      const seed = await valleyWorld("Valle horario");
      await seedTuesdays(seed);
      await tick(seed);
      const first = await detectionOf(seed.locationId);
      expect(first).toMatchObject({ status: "proposed", hoursVersion: 0 });
      // Nothing changed: a tick an hour later leaves the row as it was.
      await runMarketingTick({
        now: new Date(NOW.getTime() + 3_600_000),
        random: () => 1,
        lockNamespace: NS,
        businessIds: [seed.business.id],
      });
      expect(
        (await detectionOf(seed.locationId))?.computedAt.toISOString(),
      ).toBe(NOW.toISOString());
      const put = await putLocationHours(
        { id: seed.business.id },
        seed.locationId,
        {
          days: Array.from({ length: 7 }, (_, i) => ({
            weekday: i + 1,
            ranges: i === 1 ? [{ opens: "10:00", closes: "13:00" }] : [],
          })),
        },
      );
      expect(put.ok).toBe(true);
      const later = new Date(NOW.getTime() + 7_200_000);
      await runMarketingTick({
        now: later,
        random: () => 1,
        lockNamespace: NS,
        businessIds: [seed.business.id],
      });
      const again = await detectionOf(seed.locationId);
      expect(again).toMatchObject({ status: "proposed", hoursVersion: 1 });
      expect(again?.computedAt.toISOString()).toBe(later.toISOString());
      const [view] = await listValleyLocations(seed.business.id, later);
      expect(view).toMatchObject({
        hoursSet: true,
        networkWindows: [{ weekday: 2, startHour: 12, endHour: 13 }],
      });
    }, 180_000);
  },
);
