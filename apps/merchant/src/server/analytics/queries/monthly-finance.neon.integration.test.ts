import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import {
  analyticsDailyMetrics as metrics,
  analyticsDimensionLabels as labels,
  locations,
} from "@mi-pasaporte/db/schema";
import {
  permisosIntegrationEnabled,
  seedOwnerDeNegocio,
  limpiarNegocios,
  cookieDe,
  conCookie,
} from "../../permissions-integration-support";
import {
  calculateGoal,
  buildCandidates,
} from "@mi-pasaporte/domain/analytics/cards/index";
import { buildDashboardSummary } from "@mi-pasaporte/domain/analytics/dashboard-summary-calculation";
import { readHistory, readInput } from "./index";
import { salesBasis } from "@mi-pasaporte/domain/analytics/monthly-finance";
import { financialMetrics } from "@mi-pasaporte/domain/analytics/financial-metrics";
import { addDays } from "@mi-pasaporte/domain/analytics/date";
import { assertSnapshotEquivalence } from "../evaluation/snapshot-equivalence.test-support";
import { historyGET } from "../http";

const business = randomUUID(),
  otherBusiness = randomUUID(),
  owner = randomUUID(),
  otherOwner = randomUUID(),
  center = randomUUID(),
  north = randomUUID(),
  foreign = randomUUID(),
  product = randomUUID(),
  rent = randomUUID(),
  variable = randomUUID();
const now = new Date("2026-10-18T18:00:00Z");
let cookie = "",
  otherCookie = "";

