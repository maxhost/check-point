import { randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  locations,
  analyticsCardCandidates as candidates,
  analyticsCardStates as states,
  analyticsDailyMetrics as metrics,
  analyticsDailyGauges as gauges,
  analyticsSourceRevisions as sources,
  analyticsCampaignSnapshots as snapshots,
  moduleEvents,
  moduleEventDeliveries,
} from "@mi-pasaporte/db/schema";
import {
  ANALYTICS_POLICY,
  createAnalyticsPolicy,
  type AnalyticsPolicy,
  type AnalyticsPolicyConfig,
} from "@mi-pasaporte/domain/analytics/policy/index";
import { buildCandidates } from "@mi-pasaporte/domain/analytics/cards/index";
import { addDays, daysBetween } from "@mi-pasaporte/domain/analytics/date";
import type { AnalyticsContext } from "@mi-pasaporte/domain/analytics/types";
import type {
  AnalyticsFact,
  MetricEvent,
} from "@mi-pasaporte/domain/analytics/metrics";
import { permisosIntegrationEnabled } from "../../permissions-integration-support";
import { readInput } from "../queries";
import { readInbox, decideInboxCard, cleanupInbox } from "../lifecycle";
import { syncInboxCandidates } from "../lifecycle/sync";
import { applyAnalyticsEvent } from "../ingestion/apply";
import { evaluateBusiness, evaluateAnalyticsFacts } from "./index";
import * as actions from "../actions";
const now = new Date("2026-10-17T18:00:00.000Z"),
  day = "2026-10-17",
  viewer = { role: "owner", permissions: ["analytics"] },
  actor = randomUUID();
