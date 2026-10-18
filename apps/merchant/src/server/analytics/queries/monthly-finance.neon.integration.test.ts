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
