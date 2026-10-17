import { assertSnapshotEquivalence } from "./snapshot-equivalence.test-support";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  analyticsCardCandidates as candidates,
  analyticsDailyGauges as gauges,
  analyticsDailyMetrics as metrics,
  businesses,
  locations,
} from "@mi-pasaporte/db/schema";
import {
  permisosIntegrationEnabled,
  seedOwnerDeNegocio,
  cookieDe,
  limpiarNegocios,
  conCookie,
} from "../../permissions-integration-support";
import { addDays, localDay } from "@mi-pasaporte/domain/analytics/date";
import type { AnalyticsFact } from "@mi-pasaporte/domain/analytics/metrics";
import { evaluateAnalyticsFacts, evaluateBusiness, actOnCard } from "./index";
import { readHistory, readInput } from "../queries";
import { historyGET } from "../http";
const business = randomUUID(),
  otherBusiness = randomUUID(),
  owner = randomUUID(),
  otherOwner = randomUUID(),
  center = randomUUID(),
  north = randomUUID(),
  foreign = randomUUID(),
  item = randomUUID(),
  product = randomUUID();
const now = new Date(),
  today = localDay(now, "America/Guayaquil");
let cookie = "",
  otherCookie = "";
const costFact = (
  occurredAt = `${today}T12:00:00Z`,
  delta = "1.680000",
): AnalyticsFact => ({
  kind: "unit_cost_change",
  occurredAt,
  locationId: center,
  itemId: item,
  itemLabel: "Harina",
  itemUnit: "kg",
  itemUnitCostBefore: "1",
  itemUnitCostAfter: "1.05",
  productId: product,
  productLabel: "Muzza",
  unitCostBefore: "1.5",
  unitCostAfter: delta,
  currencyCode: "USD",
  minorUnit: 2,
});
const countFact = (): AnalyticsFact => ({
  kind: "count_gap",
  occurredAt: `${today}T12:00:00Z`,
  locationId: center,
  itemId: item,
  itemLabel: "Harina",
  itemUnit: "kg",
  quantity: "-3",
  amountMinor: "-300",
  currencyCode: "USD",
  minorUnit: 2,
  actionHref: "/backoffice/sample?movementId=count",
});
const saved = (day: string, key: string) =>
  getDb()
    .select()
    .from(candidates)
    .where(
      and(
        eq(candidates.businessId, business),
        eq(candidates.day, day),
        eq(candidates.cardKey, key),
      ),
    );