const owned: string[] = [];
function focused(ids: string[], change?: (c: AnalyticsPolicyConfig) => void) {
  const c = structuredClone(ANALYTICS_POLICY);
  c.rules = c.rules.map((r) => ({ ...r, enabled: ids.includes(r.id) }));
  change?.(c);
  return createAnalyticsPolicy(c);
}
async function fixture() {
  const businessId = randomUUID(),
    locationId = randomUUID(),
    item = randomUUID(),
    product = randomUUID();
  owned.push(businessId);
  await getDb()
    .insert(businesses)
    .values({
      id: businessId,
      name: "Lifecycle sync",
      slug: `life-sync-${businessId}`,
      countryCode: "EC",
      timezone: "America/Guayaquil",
      currencyCode: "USD",
    });
  await getDb().insert(locations).values({
    id: locationId,
    businessId,
    name: "Centro",
    addressLabel: "Centro",
    countryCode: "EC",
    addressSnapshot: {},
  });
  return { businessId, locationId, item, product };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function seed(f: Fixture) {
  await getDb()
    .insert(metrics)
    .values(
      Array.from({ length: 56 }, (_, i) => ({
        businessId: f.businessId,
        locationId: f.locationId,
        day: addDays(day, -i - 1),
        metric: "revenue",
        dimensionKind: "none",
        dimensionId: null,
        currencyCode: "USD",
        minorUnit: 2,
        amountMinor: 10000n,
        count: 10,
      })),
    );
}
async function state(f: Fixture, key: string) {
  return (
    await getDb()
      .select()
      .from(states)
      .where(and(eq(states.businessId, f.businessId), eq(states.cardKey, key)))
  )[0];
}
async function sync(f: Fixture, policy: AnalyticsPolicy, at = now) {
  const input = await readInput(f.businessId, at, undefined, undefined, policy);
  await withDbTransaction((tx) =>
    syncInboxCandidates(
      tx,
      f.businessId,
      input,
      buildCandidates(input, input.states, policy),
      at,
      policy,
    ),
  );
}
async function close(
  f: Fixture,
  key: string,
  policy: AnalyticsPolicy,
  decision: "ignore" | "resolve" | "seen" = "ignore",
) {
  const card = (
    await readInbox(f.businessId, viewer, now, { policy })
  ).cards.find((c) => c.cardKey === key)!;
  expect(card).toBeDefined();
  const command = {
    businessId: f.businessId,
    actorId: actor,
    cardId: card.id,
    decision,
    expectedVersion: card.version,
    operationId: randomUUID(),
  };
  await decideInboxCard(command, viewer, now, { policy });
  return { card, command };
}
async function content(f: Fixture, key: string) {
  return getDb()
    .select()
    .from(candidates)
    .where(
      and(eq(candidates.businessId, f.businessId), eq(candidates.cardKey, key)),
    );
}
describe.skipIf(!permisosIntegrationEnabled)(
  "A3 real transactional synchronization and source lifecycle",
  () => {
    beforeAll(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(now);
      vi.spyOn(actions, "actionContext").mockResolvedValue(() => null);
    });
    afterEach(() => vi.setSystemTime(now));
    afterAll(async () => {
      vi.restoreAllMocks();
      vi.useRealTimers();
      for (const id of owned)
        await getDb().delete(businesses).where(eq(businesses.id, id));
    }, 120000);
    it("rebases7 on policy only without reopening, then a real pertinent sale can reopen with the same identity", async () => {
      const f = await fixture();
      await seed(f);
      await getDb()
        .insert(metrics)
        .values(
          [
            {
              day: addDays(day, -1),
              metric: "product_revenue",
              amountMinor: 10000n,
            },
            { day: addDays(day, -1), metric: "units_sold", quantity: "1" },
            {
              day: addDays(day, -40),
              metric: "product_revenue",
              amountMinor: 1000000n,
            },
            { day: addDays(day, -40), metric: "units_sold", quantity: "100" },
          ].map((r) => ({
            ...r,
            businessId: f.businessId,
            locationId: f.locationId,
            dimensionKind: "product",
            dimensionId: f.product,
            currencyCode: "USD",
            minorUnit: 2,
          })),
        );
      const p = focused(["7"]);
      await sync(f, p);
      const { card } = await close(f, "7", p);
      const before = await state(f, "7");
      const changed = focused(["7"], (c) => {
        c.rules.find((r) => r.id === "7")!.parameters = {
          ...c.rules.find((r) => r.id === "7")!.parameters,
          salesDays: 56,
        };
      });
      await sync(f, changed);
      expect(await content(f, "7")).toHaveLength(0);
      const baseline = await state(f, "7");
      expect(baseline).toMatchObject({
        candidateId: card.id,
        status: "ignored",
        episodeStartedAt: before.episodeStartedAt,
        expiresAt: before.expiresAt,
        decidedAt: before.decidedAt,
      });
      expect(
        (baseline.context as { observed: { missingUnits: number } }).observed
          .missingUnits,
      ).toBe(101);
      await getDb()
        .update(metrics)
        .set({ amountMinor: 4000000n, quantity: "101" })
        .where(
          and(
            eq(metrics.businessId, f.businessId),
            eq(metrics.dimensionId, f.product),
            eq(metrics.day, addDays(day, -1)),
            eq(metrics.metric, "product_revenue"),
          ),
        );
      await getDb()
        .update(metrics)
        .set({ quantity: "101" })
        .where(
          and(
            eq(metrics.businessId, f.businessId),
            eq(metrics.dimensionId, f.product),
            eq(metrics.day, addDays(day, -1)),
            eq(metrics.metric, "units_sold"),
          ),
        );
      await sync(f, changed, new Date(now.getTime() + 3600000));
      expect((await content(f, "7"))[0].id).toBe(card.id);
      expect((await state(f, "7")).status).toBe("open");
    }, 60000);
    it("consumes the inventory mutation clock, rejects old/replayed sources, and preserves economic-day metrics", async () => {
      const f = await fixture();
      await seed(f);
      await getDb()
        .insert(metrics)
        .values(
          Array.from({ length: 40 }, (_, i) => ({
            businessId: f.businessId,
            locationId: f.locationId,
            dimensionKind: "item",
            dimensionId: f.item,
            day: addDays(day, -i - 1),
            metric: "stock_consumption",
            quantity: "10",
          })),
        );
      await getDb()
        .insert(gauges)
        .values({
          businessId: f.businessId,
          locationId: f.locationId,
          dimensionKind: "item",
          dimensionId: f.item,
          day,
          metric: "stock_on_hand",
          quantity: "10",
          unit: "kg",
          observedAt: new Date("2026-10-17T17:00:00Z"),
          eventId: randomUUID(),
        });
      const p = focused(["8"]);
      await sync(f, p);
      const { card } = await close(f, "8", p);
      const event = (observedAt: string, onHandAfter: string): MetricEvent => ({
        id: randomUUID(),
        businessId: f.businessId,
        eventType: "recipes.consumption.applied",
        eventVersion: 1,
        capturedAt: observedAt,
        payload: {
          sourceOrderId: randomUUID(),
          locationId: f.locationId,
          closedAt: "2026-10-15T12:00:00Z",
          observedAt,
          lines: [],
          items: [
            {
              itemId: f.item,
              itemLabel: "Harina",
              itemUnit: "kg",
              quantity: "1",
              onHandAfter,
            },
          ],
        },
      });
      const old = event("2026-10-17T17:30:00Z", "9");
      await withDbTransaction((tx) => applyAnalyticsEvent(tx, old, p));
      expect(await content(f, "8")).toHaveLength(0);
      const next = event("2026-10-17T18:30:00Z", "8");
      vi.setSystemTime(new Date("2026-10-17T19:00:00Z"));
      await withDbTransaction((tx) => applyAnalyticsEvent(tx, next, p));
      expect((await content(f, "8"))[0].id).toBe(card.id);
      const before = await state(f, "8");
      await withDbTransaction((tx) => applyAnalyticsEvent(tx, next, p));
      expect((await state(f, "8")).contextVersion).toBe(before.contextVersion);
      const metric = (
        await getDb()
          .select()
          .from(metrics)
          .where(
            and(
              eq(metrics.businessId, f.businessId),
              eq(metrics.metric, "stock_consumption"),
              eq(metrics.day, "2026-10-15"),
            ),
          )
      )[0];
      expect(metric.quantity).toBe("12");
      expect(
        (before.context as { stockEvidence: { consumption: { at: string } } })
          .stockEvidence.consumption.at,
      ).toBe("2026-10-17T18:30:00.000Z");
      vi.setSystemTime(now);
    }, 60000);
    it("keeps fact5 original age and snooze when impact window rebases, and labels its original period", async () => {
      const f = await fixture();
      await seed(f);
      await getDb()
        .insert(metrics)
        .values({
          businessId: f.businessId,
          locationId: f.locationId,
          dimensionKind: "product",
          dimensionId: f.product,
          day: addDays(day, -1),
          metric: "units_sold",
          quantity: "200",
        });
      const p = focused(["5"]),
        eventId = randomUUID();
      const fact: AnalyticsFact = {
        kind: "unit_cost_change",
        occurredAt: "2026-10-17T12:00:00Z",
        locationId: f.locationId,
        itemId: f.item,
        itemLabel: "Harina",
        itemUnit: "kg",
        itemUnitCostBefore: "1",
        itemUnitCostAfter: "1.2",
        productId: f.product,
        productLabel: "Muzza",
        unitCostBefore: "1",
        unitCostAfter: "1.5",
        currencyCode: "USD",
        minorUnit: 2,
      };
      await withDbTransaction((tx) =>
        evaluateAnalyticsFacts(
          tx,
          {
            businessId: f.businessId,
            eventId,
            capturedAt: now.toISOString(),
            facts: [fact],
            now,
            sourceKey: "own-fact",
            sourceRevision: 1,
          },
          p,
        ),
      );
      const first = (await readInbox(f.businessId, viewer, now, { policy: p }))
        .cards[0];
      expect(first.period.label.trim()).not.toBe("");
      await decideInboxCard(
        {
          businessId: f.businessId,
          actorId: actor,
          cardId: first.id,
          decision: "snooze",
          expectedVersion: first.version,
          operationId: randomUUID(),
          remindAt: "2026-10-18T20:00:00Z",
        },
        viewer,
        now,
        { policy: p },
      );
      const before = await state(f, "5");
      const custom = focused(["5"], (c) => {
        c.rules.find((r) => r.id === "5")!.parameters = {
          ...c.rules.find((r) => r.id === "5")!.parameters,
          impactDays: 14,
        };
      });
      await evaluateBusiness(f.businessId, now, { policy: custom });
      const after = await state(f, "5");
      expect(after).toMatchObject({
        candidateId: first.id,
        status: "snoozed",
        episodeStartedAt: before.episodeStartedAt,
        expiresAt: before.expiresAt,
        remindAt: before.remindAt,
        decidedAt: before.decidedAt,
      });
      expect((await content(f, "5"))[0].amountMinor).toBe(5000n);
      expect(
        ((await content(f, "5"))[0].parameters as { body: string }).body,
      ).toContain("14");
      await getDb()
        .insert(metrics)
        .values(
          [
            { day: addDays(day, -40), quantity: "2000" },
            { day: addDays(day, 1), quantity: "999999" },
          ].map((r) => ({
            ...r,
            businessId: f.businessId,
            locationId: f.locationId,
            dimensionKind: "product",
            dimensionId: f.product,
            metric: "units_sold",
          })),
        );
      await getDb()
        .update(businesses)
        .set({ timezone: "Pacific/Kiritimati" })
        .where(eq(businesses.id, f.businessId));
      const wider = focused(["5"], (c) => {
        c.rules.find((r) => r.id === "5")!.parameters = {
          ...c.rules.find((r) => r.id === "5")!.parameters,
          salesDays: 56,
          impactDays: 14,
        };
      });
      await evaluateBusiness(f.businessId, now, { policy: wider });
      const rebased = (await content(f, "5"))[0];
      expect(rebased).toMatchObject({
        id: first.id,
        amountMinor: 27500n,
        period: { from: day, to: day },
      });
      expect(await state(f, "5")).toMatchObject({
        status: "snoozed",
        episodeStartedAt: before.episodeStartedAt,
        expiresAt: before.expiresAt,
        remindAt: before.remindAt,
      });
    }, 60000);
    it("records the sixth card's first real exposure in the successful POST, without incrementing its recognized retry", async () => {
      const f = await fixture(),
        p = focused(["6"]);
      const input = await readInput(f.businessId, now, undefined, undefined, p);
      const cards = Array.from({ length: 6 }, (_, i) => ({
        cardKey: "6",
        subjectKey: `product-${i}`,
        sender: "Costos",
        title: `Card${i}`,
        body: "Verificable",
        amountMinor: 1000 - i,
        currencyCode: "USD",
        minorUnit: 2,
        quality: "observed" as const,
        actionKey: null,
        urgency: 1,
        fingerprint: `fp-${i}`,
        weight: 1,
        locationId: null,
        context: {
          kind: "margin",
          calculationKey: "same",
          support: [i],
          negative: true,
          material: `p:${i}`,
        },
      }));
      await withDbTransaction((tx) =>
        syncInboxCandidates(tx, f.businessId, input, cards, now, p),
      );
      const visible = (
        await readInbox(f.businessId, viewer, now, { policy: p })
      ).cards;
      expect(visible).toHaveLength(5);
      const hidden = (
        await getDb()
          .select()
          .from(states)
          .where(eq(states.businessId, f.businessId))
      ).find((s) => !visible.some((c) => c.id === s.candidateId))!;
      expect(hidden.shownDays).toBe(0);
      const command = {
        businessId: f.businessId,
        actorId: actor,
        cardId: visible[0].id,
        decision: "resolve" as const,
        expectedVersion: visible[0].version,
        operationId: randomUUID(),
      };
      const result = await decideInboxCard(command, viewer, now, { policy: p });
      expect(result.cards.some((c) => c.id === hidden.candidateId)).toBe(true);
      expect(
        (
          await getDb()
            .select()
            .from(states)
            .where(eq(states.candidateId, hidden.candidateId))
        )[0].shownDays,
      ).toBe(1);
      await decideInboxCard(command, viewer, now, { policy: p });
      expect(
        (
          await getDb()
            .select()
            .from(states)
            .where(eq(states.candidateId, hidden.candidateId))
        )[0].shownDays,
      ).toBe(1);
    }, 60000);
    it("prunes expired factual and prior-month controls without content while preserving source dedup and metrics", async () => {
      const f = await fixture();
      await seed(f);
      const prior = new Date("2026-06-01T12:00:00Z"),
        expiry = new Date("2026-08-30T12:00:00Z");
      await getDb().insert(sources).values({
        businessId: f.businessId,
        sourceKey: "immutable-fact",
        sourceRevision: 2,
      });
      const controls: {
        cardKey: string;
        subjectKey: string;
        context: AnalyticsContext;
      }[] = [
        {
          cardKey: "9",
          subjectKey: randomUUID(),
          context: {
            observed: {
              kind: "count-gap",
              sourceKey: "immutable-fact",
              sourceRevision: 1,
            },
          },
        },
        {
          cardKey: "12",
          subjectKey: randomUUID(),
          context: {
            factCursor: "2015-06-01T12:00:00.000Z:old",
            observed: {
              kind: "campaign",
              cycle: { startsAt: "2015-01-01", finish: "2015-06-01" },
              sourceKey: "immutable-fact",
              sourceRevision: 2,
            },
          },
        },
        {
          cardKey: "3",
          subjectKey: "2026-06-01",
          context: { observed: { kind: "goal", month: "2026-06-01" } },
        },
      ];
      const activeCampaign = randomUUID();
      await getDb()
        .insert(snapshots)
        .values({
          businessId: f.businessId,
          campaignId: activeCampaign,
          label: "Retired cycle",
          status: "ended",
          startsAt: new Date("2026-05-01T05:00:00Z"),
          endsAt: prior,
          endedAt: prior,
          capturedAt: prior,
          eventId: randomUUID(),
        });
      controls.push({
        cardKey: "12",
        subjectKey: `campaign:${activeCampaign}`,
        context: {
          factCursor: "2026-06-01T12:00:00.000Z:recent",
          observed: {
            kind: "campaign",
            sourceKey: "immutable-fact",
            sourceRevision: 2,
            cycle: { startsAt: "2026-05-01", finish: "2026-06-01" },
            snapshot: {
              capturedAt: prior.toISOString(),
              eventId: "not-history",
            },
            discount: 1234,
            sales: 20000,
          },
        },
      } as (typeof controls)[number]);
      controls.push({
        cardKey: "11",
        subjectKey: randomUUID(),
        context: { legacy: true },
      } as (typeof controls)[number]);
      controls.push({
        cardKey: "12",
        subjectKey: `campaign:${randomUUID()}`,
        context: {
          observed: {
            kind: "campaign",
            sourceKey: "immutable-fact",
            sourceRevision: 2,
            cycle: { startsAt: "2015-01-01", finish: "2015-06-01" },
          },
        },
      } as (typeof controls)[number]);
      await getDb().insert(metrics).values({
        businessId: f.businessId,
        locationId: f.locationId,
        day: "2026-09-01",
        metric: "visits",
        dimensionKind: "customer",
        dimensionId: randomUUID(),
        currencyCode: "USD",
        minorUnit: 2,
        amountMinor: 400n,
        count: 4,
        quantity: "4",
      });
      const ids = controls.map(() => randomUUID());
      await getDb()
        .insert(states)
        .values(
          controls.map((c, i) => ({
            ...c,
            businessId: f.businessId,
            candidateId: ids[i],
            status: "ignored",
            lastShownDay: day,
            fingerprint: "proof",
            policyVersion: ANALYTICS_POLICY.version,
            contextVersion: "v",
            episodeStartedAt: prior,
            expiresAt: expiry,
          })),
        );
      const result = await cleanupInbox(now);
      expect(result.completedAt).not.toBeNull();
      expect(result.eligible).toBeGreaterThanOrEqual(3);
      expect(result.processed).toBeGreaterThanOrEqual(3);
      expect(
        await getDb()
          .select()
          .from(states)
          .where(eq(states.businessId, f.businessId)),
      ).toHaveLength(2);
      const compact = (
        await getDb()
          .select()
          .from(states)
          .where(
            and(
              eq(states.businessId, f.businessId),
              eq(states.subjectKey, `campaign:${activeCampaign}`),
            ),
          )
      )[0];
      expect(compact.context).toEqual({
        compacted: true,
        factCursor: "2026-06-01T12:00:00.000Z:recent",
        observed: {
          kind: "campaign",
          sourceKey: "immutable-fact",
          sourceRevision: 2,
          cycle: { startsAt: "2026-05-01", finish: "2026-06-01" },
          snapshot: { capturedAt: prior.toISOString(), eventId: "not-history" },
        },
      });
      expect(
        await getDb()
          .select()
          .from(sources)
          .where(eq(sources.businessId, f.businessId)),
      ).toHaveLength(1);
      expect(
        await getDb()
          .select()
          .from(metrics)
          .where(eq(metrics.businessId, f.businessId)),
      ).toHaveLength(57);
      const longer = focused(["3", "9", "12"], (c) => {
        c.lifetime.days = 3650;
        c.rules.find((r) => r.id === "12")!.parameters = {
          ...c.rules.find((r) => r.id === "12")!.parameters,
          emissionDelayDays: daysBetween("2026-06-01", day),
        };
      });
      await getDb()
        .update(businesses)
        .set({ timezone: "Pacific/Kiritimati" })
        .where(eq(businesses.id, f.businessId));
      await evaluateBusiness(f.businessId, now, { policy: longer });
      expect(
        await getDb()
          .select()
          .from(states)
          .where(
            and(
              eq(states.businessId, f.businessId),
              sql`${states.cardKey} in ('9','12')`,
            ),
          ),
      ).toHaveLength(2);
      expect(await content(f, "12")).toHaveLength(0);
      const maxDelay = focused(["3", "9", "12"], (c) => {
        c.lifetime.days = 3650;
        c.rules.find((r) => r.id === "12")!.parameters = {
          ...c.rules.find((r) => r.id === "12")!.parameters,
          emissionDelayDays: 3650,
        };
      });
      await getDb()
        .update(businesses)
        .set({ timezone: "Pacific/Pago_Pago" })
        .where(eq(businesses.id, f.businessId));
      await evaluateBusiness(f.businessId, now, { policy: maxDelay });
      expect(await content(f, "12")).toHaveLength(0);
      expect(
        (
          await getDb()
            .select()
            .from(metrics)
            .where(
              and(
                eq(metrics.businessId, f.businessId),
                eq(metrics.metric, "visits"),
              ),
            )
        )[0],
      ).toMatchObject({ count: 4, quantity: "4", amountMinor: 400n });
    }, 60000);
    it("captures recovery intraday even when it arrives after the newer shortage gauge", async () => {
      const f = await fixture();
      await seed(f);
      await getDb()
        .insert(metrics)
        .values(
          Array.from({ length: 40 }, (_, i) => ({
            businessId: f.businessId,
            locationId: f.locationId,
            dimensionKind: "item",
            dimensionId: f.item,
            day: addDays(day, -i - 1),
            metric: "stock_consumption",
            quantity: "10",
          })),
        );
      await getDb()
        .insert(gauges)
        .values({
          businessId: f.businessId,
          locationId: f.locationId,
          dimensionKind: "item",
          dimensionId: f.item,
          day,
          metric: "stock_on_hand",
          quantity: "10",
          unit: "kg",
          observedAt: new Date("2026-10-17T17:00:00Z"),
          eventId: randomUUID(),
        });
      const p = focused(["8"]);
      await sync(f, p);
      const { card } = await close(f, "8", p);
      const shortage: MetricEvent = {
        id: randomUUID(),
        businessId: f.businessId,
        eventType: "stock.adjustment.recorded",
        eventVersion: 1,
        capturedAt: "2026-10-17T19:00:00Z",
        payload: {
          movementId: randomUUID(),
          locationId: f.locationId,
          itemId: f.item,
          itemLabel: "Harina",
          itemUnit: "kg",
          occurredAt: "2026-10-17T19:00:00Z",
          observedAt: "2026-10-17T19:00:00Z",
          onHandAfter: "8",
          quantity: "-92",
          gapAmountMinor: null,
          currencyCode: "USD",
          minorUnit: 2,
        },
      };
      const recovery: MetricEvent = {
        id: randomUUID(),
        businessId: f.businessId,
        eventType: "stock.purchase.recorded",
        eventVersion: 1,
        capturedAt: "2026-10-17T18:30:00Z",
        payload: {
          movementId: randomUUID(),
          locationId: f.locationId,
          itemId: f.item,
          itemLabel: "Harina",
          itemUnit: "kg",
          occurredAt: "2026-10-17T18:30:00Z",
          observedAt: "2026-10-17T18:30:00Z",
          onHandAfter: "100",
          quantity: "90",
          totalCost: null,
          unitCostAfter: null,
          currencyCode: "USD",
          minorUnit: 2,
        },
      };
      vi.setSystemTime(new Date("2026-10-17T19:30:00Z"));
      await withDbTransaction((tx) => applyAnalyticsEvent(tx, shortage, p));
      expect(await content(f, "8")).toHaveLength(0);
      await withDbTransaction((tx) => applyAnalyticsEvent(tx, recovery, p));
      expect((await content(f, "8"))[0].id).toBe(card.id);
      const gauge = (
        await getDb()
          .select()
          .from(gauges)
          .where(eq(gauges.businessId, f.businessId))
      )[0];
      expect(gauge).toMatchObject({ quantity: "8", eventId: shortage.id });
      expect((await state(f, "8")).context).toMatchObject({
        stockEvidence: {
          recovery: { at: "2026-10-17T18:30:00.000Z", quantity: "100" },
          gauge: { at: "2026-10-17T19:00:00.000Z", quantity: "8" },
        },
      });
    }, 60000);
    it("retains real consumption evidence while disabled, without emitting until enabled again", async () => {
      const f = await fixture();
      await seed(f);
      await getDb()
        .insert(metrics)
        .values(
          Array.from({ length: 40 }, (_, i) => ({
            businessId: f.businessId,
            locationId: f.locationId,
            dimensionKind: "item",
            dimensionId: f.item,
            day: addDays(day, -i - 1),
            metric: "stock_consumption",
            quantity: "10",
          })),
        );
      await getDb()
        .insert(gauges)
        .values({
          businessId: f.businessId,
          locationId: f.locationId,
          dimensionKind: "item",
          dimensionId: f.item,
          day,
          metric: "stock_on_hand",
          quantity: "10",
          unit: "kg",
          observedAt: new Date("2026-10-17T17:00:00Z"),
          eventId: randomUUID(),
        });
      const p = focused(["8"]);
      await sync(f, p);
      const { card } = await close(f, "8", p);
      const off = focused([]);
      await sync(f, off);
      const event: MetricEvent = {
        id: randomUUID(),
        businessId: f.businessId,
        eventType: "recipes.consumption.applied",
        eventVersion: 1,
        capturedAt: "2026-10-17T18:30:00Z",
        payload: {
          sourceOrderId: randomUUID(),
          locationId: f.locationId,
          closedAt: "2026-10-15T12:00:00Z",
          observedAt: "2026-10-17T18:30:00Z",
          lines: [],
          items: [
            {
              itemId: f.item,
              itemLabel: "Harina",
              itemUnit: "kg",
              quantity: "2",
              onHandAfter: "8",
            },
          ],
        },
      };
      vi.setSystemTime(new Date("2026-10-17T19:00:00Z"));
      await withDbTransaction((tx) => applyAnalyticsEvent(tx, event, off));
      expect(await content(f, "8")).toHaveLength(0);
      expect((await state(f, "8")).status).toBe("ignored");
      await sync(f, p, new Date("2026-10-17T19:00:00Z"));
      expect((await content(f, "8"))[0].id).toBe(card.id);
      expect((await state(f, "8")).status).toBe("open");
    }, 60000);
    it("recovers a real applied legacy fact older than90days and shortens retention without renewing content or reminders", async () => {
      const f = await fixture();
      await seed(f);
      const eventId = randomUUID(),
        movementId = randomUUID(),
        id = randomUUID(),
        origin = "2026-06-01T12:00:00.000Z",
        expiry = new Date("2026-08-30T12:00:00.000Z"),
        subject = `${eventId}:${f.item}`;
      await getDb()
        .insert(moduleEvents)
        .values({
          id: eventId,
          businessId: f.businessId,
          eventType: "stock.adjustment.recorded",
          eventVersion: 1,
          sourceId: movementId,
          locationId: f.locationId,
          createdAt: now,
          payload: {
            eventVersion: 1,
            movementId,
            itemId: f.item,
            itemLabel: "Harina",
            itemUnit: "kg",
            locationId: f.locationId,
            occurredAt: origin,
            observedAt: origin,
            quantity: "-5",
            onHandAfter: "0",
            countedQuantity: "0",
            theoreticalQuantity: "5",
            unitCost: "100",
            gapAmountMinor: "-50000",
            currencyCode: "USD",
            minorUnit: 2,
          },
        });
      await getDb()
        .insert(moduleEventDeliveries)
        .values({
          eventId,
          subscriberId: "core.analytics",
          state: "applied",
          appliedAt: now,
        });
      await getDb()
        .insert(sources)
        .values({
          businessId: f.businessId,
          sourceKey: `stock.adjustment.recorded:${movementId}`,
          sourceRevision: 1,
        });
      await getDb()
        .insert(metrics)
        .values({
          businessId: f.businessId,
          locationId: f.locationId,
          day: "2026-06-01",
          metric: "stock_count_gap",
          dimensionKind: "item",
          dimensionId: f.item,
          currencyCode: "USD",
          minorUnit: 2,
          amountMinor: -50000n,
          quantity: "-5",
          count: 1,
        });
      await getDb()
        .insert(states)
        .values({
          businessId: f.businessId,
          cardKey: "9",
          subjectKey: subject,
          candidateId: id,
          status: "open",
          fingerprint: "legacy",
          context: { legacy: true },
          contextVersion: "legacy",
          policyVersion: "legacy",
          episodeStartedAt: now,
          expiresAt: new Date(now.getTime() + 90 * 86400000),
          remindAt: new Date(now.getTime() + 86400000),
          lastShownDay: day,
          shownDays: 2,
          revision: 3,
        });
      await getDb()
        .insert(candidates)
        .values({
          id,
          businessId: f.businessId,
          cardKey: "9",
          subjectKey: subject,
          day,
          weight: "3",
          amountMinor: 50000n,
          currencyCode: "USD",
          minorUnit: 2,
          fingerprint: "legacy",
          category: "informational",
          contextVersion: "legacy",
          policyVersion: "legacy",
          episodeStartedAt: now,
          expiresAt: new Date(now.getTime() + 90 * 86400000),
          period: { from: day, to: day, label: "Legacy" },
          parameters: {
            cardKey: "9",
            subjectKey: subject,
            sender: "Stock",
            title: "Legacy count",
            body: "Prior copy",
            amountMinor: 50000,
            currencyCode: "USD",
            minorUnit: 2,
            quality: "observed",
            actionKey: null,
            urgency: 1,
            weight: 3,
            fingerprint: "legacy",
            locationId: f.locationId,
          },
        });
      const p = focused(["9"], (c) => {
        c.rules.find((r) => r.id === "9")!.parameters = {
          ...c.rules.find((r) => r.id === "9")!.parameters,
          ageDecay: 1,
        };
      });
      expect(await evaluateBusiness(f.businessId, now, { policy: p })).toBe(
        true,
      );
      expect(await state(f, "9")).toMatchObject({
        candidateId: id,
        status: "expired",
        episodeStartedAt: new Date(origin),
        expiresAt: expiry,
        remindAt: null,
        revision: 3,
      });
      expect(await content(f, "9")).toHaveLength(0);
      expect(
        (await readInbox(f.businessId, viewer, now, { policy: p })).cards,
      ).toHaveLength(0);
      expect(
        await getDb()
          .select()
          .from(metrics)
          .where(
            and(
              eq(metrics.businessId, f.businessId),
              eq(metrics.metric, "stock_count_gap"),
            ),
          ),
      ).toMatchObject([{ amountMinor: -50000n, quantity: "-5", count: 1 }]);
    }, 60000);
    it("reopens12 only for a new real applied campaign cycle, carries real coupons once, and keeps late money closed", async () => {
      const f = await fixture();
      await seed(f);
      const p = focused(["12"]),
        campaignId = randomUUID();
      const snapshot = (
        capturedAt: string,
        startsAt: string,
        endsAt: string,
      ): MetricEvent => ({
        id: randomUUID(),
        businessId: f.businessId,
        eventType: "campaign.snapshot",
        eventVersion: 1,
        capturedAt,
        payload: {
          campaignId,
          label: "Promo",
          status: "ended",
          startsAt,
          endsAt,
          endedAt: endsAt,
          capturedAt,
        },
      });
      const a = snapshot(
        "2026-10-16T14:00:00Z",
        "2026-10-01T05:00:00Z",
        "2026-10-16T13:00:00Z",
      );
      await withDbTransaction((tx) => applyAnalyticsEvent(tx, a, p));
      const first = (await readInbox(f.businessId, viewer, now, { policy: p }))
        .cards[0];
      expect(first).toBeDefined();
      await close(f, "12", p, "seen");
      const old = await state(f, "12");
      const b = snapshot(
          "2026-10-19T14:00:00Z",
          "2026-10-18T05:00:00Z",
          "2026-10-19T13:00:00Z",
        ),
        later = new Date("2026-10-20T18:00:00Z");
      vi.setSystemTime(later);
      await withDbTransaction((tx) => applyAnalyticsEvent(tx, b, p));
      const reopened = await state(f, "12");
      expect(reopened).toMatchObject({
        candidateId: first.id,
        status: "open",
        episodeStartedAt: new Date("2026-10-19T13:00:00Z"),
        decidedAt: null,
      });
      expect(reopened.episodeStartedAt.getTime()).toBeGreaterThan(
        old.episodeStartedAt.getTime(),
      );
      const coupon = (
        discountMinor: string,
        salesMinor: string,
      ): MetricEvent => ({
        id: randomUUID(),
        businessId: f.businessId,
        eventType: "coupon.redeemed",
        eventVersion: 1,
        capturedAt: later.toISOString(),
        payload: {
          eventVersion: 1,
          couponId: randomUUID(),
          orderId: randomUUID(),
          campaignId,
          campaignLabel: "Promo",
          locationId: f.locationId,
          occurredAt: "2026-10-19T12:00:00Z",
          discountMinor,
          salesMinor,
          costMinor: "1000",
          currencyCode: "USD",
          minorUnit: 2,
        },
      });
      const canje = coupon("5000", "20000");
      await withDbTransaction((tx) => applyAnalyticsEvent(tx, canje, p));
      expect((await content(f, "12"))[0]).toMatchObject({
        id: first.id,
        amountMinor: 5000n,
        episodeStartedAt: reopened.episodeStartedAt,
        expiresAt: reopened.expiresAt,
      });
      await withDbTransaction((tx) => applyAnalyticsEvent(tx, a, p));
      await withDbTransaction((tx) => applyAnalyticsEvent(tx, canje, p));
      expect((await content(f, "12"))[0]).toMatchObject({
        id: first.id,
        amountMinor: 5000n,
      });
      expect(
        (
          await getDb()
            .select()
            .from(snapshots)
            .where(eq(snapshots.businessId, f.businessId))
        )[0].eventId,
      ).toBe(b.id);
      const shown = (
        await readInbox(f.businessId, viewer, later, { policy: p })
      ).cards[0];
      expect(shown.id).toBe(first.id);
      await decideInboxCard(
        {
          businessId: f.businessId,
          actorId: actor,
          cardId: shown.id,
          decision: "seen",
          expectedVersion: shown.version,
          operationId: randomUUID(),
        },
        viewer,
        later,
        { policy: p },
      );
      await withDbTransaction((tx) =>
        applyAnalyticsEvent(tx, coupon("1000", "4000"), p),
      );
      expect(await content(f, "12")).toHaveLength(0);
      expect((await state(f, "12")).status).toBe("seen");
      expect(
        (
          await getDb()
            .select()
            .from(metrics)
            .where(
              and(
                eq(metrics.businessId, f.businessId),
                eq(metrics.metric, "promo_discount"),
              ),
            )
        )[0],
      ).toMatchObject({ amountMinor: 6000n, count: 2 });
    }, 90000);
  },
);
