import { assertSnapshotEquivalence } from "./snapshot-equivalence.test-support";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  analyticsDailyMetrics as metrics,
  analyticsCampaignSnapshots as snapshots,
  analyticsCardCandidates as candidates,
  analyticsCardStates as states,
  analyticsEvaluationRuns as runs,
  locations,
  consumerAccounts,
  businessCustomers,
  memberships,
  users,
} from "@mi-pasaporte/db/schema";
import {
  permisosIntegrationEnabled,
  seedOwnerDeNegocio,
  cookieDe,
  limpiarNegocios,
  conCookie,
} from "../../permissions-integration-support";
import { hashPin } from "../../staff-pin";
import { analyticsCustomerId } from "../../counter/analytics-events";
import { readAnalyticsCustomer } from "../../customers/analytics-detail";
import { GET as customerGET } from "../../../app/api/customers/analytics/[id]/route";
import { buildCustomerPromoCandidates } from "@mi-pasaporte/domain/analytics/cards/customer-promo";
import { reconcileCampaignCandidates, evaluateBusiness } from "./index";
import { readInput, readHistory } from "../queries";
const businessA = randomUUID(),
  businessB = randomUUID(),
  ownerA = randomUUID(),
  ownerB = randomUUID(),
  staff = randomUUID(),
  localA = randomUUID(),
  localB = randomUUID(),
  consumerA = randomUUID(),
  consumerB = randomUUID(),
  campaign = randomUUID();
let cookieA = "",
  cookieB = "",
  cookieStaff = "";