describe.skipIf(!permisosIntegrationEnabled)(
  "AN-2 persisted facts, stock summaries and history boundaries",
  () => {
    beforeAll(async () => {
      await seedOwnerDeNegocio(owner, business, `an2-product-${business}`);
      await seedOwnerDeNegocio(
        otherOwner,
        otherBusiness,
        `an2-other-${otherBusiness}`,
      );
      await getDb()
        .update(businesses)
        .set({ timezone: "America/Guayaquil" })
        .where(eq(businesses.id, business));
      await getDb()
        .insert(locations)
        .values([
          {
            id: center,
            businessId: business,
            name: "Centro",
            addressLabel: "Centro",
            countryCode: "EC",
            addressSnapshot: {},
          },
          {
            id: north,
            businessId: business,
            name: "Norte",
            addressLabel: "Norte",
            countryCode: "EC",
            addressSnapshot: {},
          },
          {
            id: foreign,
            businessId: otherBusiness,
            name: "Otro",
            addressLabel: "Otro",
            countryCode: "EC",
            addressSnapshot: {},
          },
        ]);
      const base = {
        businessId: business,
        locationId: center,
        dimensionKind: "item",
        dimensionId: item,
      };
      await getDb()
        .insert(metrics)
        .values([
          ...Array.from({ length: 28 }, (_, i) => ({
            ...base,
            metric: "stock_consumption",
            day: addDays(today, -i - 1),
            quantity: "10",
          })),
          {
            ...base,
            metric: "stock_consumption",
            day: addDays(today, -40),
            quantity: "10",
          },
          {
            ...base,
            dimensionKind: "none",
            dimensionId: null,
            metric: "revenue",
            day: addDays(today, -1),
            amountMinor: 10000n,
            currencyCode: "USD",
            minorUnit: 2,
            count: 100,
          },
          {
            ...base,
            dimensionKind: "product",
            dimensionId: product,
            metric: "units_sold",
            day: addDays(today, -1),
            quantity: "200",
          },
          {
            ...base,
            locationId: north,
            dimensionKind: "product",
            dimensionId: product,
            metric: "units_sold",
            day: addDays(today, -1),
            quantity: "900",
          },
        ]);
      await getDb()
        .insert(gauges)
        .values([
          ...[
            [40, "100"],
            [20, "110"],
            [10, "121"],
          ].map(([age, amount]) => ({
            ...base,
            metric: "stock_unit_cost",
            day: addDays(today, -Number(age)),
            amountMinor: String(amount),
            currencyCode: "USD",
            minorUnit: 2,
            unit: "kg",
            observedAt: new Date(`${addDays(today, -Number(age))}T12:00:00Z`),
            eventId: randomUUID(),
          })),
          {
            ...base,
            metric: "stock_on_hand",
            day: addDays(today, -1),
            quantity: "20",
            unit: "kg",
            observedAt: new Date(`${addDays(today, -1)}T12:00:00Z`),
            eventId: randomUUID(),
          },
          {
            ...base,
            locationId: north,
            metric: "stock_on_hand",
            day: addDays(today, -1),
            quantity: "3",
            unit: "kg",
            observedAt: new Date(`${addDays(today, -1)}T12:00:00Z`),
            eventId: randomUUID(),
          },
        ]);
      cookie = await cookieDe(owner);
      otherCookie = await cookieDe(otherOwner);
    }, 120000);
    afterAll(async () => {
      await limpiarNegocios([business, otherBusiness], [owner, otherOwner]);
    }, 120000);
    it("keeps local consumption history and exact gauges, returns stock HTTP with tenant guards", async () => {
      const input = await readInput(business, now);
      await assertSnapshotEquivalence(business, now);
      await assertSnapshotEquivalence(business, now, center);
      expect(input.firstConsumptionDays).toContainEqual({
        locationId: center,
        itemId: item,
        day: addDays(today, -40),
      });
      expect(
        input.metrics
          .filter((r) => r.metric === "units_sold")
          .map((r) => r.locationId),
      ).toEqual(expect.arrayContaining([center, north]));
      expect(
        input.gauges?.find((g) => g.metric === "stock_unit_cost")?.amountMinor,
      ).toBe("121");
      expect(
        (await readHistory(business, "3m", center, now)).stock,
      ).toMatchObject({
        valueMinor: 2420,
        valuedItems: 1,
        unvaluedItems: 0,
        increaseDays: 2,
        averageDaysBetweenIncreases: 10,
      });
      expect(
        (await readHistory(business, "3m", undefined, now)).stock,
      ).toMatchObject({
        valueMinor: null,
        knownValueMinor: 2420,
        unvaluedItems: 1,
      });
      expect(
        (await readHistory(business, "3m", center, now)).stock.averageIncrease,
      ).toBeCloseTo(0.21);
      const response = await historyGET(
        conCookie(
          `/api/analytics/history?period=3m&locationId=${center}`,
          "GET",
          cookie,
        ),
      );
      expect(response.status).toBe(200);
      expect((await response.json()).stock.valueMinor).toBe(2420);
      expect(
        (
          await historyGET(
            conCookie(
              `/api/analytics/history?period=3m&locationId=${center}`,
              "GET",
              otherCookie,
            ),
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await historyGET(
            new Request("http://localhost/api/analytics/history"),
          )
        ).status,
      ).toBe(401);
    }, 30000);
    it("rolls facts back atomically, adds them after the daily run, and retains newest across delivery days", async () => {
      await expect(
        withDbTransaction(async (tx) => {
          await evaluateAnalyticsFacts(tx, {
            businessId: business,
            eventId: randomUUID(),
            capturedAt: now.toISOString(),
            facts: [costFact(), countFact()],
            now,
          });
          throw new Error("rollback facts");
        }),
      ).rejects.toThrow("rollback facts");
      expect(await saved(today, "5")).toHaveLength(0);
      await evaluateBusiness(business, now);
      expect(await saved(today, "8")).toHaveLength(1);
      const eventId = randomUUID();
      await withDbTransaction((tx) =>
        evaluateAnalyticsFacts(tx, {
          businessId: business,
          eventId,
          capturedAt: now.toISOString(),
          facts: [costFact(), countFact()],
          now,
        }),
      );
      await withDbTransaction((tx) =>
        evaluateAnalyticsFacts(tx, {
          businessId: business,
          eventId,
          capturedAt: now.toISOString(),
          facts: [costFact(), countFact()],
          now,
        }),
      );
      const [original] = await saved(today, "5");
      expect(original?.amountMinor).toBe(900n);
      expect(await saved(today, "5")).toHaveLength(1);
      expect(await saved(today, "9")).toHaveLength(1);
      const nextNow = new Date(now.getTime() + 86400000),
        nextDay = addDays(today, 1);
      await withDbTransaction((tx) =>
        evaluateAnalyticsFacts(tx, {
          businessId: business,
          eventId: randomUUID(),
          capturedAt: nextNow.toISOString(),
          facts: [costFact(`${addDays(today, -1)}T12:00:00Z`, "2")],
          now: nextNow,
        }),
      );
      expect(await saved(nextDay, "5")).toHaveLength(0);
      await evaluateBusiness(business, nextNow);
      const [carried] = await saved(nextDay, "5");
      expect(carried?.amountMinor).toBe(900n);
      expect(Number(carried?.weight)).toBeCloseTo(
        Number(original?.weight) * 0.7,
      );
      expect((carried?.parameters as { originDay: string }).originDay).toBe(
        today,
      );
    }, 30000);
    it("accepts or dismisses only this tenant's current visible fact and preserves suppression tomorrow", async () => {
      const [count] = await saved(today, "9");
      expect(count).toBeDefined();
      await expect(
        actOnCard(
          otherBusiness,
          otherOwner,
          count!.id,
          "dismissed",
          { role: "owner", permissions: [] },
          now,
        ),
      ).rejects.toMatchObject({ code: "card_not_found" });
      await actOnCard(
        business,
        owner,
        count!.id,
        "dismissed",
        { role: "owner", permissions: [] },
        now,
      );
      const future = new Date(now.getTime() + 2 * 86400000);
      await evaluateBusiness(business, future);
      expect(Number((await saved(addDays(today, 2), "9"))[0]?.weight)).toBe(0);
    }, 30000);
  },
);
