import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import {
  analyticsDailyGauges as gauges,
  analyticsDimensionLabels as labels,
  locations,
} from "@mi-pasaporte/db/schema";
import {
  permisosIntegrationEnabled,
  seedOwnerDeNegocio,
  limpiarNegocios,
} from "../../permissions-integration-support";
import { readHistory } from "./index";

// Observe real executions without replacing SQL, rows, fixtures or the Neon transport.
const observed = vi.hoisted(() => ({
  executions: [] as { mock: { calls: unknown[][] } }[],
}));
vi.mock("@mi-pasaporte/db", async (original) => {
  const actual = await original<typeof import("@mi-pasaporte/db")>();
  return {
    ...actual,
    getDb: () => {
      const db = actual.getDb();
      observed.executions.push(vi.spyOn(db, "execute"));
      return db;
    },
  };
});
const business = randomUUID(),
  otherBusiness = randomUUID(),
  owner = randomUUID(),
  otherOwner = randomUUID(),
  center = randomUUID(),
  north = randomUUID(),
  foreign = randomUUID(),
  flour = randomUUID(),
  unknown = randomUUID();
const now = new Date("2026-10-18T18:00:00Z");

describe.skipIf(!permisosIntegrationEnabled)(
  "stock cost history real tenant/local isolation",
  () => {
    beforeAll(async () => {
      await seedOwnerDeNegocio(owner, business, `cost-${business}`);
      await seedOwnerDeNegocio(
        otherOwner,
        otherBusiness,
        `cost-${otherBusiness}`,
      );
      await getDb()
        .insert(locations)
        .values(
          [
            { id: center, businessId: business, name: "Principal" },
            { id: north, businessId: business, name: "Norte" },
            { id: foreign, businessId: otherBusiness, name: "Privado" },
          ].map((row) => ({
            ...row,
            addressLabel: row.name,
            countryCode: "EC",
            addressSnapshot: {},
          })),
        );
      await getDb()
        .insert(labels)
        .values([
          {
            businessId: business,
            kind: "item",
            id: flour,
            label: "Harina",
            updatedAt: now,
          },
          {
            businessId: otherBusiness,
            kind: "item",
            id: flour,
            label: "Secreto ajeno",
            updatedAt: now,
          },
        ]);
      const base = {
        businessId: business,
        locationId: center,
        metric: "stock_unit_cost",
        dimensionKind: "item",
        dimensionId: flour,
        unit: "g",
        currencyCode: "USD",
        minorUnit: 2,
        quantity: "0",
      };
      const row = (
        day: string,
        amountMinor: string,
        patch: Partial<typeof base> = {},
      ) => ({
        ...base,
        day,
        amountMinor,
        observedAt: new Date(`${day}T12:00:00Z`),
        eventId: randomUUID(),
        ...patch,
      });
      await getDb()
        .insert(gauges)
        .values([
          row("2026-08-01", "0.05"),
          row("2026-09-29", "0.1"),
          row("2026-10-02", "0"),
          row("2026-10-17", "0.1234567890123456789"),
          row("2026-10-19", "999"),
          row("2026-10-03", "2", { locationId: north }),
          row("2026-10-04", "999", { currencyCode: "EUR" }),
          row("2026-10-05", "999", { minorUnit: 0 }),
          row("2026-10-06", "999", { unit: "m" }),
          row("2026-10-07", "-1", { dimensionId: unknown }),
          row("2026-10-08", "0", {
            dimensionId: unknown,
            metric: "stock_on_hand",
          }),
          row("2026-10-17", "999999", {
            businessId: otherBusiness,
            locationId: foreign,
          }),
        ]);
    }, 120_000);
    afterAll(async () => {
      await limpiarNegocios([business, otherBusiness], [owner, otherOwner]);
    }, 120_000);

    it("returns exact sparse costs and one real baseline with the existing five SQL executions", async () => {
      observed.executions.length = 0;
      const result = await readHistory(business, "month", center, now);
      expect(observed.executions.flatMap((s) => s.mock.calls)).toHaveLength(5);
      expect(result.stockCosts).toMatchObject({
        from: "2026-10-01",
        to: "2026-10-18",
        currencyCode: "USD",
        minorUnit: 2,
      });
      expect(result.stockCosts.series).toHaveLength(1);
      expect(result.stockCosts.series[0]).toMatchObject({
        itemId: flour,
        label: "Harina",
        locationId: center,
        locationName: "Principal",
        unit: "g",
        points: [
          { date: "2026-09-29", amountMinor: "0.1", isBaseline: true },
          { date: "2026-10-02", amountMinor: "0", isBaseline: false },
          {
            date: "2026-10-17",
            amountMinor: "0.1234567890123456789",
            isBaseline: false,
          },
        ],
      });
      expect(result.stockCosts.defaultSeriesId).toBe(
        result.stockCosts.series[0]?.id,
      );
      expect(JSON.stringify(result.stockCosts)).not.toContain("999");
    }, 30_000);
    it("keeps locals separate and rejects a location from another tenant before historical reads", async () => {
      const all = (await readHistory(business, "month", undefined, now))
        .stockCosts;
      expect(all.series.map((s) => s.locationId).sort()).toEqual(
        [center, north].sort(),
      );
      expect(all.series[0]?.locationId).toBe(center); // comparable before newer singleton
      const northOnly = (await readHistory(business, "month", north, now))
        .stockCosts;
      expect(northOnly.series).toHaveLength(1);
      expect(northOnly.series[0]?.points).toEqual([
        { date: "2026-10-03", amountMinor: "2", isBaseline: false },
      ]);
      expect(all.series.find((s) => s.locationId === north)?.id).toBe(
        northOnly.defaultSeriesId,
      );
      observed.executions.length = 0;
      await expect(
        readHistory(business, "month", foreign, now),
      ).rejects.toMatchObject({ status: 404, code: "location_not_found" });
      expect(observed.executions.flatMap((s) => s.mock.calls)).toHaveLength(1);
      expect(JSON.stringify(all)).not.toContain("Secreto ajeno");
      const other = (await readHistory(otherBusiness, "month", foreign, now))
        .stockCosts;
      expect(other.series).toHaveLength(1);
      expect(other.series[0]).toMatchObject({
        label: "Secreto ajeno",
        locationId: foreign,
        points: [
          { date: "2026-10-17", amountMinor: "999999", isBaseline: false },
        ],
      });
    }, 30_000);
    it("uses the selected multi-month range rather than truncating or inventing a monthly baseline", async () => {
      const history = (await readHistory(business, "3m", center, now))
        .stockCosts;
      expect(history.from).toBe("2026-08-01");
      expect(history.series[0]?.points[0]).toEqual({
        date: "2026-08-01",
        amountMinor: "0.05",
        isBaseline: false,
      });
      expect(history.series[0]?.points).toHaveLength(4);
    }, 30_000);
  },
);
