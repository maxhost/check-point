import { assertSnapshotEquivalence } from "./snapshot-equivalence.test-support";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import {
  permisosIntegrationEnabled,
  seedOwnerDeNegocio,
  cookieDe,
  limpiarNegocios,
  conCookie,
} from "../../permissions-integration-support";
import { hashPin } from "../../staff-pin";
import { getDb } from "@mi-pasaporte/db";
import {
  analyticsDailyMetrics as metrics,
  analyticsCardCandidates as candidates,
  analyticsEvaluationRuns as runs,
  analyticsDimensionLabels as labels,
  locations,
  memberships,
  businesses,
  users,
} from "@mi-pasaporte/db/schema";
const callbacks = vi.hoisted(() => ({ all: [] as (() => Promise<void>)[] }));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (work: () => Promise<void>) => {
    callbacks.all.push(work);
  },
}));
import { evaluateBusiness, readInbox } from "./index";
import { decideInboxCard } from "../lifecycle";
import { readInput, readHistory, readDay } from "../queries";
import {
  inboxGET,
  historyGET,
  dayGET,
  cardPOST,
  legacyCardPOST,
  evaluateGET,
} from "../http";
import { calculateGoal } from "@mi-pasaporte/domain/analytics/cards/index";
import { localDay, addDays } from "@mi-pasaporte/domain/analytics/date";
const businessA = randomUUID(),
  businessB = randomUUID(),
  ownerA = randomUUID(),
  ownerB = randomUUID(),
  staff = randomUUID(),
  localA = randomUUID(),
  localB = randomUUID(),
  product = randomUUID();
let cookieA = "",
  cookieB = "",
  cookieStaff = "";