describe.skipIf(!permisosIntegrationEnabled)(
  "monthly finance v2 real projected money isolation",
  () => {
    beforeAll(async () => {
      await seedOwnerDeNegocio(owner, business, `finance-${business}`);
      await seedOwnerDeNegocio(
        otherOwner,
        otherBusiness,
        `finance-${otherBusiness}`,
      );
      cookie = await cookieDe(owner);
      otherCookie = await cookieDe(otherOwner);
      await getDb()
        .insert(locations)
        .values(
          [
            { id: center, businessId: business, name: "Principal" },
            { id: north, businessId: business, name: "Norte" },
            { id: foreign, businessId: otherBusiness, name: "Ajeno" },
          ].map((r) => ({
            ...r,
            addressLabel: r.name,
            countryCode: "EC",
            addressSnapshot: {},
          })),
        );
      await getDb()
        .insert(labels)
        .values([
          {
            businessId: business,
            kind: "concept",
            id: rent,
            label: "Alquiler",
            updatedAt: now,
          },
          {
            businessId: otherBusiness,
            kind: "concept",
            id: rent,
            label: "Secreto ajeno",
            updatedAt: now,
          },
        ]);
      const money = (
        metric: string,
        amountMinor: bigint,
        day: string,
        dimensionId: string | null = null,
      ) => ({
        businessId: business,
        locationId: center,
        metric,
        amountMinor,
        day,
        dimensionKind: dimensionId
          ? metric.startsWith("expense_")
            ? "concept"
            : "product"
          : "none",
        dimensionId,
        currencyCode: "USD",
        minorUnit: 2,
        quantity: "0",
        count: metric === "payment_commission" ? 0 : 1,
      });
      const sale = (
        day: string,
        revenue: bigint,
        cost: bigint,
        locationId = center,
      ) =>
        [
          money("revenue", revenue, day),
          money("product_revenue", revenue, day, product),
          money("cost_of_goods", cost, day, product),
          money("revenue_with_cost", revenue, day, product),
          money("payment_commission", 0n, day),
          money("payment_commission_with_cost", 0n, day, product),
          ...["units_sold", "units_with_cost"].map((metric) => ({
            ...money(metric, 0n, day, product),
            quantity: "2",
            count: 0,
            currencyCode: "",
            minorUnit: 0,
          })),
        ].map((r) => ({ ...r, locationId }));
      const own = [
        money("expense_fixed", 45000n, "2026-09-01", rent),
        money("expense_fixed", 20000n, "2026-10-01", rent),
        money("expense_variable", 9000n, "2026-09-01", variable),
        money("expense_variable", 10000n, "2026-10-01", variable),
        ...sale("2026-09-25", 10000n, 5000n),
        ...sale("2026-10-18", 10000n, 4000n),
      ];
      await getDb()
        .insert(metrics)
        .values([
          ...own,
          ...own
            .filter((r) => r.currencyCode)
            .flatMap((r) => [
              { ...r, currencyCode: "MXN", amountMinor: 999999n },
              { ...r, minorUnit: 0, amountMinor: 888888n },
            ]),
          ...own.map((r) => ({
            ...r,
            businessId: otherBusiness,
            locationId: foreign,
          })),
          // North has missing known units, while Principal has an excess in the same product/day.
          // Totals alone would hide the local mismatch. readInput must preserve both segments.
          ...sale("2026-10-17", 10000n, 5000n, north).map((r) =>
            r.metric === "units_with_cost" ? { ...r, quantity: "1" } : r,
          ),
          ...sale("2026-10-17", 10000n, 5000n, center).map((r) =>
            r.metric === "units_with_cost" ? { ...r, quantity: "3" } : r,
          ),
        ]);
    }, 120_000);
    afterAll(async () => {
      await limpiarNegocios([business, otherBusiness], [owner, otherOwner]);
    }, 120_000);

    it("keeps tenant/local/currency/minor-unit isolated in history and rejects local cross-compensation", async () => {
      const input = await readInput(business, now);
      expect(
        input.metrics.filter(
          (r) => r.metric === "cost_of_goods" && r.day === "2026-09-25",
        ),
      ).toHaveLength(3); // projections retain foreign currencies segregated
      expect(
        input.metrics
          .filter((r) => r.metric === "cost_of_goods" && r.day === "2026-10-17")
          .every((r) => r.locationId === center || r.locationId === north),
      ).toBe(true);
      const all = await readHistory(business, "month", undefined, now);
      expect(all.goal.finance).toMatchObject({
        version: 2,
        status: "unavailable",
        reasons: ["sales_costs"],
        recordedExpensesMinor: 30000,
        forecastExpensesMinor: 55000,
        remainingSalesMinor: null,
      });
      expect(all).toMatchObject({
        fixedExpensesMinor: 20000,
        variableExpensesMinor: 10000,
        revenueMinor: 30000,
        costOfGoodsMinor: 14000,
        paymentCommissionMinor: 0,
      });
      expect(all.goal.breakEvenMinor).toBeNull();
      expect(all.goal.targetMinor).toBeNull();
      expect(calculateGoal(input).finance).toEqual(all.goal.finance);
      expect(buildCandidates(input).some((c) => c.cardKey === "3")).toBe(false);
      expect(buildDashboardSummary(input, now).unavailableReason).toBe(
        "cost_coverage",
      );
      const scoped = await readHistory(business, "month", north, now);
      expect(scoped.revenueMinor).toBe(10000);
      expect(scoped.goal.finance.reasons).toContain("sales_costs");
      await expect(
        readHistory(business, "month", foreign, now),
      ).rejects.toMatchObject({ status: 404, code: "location_not_found" });
      expect(JSON.stringify(all)).not.toContain("Secreto ajeno");
      const other = await readHistory(otherBusiness, "month", foreign, now);
      expect(other.goal.finance).toMatchObject({
        status: "estimated",
        recordedExpensesMinor: 30000,
        forecastExpensesMinor: 55000,
        monthContributionMinor: 6000,
        remainingSalesMinor: 98000,
        totalSalesTargetMinor: 108000,
      });
    }, 30_000);
    it("keeps monthly finance independent of period and exposes only the additive DTO through authenticated private HTTP", async () => {
      const month = await readHistory(otherBusiness, "month", foreign, now);
      expect(
        (await readHistory(otherBusiness, "3m", foreign, now)).goal.finance,
      ).toEqual(month.goal.finance);
      const response = await historyGET(
        conCookie(
          `/api/analytics/history?period=3m&locationId=${foreign}`,
          "GET",
          otherCookie,
        ),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      const body = await response.json();
      expect(body.goal.finance.version).toBe(2);
      expect(body.goal.finance.expenses).toHaveLength(2);
      expect(body.goal.finance.expenses[0].label).toBe("Secreto ajeno");
      expect(body.goal.finance).not.toHaveProperty("metrics");
      expect(body.goal.breakEvenMinor).toBe(
        body.goal.finance.totalSalesTargetMinor,
      );
      expect(
        (
          await historyGET(
            conCookie(
              `/api/analytics/history?locationId=${foreign}`,
              "GET",
              cookie,
            ),
          )
        ).status,
      ).toBe(404);
    }, 30_000);
  },
);

const exactBusiness = randomUUID(),
  exactOwner = randomUUID();
const exactLocals = Array.from({ length: 8 }, () => randomUUID());
const exactProduct = randomUUID(),
  extraProduct = randomUUID();
const grams = "453.59237000000001",
  lessGrams = "453.59237000000000";

describe.skipIf(!permisosIntegrationEnabled)(
  "exact mass reader and SQL segments",
  () => {
    beforeAll(async () => {
      await seedOwnerDeNegocio(
        exactOwner,
        exactBusiness,
        `exact-${exactBusiness}`,
      );
      await getDb()
        .insert(locations)
        .values(
          exactLocals.map((id, i) => ({
            id,
            businessId: exactBusiness,
            name: `Exact ${i}`,
            addressLabel: `Exact ${i}`,
            countryCode: "EC",
            addressSnapshot: {},
          })),
        );
      const fact = (
        metric: string,
        locationId: string,
        day: string,
        quantity = "0",
        amountMinor = 0n,
        dimensionId: string | null = exactProduct,
      ) => ({
        businessId: exactBusiness,
        locationId,
        day,
        metric,
        quantity,
        amountMinor,
        dimensionKind: dimensionId ? "product" : "none",
        dimensionId,
        currencyCode:
          metric.includes("sold") ||
          metric.includes("with_cost_g") ||
          metric === "units_with_cost"
            ? ""
            : "USD",
        minorUnit:
          metric.includes("sold") ||
          metric.includes("with_cost_g") ||
          metric === "units_with_cost"
            ? 0
            : 2,
        count: [
          "revenue",
          "product_revenue",
          "revenue_with_cost",
          "cost_of_goods",
          "payment_commission_with_cost",
        ].includes(metric)
          ? 1
          : 0,
      });
      const sale = (local: string, day: string) => [
        fact("revenue", local, day, "0", 10000n, null),
        fact("product_revenue", local, day, "0", 10000n),
        fact("revenue_with_cost", local, day, "0", 10000n),
        fact("cost_of_goods", local, day, "0", 4000n),
        fact("payment_commission", local, day, "0", 0n, null),
        fact("payment_commission_with_cost", local, day),
        fact("units_sold", local, day, "2"),
        fact("units_with_cost", local, day, "2"),
        fact("mass_sold_g", local, day, grams),
        fact("mass_with_cost_g", local, day, grams),
      ];
      const rows = exactLocals.slice(0, 7).flatMap((local, i) =>
        sale(local, "2026-10-16").map((r) => {
          if (i === 1 && r.metric === "mass_with_cost_g")
            return { ...r, quantity: lessGrams };
          if (i === 2 && r.metric === "units_with_cost")
            return { ...r, quantity: "1" };
          if (i === 2 && r.metric === "mass_with_cost_g")
            return { ...r, quantity: "99999" };
          if (i === 3 && r.metric === "mass_with_cost_g")
            return { ...r, dimensionId: extraProduct };
          if (i === 4 && r.metric === "mass_with_cost_g")
            return { ...r, day: "2026-10-15" };
          if (i === 5 && r.metric === "mass_with_cost_g")
            return { ...r, locationId: exactLocals[7] };
          if (
            i === 6 &&
            ["revenue_with_cost", "cost_of_goods"].includes(r.metric)
          )
            return { ...r, currencyCode: "MXN" };
          return r;
        }),
      );
      // Another minor unit must not cover own captured revenue either.
      rows.push(
        fact("revenue_with_cost", exactLocals[6], "2026-10-16", "0", 10000n),
      );
      rows[rows.length - 1].minorUnit = 0;
      // Reference/extended inclusive boundaries, outside recent window, and old same-weekday.
      for (const offset of [0, 1, 28, 29, 45, 46, 49]) {
        const day = addDays("2026-10-18", -offset);
        for (const local of exactLocals.slice(0, 2)) {
          rows.push(...sale(local, day));
        }
      }
      await getDb().insert(metrics).values(rows);
    }, 120_000);
    afterAll(async () => {
      await limpiarNegocios([exactBusiness], [exactOwner]);
    }, 120_000);

    it("preserves exact text, own money, mixed contribution and rejects every cross-compensation", async () => {
      const all = await readInput(exactBusiness, now);
      const own = financialMetrics(all);
      expect(salesBasis(own).complete).toBe(false);
      for (let i = 0; i < 7; i++) {
        const scoped = await readInput(
          exactBusiness,
          now,
          undefined,
          exactLocals[i],
        );
        const day = financialMetrics(scoped).filter(
          (r) => r.day === "2026-10-16",
        );
        expect(salesBasis(day)).toMatchObject(
          i === 0
            ? { complete: true, contribution: 6000 }
            : { complete: false, contribution: null },
        );
        expect(
          calculateGoal(scoped).finance.reasons.includes("sales_costs"),
        ).toBe(i !== 0);
      }
      const sold = own.find(
        (r) =>
          r.locationId === exactLocals[1] &&
          r.day === "2026-10-16" &&
          r.metric === "mass_sold_g",
      )!;
      const known = own.find(
        (r) =>
          r.locationId === exactLocals[1] &&
          r.day === "2026-10-16" &&
          r.metric === "mass_with_cost_g",
      )!;
      expect(sold.quantityExact).toBe(grams);
      expect(known.quantityExact).toBe(lessGrams);
      expect(sold.quantity).toBe(known.quantity);
    }, 30_000);

    it("keeps reference/extended local boundaries exactly once without extending discrete same-weekday ranking to mass", async () => {
      const input = await readInput(exactBusiness, now);
      for (const offset of [0, 1, 28, 29, 45]) {
        for (const metric of [
          "mass_sold_g",
          "mass_with_cost_g",
          "units_sold",
          "units_with_cost",
        ]) {
          const rows = input.metrics.filter(
            (r) =>
              r.day === addDays(input.today, -offset) && r.metric === metric,
          );
          expect(rows).toHaveLength(2);
          expect(new Set(rows.map((r) => r.locationId))).toEqual(
            new Set(exactLocals.slice(0, 2)),
          );
          expect(rows.map((r) => r.quantityExact)).toEqual([
            metric.startsWith("mass") ? grams : "2",
            metric.startsWith("mass") ? grams : "2",
          ]);
        }
      }
      for (const offset of [46, 49]) {
        const day = addDays(input.today, -offset);
        expect(
          input.metrics.filter(
            (r) => r.day === day && r.metric.startsWith("mass"),
          ),
        ).toHaveLength(0);
      }
      expect(
        input.metrics.filter(
          (r) =>
            r.day === addDays(input.today, -49) && r.metric === "units_sold",
        ),
      ).toHaveLength(2);
      const scoped = await readInput(
        exactBusiness,
        now,
        undefined,
        exactLocals[0],
      );
      expect(
        scoped.metrics
          .filter((r) => r.metric.startsWith("mass"))
          .every((r) => r.locationId === exactLocals[0]),
      ).toBe(true);
      await assertSnapshotEquivalence(exactBusiness, now);
      await assertSnapshotEquivalence(exactBusiness, now, exactLocals[0]);
    }, 30_000);
  },
);