const now = new Date("2026-10-20T16:00:00Z");
describe.skipIf(!permisosIntegrationEnabled)(
  "AN-3 summaries, lifecycle and specific customer tenancy",
  () => {
    beforeAll(async () => {
      await seedOwnerDeNegocio(ownerA, businessA, `an3-a-${businessA}`);
      await seedOwnerDeNegocio(ownerB, businessB, `an3-b-${businessB}`);
      await getDb()
        .insert(users)
        .values({
          id: staff,
          name: "AN3 Staff",
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
          handle: "an3staff",
          pinHash: await hashPin("123456"),
          permissions: ["analytics"],
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
            businessId: businessA,
            name: "Norte",
            addressLabel: "Norte",
            countryCode: "EC",
            addressSnapshot: {},
          },
        ]);
      await getDb()
        .insert(consumerAccounts)
        .values(
          [consumerA, consumerB].map((id) => ({
            id,
            firstName: "Juan",
            lastName: "Pérez",
            qrToken: randomUUID(),
            webViewToken: randomUUID(),
          })),
        );
      await getDb()
        .insert(businessCustomers)
        .values([
          {
            businessId: businessA,
            consumerId: consumerA,
            displayName: "Juan Pérez",
            searchName: "juan perez",
            enrolledAt: new Date("2026-01-01T12:00Z"),
            lastVisitAt: new Date("2026-09-25T12:00Z"),
          },
          {
            businessId: businessA,
            consumerId: consumerB,
            displayName: "Juan Pérez",
            searchName: "juan perez",
            enrolledAt: new Date("2026-02-01T12:00Z"),
            lastVisitAt: new Date("2026-09-26T12:00Z"),
          },
          {
            businessId: businessB,
            consumerId: consumerA,
            displayName: "Otro negocio",
            searchName: "otro negocio",
            enrolledAt: new Date("2026-03-01T12:00Z"),
          },
        ]);
      [cookieA, cookieB, cookieStaff] = await Promise.all([
        cookieDe(ownerA),
        cookieDe(ownerB),
        cookieDe(staff),
      ]);
    }, 120000);
    afterAll(async () => {
      await limpiarNegocios([businessA, businessB], [ownerA, ownerB, staff]);
      await getDb()
        .delete(consumerAccounts)
        .where(sql`${consumerAccounts.id} in (${consumerA},${consumerB})`);
    }, 120000);
    it("preserves local/count/money and uses four distinct visit dates, not four operations", async () => {
      const customer = analyticsCustomerId(businessA, consumerA);
      await getDb()
        .insert(metrics)
        .values([
          {
            businessId: businessA,
            locationId: localA,
            day: "2026-09-01",
            metric: "revenue",
            dimensionKind: "none",
            amountMinor: 100n,
            currencyCode: "USD",
            minorUnit: 2,
            count: 1,
          },
          ...["2026-08-19", "2026-08-31", "2026-09-12", "2026-09-24"].map(
            (day) => ({
              businessId: businessA,
              locationId: localA,
              day,
              metric: "visits",
              dimensionKind: "customer",
              dimensionId: customer,
              amountMinor: 202n,
              currencyCode: "USD",
              minorUnit: 2,
              count: 2,
              quantity: "2",
            }),
          ),
          {
            businessId: businessA,
            locationId: localB,
            day: "2026-09-24",
            metric: "visits",
            dimensionKind: "customer",
            dimensionId: customer,
            amountMinor: 404n,
            currencyCode: "USD",
            minorUnit: 2,
            count: 4,
            quantity: "4",
          },
          {
            businessId: businessA,
            locationId: localA,
            day: "2026-10-19",
            metric: "voided_tickets",
            dimensionKind: "none",
            amountMinor: 6400n,
            currencyCode: "USD",
            minorUnit: 2,
            count: 4,
          },
        ]);
      const input = await readInput(businessA, now);
      await assertSnapshotEquivalence(businessA, now);
      await assertSnapshotEquivalence(businessA, now, localA);
      expect(input.firstSaleDays).toContainEqual({
        locationId: localA,
        day: "2026-09-01",
      });
      expect(
        input.metrics.find(
          (r) => r.metric === "visits" && r.locationId === localB,
        )?.count,
      ).toBe(4);
      const cards = buildCustomerPromoCandidates(input);
      expect(cards.find((c) => c.cardKey === "10")?.amountMinor).toBe(6400);
      expect(cards.filter((c) => c.cardKey === "11")).toHaveLength(1);
      expect(cards.find((c) => c.cardKey === "11")).toMatchObject({
        locationId: null,
        amountMinor: 606,
      });
      expect(
        buildCustomerPromoCandidates(await readInput(businessB, now)),
      ).toHaveLength(0);
    }, 30000);
    it("converts 23:30 local finish, versioned edits and drafts without origin reads or duplicate cards", async () => {
      await getDb()
        .insert(snapshots)
        .values({
          businessId: businessA,
          campaignId: campaign,
          label: "Promo20",
          status: "active",
          startsAt: new Date("2026-10-01T05:00Z"),
          endsAt: new Date("2026-10-20T04:30Z"),
          endedAt: null,
          capturedAt: new Date("2026-10-01T12:00Z"),
          eventId: randomUUID(),
        });
      await getDb()
        .insert(metrics)
        .values(
          ["promo_discount", "promo_sales"].map((metric) => ({
            businessId: businessA,
            locationId: localA,
            day: "2026-10-19",
            metric,
            dimensionKind: "campaign",
            dimensionId: campaign,
            amountMinor: metric === "promo_sales" ? 14000n : 3000n,
            currencyCode: "USD",
            minorUnit: 2,
            count: 1,
          })),
        );
      const input = await readInput(businessA, now);
      await assertSnapshotEquivalence(businessA, now);
      await assertSnapshotEquivalence(businessA, now, localA);
      expect(input.campaigns?.[0]).toMatchObject({
        startsAt: "2026-10-01",
        endsAt: "2026-10-19",
      });
      expect(
        buildCustomerPromoCandidates(input).filter((c) => c.cardKey === "12"),
      ).toHaveLength(1);
      expect(
        buildCustomerPromoCandidates(input).find((c) => c.cardKey === "12")
          ?.body,
      ).toContain("140,00");
      await getDb()
        .update(snapshots)
        .set({
          endsAt: new Date("2026-10-21T04:30Z"),
          capturedAt: new Date("2026-10-19T12:00Z"),
          eventId: randomUUID(),
        })
        .where(eq(snapshots.businessId, businessA));
      expect(
        buildCustomerPromoCandidates(await readInput(businessA, now)).find(
          (c) => c.cardKey === "12",
        ),
      ).toBeUndefined();
      await getDb()
        .update(snapshots)
        .set({ status: "draft", endsAt: new Date("2026-10-20T04:30Z") })
        .where(eq(snapshots.businessId, businessA));
      expect(
        buildCustomerPromoCandidates(await readInput(businessA, now)).find(
          (c) => c.cardKey === "12",
        ),
      ).toBeUndefined();
    }, 30000);
    it("history keeps periods, locations, exact amounts and returning cohort", async () => {
      const h = await readHistory(businessA, "3m", localA, now);
      expect(h.customers).toMatchObject({ count: 1, visits: 8 });
      expect(h.promos).toMatchObject([
        { discountMinor: 3000, salesMinor: 14000, costMinor: null },
      ]);
      const other = await readHistory(businessA, "month", localB, now);
      expect(other.customers).toMatchObject({ count: 0, visits: 0 });
      expect(other.promos).toHaveLength(0);
      expect(
        (await readHistory(businessB, "3m", undefined, now)).customers.visits,
      ).toBe(0);
    }, 30000);
    it("matches Node UUIDv5 in restricted SQL; homonyms and another business stay distinct", async () => {
      const a = analyticsCustomerId(businessA, consumerA),
        b = analyticsCustomerId(businessA, consumerB);
      const first = await readAnalyticsCustomer(businessA, a),
        second = await readAnalyticsCustomer(businessA, b);
      expect(first).toMatchObject({
        name: "Juan Pérez",
        enrolledAt: "2026-01-01T12:00:00.000Z",
      });
      expect(second).toMatchObject({
        name: "Juan Pérez",
        enrolledAt: "2026-02-01T12:00:00.000Z",
      });
      expect(Object.keys(first!)).toEqual([
        "name",
        "enrolledAt",
        "lastVisitAt",
      ]);
      expect(await readAnalyticsCustomer(businessB, a)).toBeNull();
      expect(await readAnalyticsCustomer(businessA, consumerA)).toBeNull();
      expect(
        await readAnalyticsCustomer(
          businessB,
          analyticsCustomerId(businessB, consumerA),
        ),
      ).toMatchObject({ name: "Otro negocio" });
      expect(
        (
          await customerGET(
            new Request(`http://localhost/api/customers/analytics/${a}`),
            { params: Promise.resolve({ id: a }) },
          )
        ).status,
      ).toBe(401);
      expect(
        (
          await customerGET(
            conCookie(`/api/customers/analytics/${a}`, "GET", cookieStaff),
            { params: Promise.resolve({ id: a }) },
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await customerGET(
            conCookie(`/api/customers/analytics/${a}`, "GET", cookieB),
            { params: Promise.resolve({ id: a }) },
          )
        ).status,
      ).toBe(404);
      const response = await customerGET(
        conCookie(`/api/customers/analytics/${a}`, "GET", cookieA),
        { params: Promise.resolve({ id: a }) },
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(first);
    }, 30000);
    it("reconciles after today's ready run, late promo money and edited finish while preserving IDs/state", async () => {
      await evaluateBusiness(businessA, now);
      await withDbTransaction(async (tx) => {
        await tx
          .update(snapshots)
          .set({
            status: "ended",
            endsAt: new Date("2026-10-20T04:30Z"),
            endedAt: new Date("2026-10-20T04:30Z"),
          })
          .where(eq(snapshots.businessId, businessA));
        await reconcileCampaignCandidates(tx, businessA, now);
      });
      const read = () =>
        getDb()
          .select()
          .from(candidates)
          .where(
            sql`${candidates.businessId}=${businessA} and ${candidates.day}='2026-10-20' and ${candidates.cardKey}='12'`,
          );
      const [first] = await read();
      expect(first).toBeDefined();
      expect(first!.amountMinor).toBe(3000n);
      await getDb().insert(states).values({
        businessId: businessA,
        cardKey: "12",
        subjectKey: first!.subjectKey,
        fingerprint: first!.fingerprint,
        status: "dismissed",
        shownDays: 1,
        lastShownDay: "2026-10-20",
      });
      await withDbTransaction((tx) =>
        reconcileCampaignCandidates(tx, businessA, now),
      );
      expect((await read())[0]).toMatchObject({ id: first!.id, weight: "0" });
      await withDbTransaction(async (tx) => {
        await tx
          .update(metrics)
          .set({ amountMinor: 14000n })
          .where(
            sql`${metrics.businessId}=${businessA} and ${metrics.metric}='promo_discount'`,
          );
        await reconcileCampaignCandidates(tx, businessA, now);
      });
      const [updated] = await read();
      expect(updated).toMatchObject({ id: first!.id, amountMinor: 14000n });
      expect(Number(updated!.weight)).toBeGreaterThan(0);
      expect(
        (
          await getDb()
            .select()
            .from(runs)
            .where(eq(runs.businessId, businessA))
        )[0]!.status,
      ).toBe("ready");
      expect(
        (
          await getDb()
            .select()
            .from(states)
            .where(eq(states.businessId, businessA))
        )[0]!.status,
      ).toBe("dismissed");
      await getDb()
        .update(snapshots)
        .set({
          endsAt: new Date("2026-10-21T04:30Z"),
          endedAt: null,
          status: "paused",
        })
        .where(eq(snapshots.businessId, businessA));
      await withDbTransaction((tx) =>
        reconcileCampaignCandidates(tx, businessA, now),
      );
      expect(await read()).toHaveLength(0);
      expect(
        (
          await getDb()
            .select()
            .from(candidates)
            .where(
              sql`${candidates.businessId}=${businessA} and ${candidates.cardKey}='10'`,
            )
        ).length,
      ).toBeGreaterThan(0);
    }, 30000);
  },
);