const today = localDay(new Date(), "America/Guayaquil");
const viewer = {
  role: "owner",
  permissions: ["analytics", "catalog", "business"],
};
describe.skipIf(!permisosIntegrationEnabled)(
  "AN-1 persisted evaluation, real guards and tenant boundaries",
  () => {
    beforeAll(async () => {
      await seedOwnerDeNegocio(ownerA, businessA, `analytics-a-${businessA}`);
      await seedOwnerDeNegocio(ownerB, businessB, `analytics-b-${businessB}`);
      await getDb()
        .insert(users)
        .values({
          id: staff,
          name: "Analytics Staff",
          email: `${staff}@staff.invalid`,
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      await getDb()
        .insert(memberships)
        .values({
          businessId: businessA,
          userId: staff,
          role: "staff",
          status: "active",
          handle: "analyticsstaff",
          pinHash: await hashPin("123456"),
          permissions: ["counter"],
          pinMustChange: false,
        });
      await getDb()
        .insert(locations)
        .values([
          {
            id: localA,
            businessId: businessA,
            name: "Centro",
            addressLabel: "Centro",
            countryCode: "EC",
            addressSnapshot: {},
          },
          {
            id: localB,
            businessId: businessB,
            name: "Otro",
            addressLabel: "Otro",
            countryCode: "EC",
            addressSnapshot: {},
          },
        ]);
      await getDb().insert(labels).values({
        businessId: businessA,
        kind: "product",
        id: product,
        label: "Café",
        updatedAt: new Date(),
      });
      await getDb()
        .insert(metrics)
        .values([
          {
            businessId: businessA,
            locationId: localA,
            day: addDays(today, -1),
            metric: "revenue",
            dimensionKind: "none",
            amountMinor: 21000n,
            currencyCode: "USD",
            minorUnit: 2,
            count: 34,
          },
          {
            businessId: businessA,
            locationId: localA,
            day: addDays(today, -1),
            metric: "product_revenue",
            dimensionKind: "product",
            dimensionId: product,
            amountMinor: 21000n,
            currencyCode: "USD",
            minorUnit: 2,
            count: 34,
          },
          {
            businessId: businessA,
            locationId: localA,
            day: addDays(today, -1),
            metric: "units_sold",
            dimensionKind: "product",
            dimensionId: product,
            quantity: "40",
          },
        ]);
      [cookieA, cookieB, cookieStaff] = await Promise.all([
        cookieDe(ownerA),
        cookieDe(ownerB),
        cookieDe(staff),
      ]);
    }, 120000);
    afterAll(async () => {
      for (const callback of callbacks.all) await callback();
      await limpiarNegocios([businessA, businessB], [ownerA, ownerB, staff]);
    }, 120000);
    it("real session guard denies anonymous and staff without analytics", async () => {
      expect(
        (
          await historyGET(
            new Request("http://localhost/api/analytics/history"),
          )
        ).status,
      ).toBe(401);
      expect(
        (
          await historyGET(
            conCookie("/api/analytics/history", "GET", cookieStaff),
          )
        ).status,
      ).toBe(403);
      await getDb()
        .update(memberships)
        .set({ permissions: ["analytics"] })
        .where(
          and(
            eq(memberships.businessId, businessA),
            eq(memberships.userId, staff),
          ),
        );
      expect(
        (
          await historyGET(
            conCookie("/api/analytics/history", "GET", cookieStaff),
          )
        ).status,
      ).toBe(200);
    });
    it("fallback on opening persists one complete run and repeated evaluations are idempotent", async () => {
      const response = await inboxGET(
        conCookie("/api/analytics/inbox", "GET", cookieA),
      );
      expect(response.status).toBe(200);
      const inbox = await response.json();
      expect(inbox.state).toBe("ready");
      expect(inbox.cards.length).toBeGreaterThan(1);
      const before = await getDb()
        .select()
        .from(candidates)
        .where(eq(candidates.businessId, businessA));
      expect(await evaluateBusiness(businessA)).toBe(false);
      const after = await getDb()
        .select()
        .from(candidates)
        .where(eq(candidates.businessId, businessA));
      expect(after.map((c) => c.id).sort()).toEqual(
        before.map((c) => c.id).sort(),
      );
      const [run] = await getDb()
        .select()
        .from(runs)
        .where(eq(runs.businessId, businessA));
      expect(run?.status).toBe("ready");
    }, 30000);
    it("foreign cards and locations return 404; other tenant history stays empty", async () => {
      const inbox = await readInbox(businessA, viewer);
      const id = inbox.cards[0]!.id;
      expect(
        (
          await cardPOST(
            new Request(
              conCookie(`/api/analytics/inbox/${id}/ignore`, "POST", cookieB),
              {
                body: JSON.stringify({
                  expectedVersion: inbox.cards[0].version,
                  operationId: randomUUID(),
                }),
                headers: {
                  cookie: cookieB,
                  "content-type": "application/json",
                },
              },
            ),
            id,
            "ignore",
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await historyGET(
            conCookie(
              `/api/analytics/history?locationId=${localA}`,
              "GET",
              cookieB,
            ),
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await dayGET(
            conCookie(
              `/api/analytics/day?date=${today}&locationId=${localA}`,
              "GET",
              cookieB,
            ),
          )
        ).status,
      ).toBe(404);
      expect((await readHistory(businessB, "month")).revenueMinor).toBe(0);
    });
    it("v2 ignore closes only its context and legacy navigation returns 409 without closing", async () => {
      const inbox = await readInbox(businessA, viewer),
        card = inbox.cards.find((c) => c.cardKey === "7")!;
      const result = await decideInboxCard(
        {
          businessId: businessA,
          actorId: ownerA,
          cardId: card.id,
          decision: "ignore",
          expectedVersion: card.version,
          operationId: randomUUID(),
        },
        viewer,
      );
      expect(result.cards.some((c) => c.id === card.id)).toBe(false);
      const second = await readInbox(businessA, viewer);
      expect(second.cards.some((c) => c.id === card.id)).toBe(false);
      const summary = second.cards.find((c) => c.cardKey === "1")!;
      const legacy = await legacyCardPOST(
        conCookie(`/api/analytics/inbox/${summary.id}/accept`, "POST", cookieA),
        summary.id,
      );
      expect(legacy.status).toBe(409);
      expect((await legacy.json()).code).toBe("inbox_contract_changed");
      expect(
        (await readInbox(businessA, viewer)).cards.some(
          (c) => c.id === summary.id,
        ),
      ).toBe(true);
      const seen = await decideInboxCard(
        {
          businessId: businessA,
          actorId: ownerA,
          cardId: summary.id,
          decision: "seen",
          expectedVersion: summary.version,
          operationId: randomUUID(),
        },
        viewer,
      );
      expect(seen.cards.some((c) => c.id === summary.id)).toBe(false);
      expect(
        (
          await legacyCardPOST(
            conCookie("/api/analytics/inbox/unknown/dismiss", "POST", cookieA),
            summary.id,
          )
        ).status,
      ).toBe(409);
    }, 30000);
    it("cron is authenticated; malformed dates/periods do not reach SQL", async () => {
      expect(
        (
          await evaluateGET(
            new Request("http://localhost/api/internal/analytics/evaluate"),
          )
        ).status,
      ).toBe(401);
      expect(
        (
          await dayGET(
            conCookie("/api/analytics/day?date=2026-02-30", "GET", cookieA),
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await historyGET(
            conCookie("/api/analytics/history?period=all", "GET", cookieA),
          )
        ).status,
      ).toBe(400);
    });
    it("a concurrent claim evaluates an empty business only once", async () => {
      const results = await Promise.all([
        evaluateBusiness(businessB),
        evaluateBusiness(businessB),
      ]);
      expect(results.filter(Boolean)).toHaveLength(1);
      const inbox = await readInbox(businessB, viewer);
      expect(inbox.cards.map((c) => c.cardKey)).toEqual(["4"]);
      const state = await getDb().execute(
        sql`select count(*)::int n from analytics.evaluation_run where business_id=${businessB} and day=${today}`,
      );
      expect(state.rows[0]?.n).toBe(1);
    }, 30000);
    it("bounded windows retain current fixed/variable expenses, distant paid concepts and sparse weekdays", async () => {
      const baselineMonthRevenue = calculateGoal(
        await readInput(businessA, new Date("2026-10-31T08:00:00Z")),
      ).monthRevenueMinor;
      const concept = randomUUID();
      await getDb().insert(labels).values({
        businessId: businessA,
        kind: "concept",
        id: concept,
        label: "Alquiler",
        updatedAt: new Date(),
      });
      await getDb()
        .insert(metrics)
        .values([
          {
            businessId: businessA,
            locationId: localA,
            day: "2026-10-01",
            metric: "revenue",
            dimensionKind: "none",
            amountMinor: 1100n,
            currencyCode: "USD",
            minorUnit: 2,
            count: 1,
          },
          ...[
            ["2026-05-05", 3000],
            ["2026-09-20", 2000],
            ["2026-10-01", 1100],
          ].map(([day, amount]) => ({
            businessId: businessA,
            locationId: null,
            day: String(day),
            metric: "expense_fixed",
            dimensionKind: "concept",
            dimensionId: concept,
            amountMinor: BigInt(amount),
            currencyCode: "USD",
            minorUnit: 2,
          })),
          ...[
            ["2026-07-01", 900],
            ["2026-10-01", 600],
          ].map(([day, amount]) => ({
            businessId: businessA,
            locationId: null,
            day: String(day),
            metric: "expense_variable",
            dimensionKind: "concept",
            dimensionId: concept,
            amountMinor: BigInt(amount),
            currencyCode: "USD",
            minorUnit: 2,
          })),
          ...["2026-07-04", "2026-08-01", "2026-08-08", "2026-08-15"].flatMap(
            (day) => [
              {
                businessId: businessA,
                locationId: localA,
                day,
                metric: "revenue",
                dimensionKind: "none",
                amountMinor: 8000n,
                currencyCode: "USD",
                minorUnit: 2,
                count: 1,
              },
              {
                businessId: businessA,
                locationId: localA,
                day,
                metric: "product_revenue",
                dimensionKind: "product",
                dimensionId: product,
                amountMinor: 8000n,
                currencyCode: "USD",
                minorUnit: 2,
                count: 1,
              },
              {
                businessId: businessA,
                locationId: localA,
                day,
                metric: "units_sold",
                dimensionKind: "product",
                dimensionId: product,
                quantity: "10",
              },
            ],
          ),
        ]);
      const input = await readInput(
        businessA,
        new Date("2026-10-31T08:00:00Z"),
      );
      await assertSnapshotEquivalence(
        businessA,
        new Date("2026-10-31T08:00:00Z"),
      );
      await assertSnapshotEquivalence(
        businessA,
        new Date("2026-10-31T08:00:00Z"),
        localA,
      );
      expect(input.firstSaleDay).toBe("2026-07-04");
      expect(
        input.metrics.filter(
          (r) => r.metric === "revenue" && r.day === "2026-10-01",
        ),
      ).toHaveLength(1);
      expect(calculateGoal(input).monthRevenueMinor).toBe(
        baselineMonthRevenue + 1100,
      );
      for (const [metric, day, amount] of [
        ["revenue", "2026-10-01", 1100],
        ["expense_fixed", "2026-10-01", 1100],
        ["expense_variable", "2026-10-01", 600],
        ["expense_variable", "2026-07-01", 900],
        ["expense_fixed", "2026-05-05", 3000],
      ] as const)
        expect(
          input.metrics.find((r) => r.metric === metric && r.day === day)
            ?.amountMinor,
        ).toBe(amount);
      expect(
        input.metrics.find(
          (r) => r.metric === "units_sold" && r.day === "2026-07-04",
        )?.quantity,
      ).toBe(10);
    }, 30000);
    it("preserves complete snapshots and card ordering for products tied on sales", async () => {
      const tied = [randomUUID(), randomUUID()];
      await getDb()
        .insert(labels)
        .values(
          tied.map((id, i) => ({
            businessId: businessA,
            kind: "product",
            id,
            label: `Tied product ${i}`,
            updatedAt: new Date(),
          })),
        );
      await getDb()
        .insert(metrics)
        .values(
          tied.flatMap((id) => [
            {
              businessId: businessA,
              locationId: localA,
              day: "2026-10-30",
              metric: "product_revenue",
              dimensionKind: "product",
              dimensionId: id,
              amountMinor: 1000n,
              currencyCode: "USD",
              minorUnit: 2,
              count: 1,
            },
            {
              businessId: businessA,
              locationId: localA,
              day: "2026-10-30",
              metric: "units_sold",
              dimensionKind: "product",
              dimensionId: id,
              quantity: "10",
              currencyCode: "",
              minorUnit: 0,
              count: 1,
            },
          ]),
        );
      await getDb().insert(metrics).values({
        businessId: businessA,
        locationId: localA,
        day: "2026-10-30",
        metric: "revenue",
        dimensionKind: "none",
        amountMinor: 2000n,
        currencyCode: "USD",
        minorUnit: 2,
        count: 2,
      });
      await assertSnapshotEquivalence(
        businessA,
        new Date("2026-10-31T08:00:00Z"),
      );
    }, 30000);
    it("uses canonical COP units across real summary, candidate, history and day", async () => {
      await getDb()
        .update(businesses)
        .set({ currencyCode: "COP" })
        .where(eq(businesses.id, businessB));
      const copDay = "2027-03-10";
      await getDb().insert(metrics).values({
        businessId: businessB,
        day: "2027-03-09",
        metric: "revenue",
        dimensionKind: "none",
        amountMinor: 40n,
        currencyCode: "COP",
        minorUnit: 0,
        count: 1,
      });
      const now = new Date(`${copDay}T08:00:00Z`);
      const input = await readInput(businessB, now);
      await assertSnapshotEquivalence(businessB, now);
      expect(input.minorUnit).toBe(0);
      expect(input.firstSaleDay).toBe("2027-03-09");
      expect(await evaluateBusiness(businessB, now)).toBe(true);
      const rows = await getDb()
        .select()
        .from(candidates)
        .where(
          and(eq(candidates.businessId, businessB), eq(candidates.day, copDay)),
        );
      expect(rows.find((r) => r.cardKey === "1")).toMatchObject({
        amountMinor: 40n,
        minorUnit: 0,
        currencyCode: "COP",
      });
      expect(
        await readHistory(businessB, "month", undefined, now),
      ).toMatchObject({ minorUnit: 0, revenueMinor: 40 });
      expect(
        await readDay(businessB, "2027-03-09", undefined, now),
      ).toMatchObject({ minorUnit: 0, revenueMinor: 40 });
    }, 30000);
  },
);
