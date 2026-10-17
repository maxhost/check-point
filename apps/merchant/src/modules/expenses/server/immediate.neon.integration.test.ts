import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  analyticsDailyMetrics,
  analyticsMetricContributions,
  analyticsSourceRevisions,
  expenses,
  moduleEvents,
  moduleEventDeliveries,
} from "@mi-pasaporte/db/schema";
const scheduled = vi.hoisted(() => ({
  callbacks: [] as (() => Promise<void>)[],
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (callback: () => Promise<void>) => scheduled.callbacks.push(callback),
}));
import { modulesIntegrationEnabled } from "../../modules-integration-support";
import { captureCountCut, validateCountCut } from "../../stock/count";
import { publishSaleClosed } from "../../../server/module-events";
import { createExpenses } from "./writers";
import { useExpenseWorld } from "./integration-support";
import type { Expense } from "../types";

describe.runIf(modulesIntegrationEnabled)(
  "0237 expenses immediate delivery",
  { timeout: 120000 },
  () => {
    const f = useExpenseWorld();
    const expenseEvents = (businessId: string, revisionId: string) =>
      getDb()
        .select()
        .from(moduleEvents)
        .where(
          and(
            eq(moduleEvents.businessId, businessId),
            eq(moduleEvents.sourceId, revisionId),
          ),
        );
    async function metrics(businessId = f.world.businessId) {
      return getDb()
        .select()
        .from(analyticsDailyMetrics)
        .where(eq(analyticsDailyMetrics.businessId, businessId));
    }
    async function source(id: string) {
      return getDb()
        .select()
        .from(analyticsSourceRevisions)
        .where(
          and(
            eq(analyticsSourceRevisions.businessId, f.world.businessId),
            eq(analyticsSourceRevisions.sourceKey, `expense:${id}`),
          ),
        );
    }
    async function core(eventId: string) {
      const rows = await getDb()
        .select()
        .from(moduleEventDeliveries)
        .where(
          and(
            eq(moduleEventDeliveries.eventId, eventId),
            eq(moduleEventDeliveries.subscriberId, "core.analytics"),
          ),
        );
      expect(rows).toHaveLength(1);
      return rows[0]!;
    }
    async function flush() {
      expect(scheduled.callbacks).toHaveLength(1);
      await scheduled.callbacks.shift()!();
      expect(scheduled.callbacks).toHaveLength(0);
    }

    it("commits authenticated create/update/delete before after, applies exact summaries once and preserves tenant/subscriber/Stock scope", async () => {
      scheduled.callbacks = [];
      const foreign = (
        await createExpenses(
          f.other.businessId,
          f.other.ownerId,
          f.post([
            f.line({
              locationId: f.other.locationId,
              amountMinor: "900",
              paidOn: "2026-10-01",
            }),
          ]),
        )
      ).expenses[0]!;
      const foreignEvents = await expenseEvents(
        f.other.businessId,
        foreign.revisionId,
      );
      expect(foreignEvents).toHaveLength(1);
      const foreignDelivery = await core(foreignEvents[0]!.id);
      expect(foreignDelivery.state).toBe("pending");
      const sale = await withDbTransaction((tx) =>
        publishSaleClosed(tx, {
          businessId: f.world.businessId,
          sourceOrderId: randomUUID(),
          locationId: f.world.locationId,
          userId: f.world.ownerId,
          closedAt: new Date("2026-10-01T15:00:00Z"),
          capture: {
            captured_at: "2026-10-01T15:00:00Z",
            versions: [],
            enabled: [],
          },
          lines: [{ sourceLineId: randomUUID(), productId: null, quantity: 1 }],
        }),
      );
      const saleDeliveries = await getDb()
        .select()
        .from(moduleEventDeliveries)
        .where(eq(moduleEventDeliveries.eventId, sale.eventId));
      expect(
        saleDeliveries.find((row) => row.subscriberId === "core.analytics")
          ?.state,
      ).toBe("pending");
      const cut = await captureCountCut(f.world.businessId, f.world.locationId);
      expect(cut).toEqual([sale.eventId]);
      const cutUnchanged = async () => {
        expect(
          await captureCountCut(f.world.businessId, f.world.locationId),
        ).toEqual(cut);
        await withDbTransaction((tx) =>
          validateCountCut(tx, f.world.businessId, f.world.locationId, cut),
        );
      };
      await cutUnchanged();
      const body = {
        ...f.post([
          f.line({
            amountMinor: "12345",
            paidOn: "2026-10-01",
            isFixed: true,
            conceptName: "Alquiler",
          }),
        ]),
        businessId: f.other.businessId,
      };
      const created = await f.api("POST", f.world.cookie, "entries", body);
      expect(created.status).toBe(201);
      const result = (await created.json()) as { expenses: Expense[] };
      const expense = result.expenses[0]!;
      expect(result.expenses).toHaveLength(1);
      expect(expense).toMatchObject({
        revision: 1,
        amountMinor: "12345",
        createdByUserId: f.world.ownerId,
        locationId: f.world.locationId,
      });
      expect(
        (
          await getDb()
            .select()
            .from(expenses)
            .where(eq(expenses.id, expense.id))
        )[0],
      ).toMatchObject({ businessId: f.world.businessId, revision: 1 });
      const [recorded] = await f.eventsFor(expense.id);
      expect(recorded).toMatchObject({
        businessId: f.world.businessId,
        eventType: "expense.recorded",
        locationId: f.world.locationId,
        payload: { revision: 1, amountMinor: "12345" },
      });
      expect((await core(recorded!.id)).state).toBe("pending");
      expect(await metrics()).toEqual([]);
      expect(await source(expense.id)).toEqual([]);
      const [transport] = await getDb()
        .insert(moduleEventDeliveries)
        .values({ eventId: recorded!.id, subscriberId: "transport-fixture" })
        .returning();
      await cutUnchanged();
      await flush();
      expect(await core(recorded!.id)).toMatchObject({
        state: "applied",
        attempts: 1,
      });
      expect(await metrics()).toMatchObject([
        {
          metric: "expense_fixed",
          day: "2026-10-01",
          locationId: f.world.locationId,
          dimensionId: expense.conceptId,
          amountMinor: 12345n,
          currencyCode: "USD",
          minorUnit: 2,
        },
      ]);
      expect(await source(expense.id)).toMatchObject([{ sourceRevision: 1 }]);

      const replay = await f.api("POST", f.world.cookie, "entries", body);
      expect(replay.status).toBe(201);
      expect(await replay.json()).toEqual(result);
      expect(await f.eventsFor(expense.id)).toHaveLength(1);
      await flush();
      expect(await core(recorded!.id)).toMatchObject({
        state: "applied",
        attempts: 1,
      });
      expect((await metrics())[0]!.amountMinor).toBe(12345n);

      const edit = {
        ...f.line({
          amountMinor: "23456",
          paidOn: "2026-10-02",
          isFixed: false,
          locationId: null,
          conceptName: "Luz",
          category: "electricity",
        }),
        operationId: randomUUID(),
        expectedRevision: 1,
        expectedCurrencyCode: "USD",
      };
      const denied = await f.api(
        "PUT",
        f.other.cookie,
        `entries/${expense.id}`,
        edit,
      );
      expect(denied.status).toBe(404);
      expect(await denied.json()).toMatchObject({ code: "expense_not_found" });
      expect(scheduled.callbacks).toHaveLength(0);
      const updated = await f.api(
        "PUT",
        f.world.cookie,
        `entries/${expense.id}`,
        edit,
      );
      expect(updated.status).toBe(200);
      const changed = ((await updated.json()) as { expense: Expense }).expense;
      expect(changed).toMatchObject({
        id: expense.id,
        revision: 2,
        amountMinor: "23456",
        locationId: null,
      });
      const events = await f.eventsFor(expense.id);
      expect(events).toHaveLength(2);
      const changeEvent = events.find(
        (row) => row.eventType === "expense.updated",
      )!;
      expect((await core(changeEvent.id)).state).toBe("pending");
      expect(
        (await metrics()).reduce((total, row) => total + row.amountMinor, 0n),
      ).toBe(12345n);
      expect(await source(expense.id)).toMatchObject([{ sourceRevision: 1 }]);
      await cutUnchanged();
      await flush();
      expect((await core(changeEvent.id)).state).toBe("applied");
      const changedRows = await metrics();
      expect(changedRows.filter((row) => row.amountMinor !== 0n)).toMatchObject(
        [
          {
            metric: "expense_variable",
            day: "2026-10-02",
            locationId: null,
            dimensionId: changed.conceptId,
            amountMinor: 23456n,
          },
        ],
      );
      expect(
        changedRows.find((row) => row.metric === "expense_fixed")?.amountMinor,
      ).toBe(0n);
      expect(await source(expense.id)).toMatchObject([{ sourceRevision: 2 }]);

      const deletion = { operationId: randomUUID(), expectedRevision: 2 };
      const deleted = await f.api(
        "DELETE",
        f.world.cookie,
        `entries/${expense.id}`,
        deletion,
      );
      expect(deleted.status).toBe(200);
      const tombstone = ((await deleted.json()) as { expense: Expense })
        .expense;
      expect(tombstone).toMatchObject({
        id: expense.id,
        revision: 3,
        deletedAt: expect.any(String),
      });
      const finalEvents = await f.eventsFor(expense.id);
      expect(finalEvents.map((row) => row.eventType)).toEqual([
        "expense.recorded",
        "expense.updated",
        "expense.deleted",
      ]);
      const deletionEvent = finalEvents[2]!;
      expect((await core(deletionEvent.id)).state).toBe("pending");
      expect(
        (await metrics()).reduce((total, row) => total + row.amountMinor, 0n),
      ).toBe(23456n);
      await cutUnchanged();
      await flush();
      expect((await core(deletionEvent.id)).state).toBe("applied");
      expect((await metrics()).every((row) => row.amountMinor === 0n)).toBe(
        true,
      );
      expect(await source(expense.id)).toMatchObject([{ sourceRevision: 3 }]);
      expect(
        await getDb()
          .select()
          .from(analyticsMetricContributions)
          .where(
            and(
              eq(analyticsMetricContributions.businessId, f.world.businessId),
              eq(
                analyticsMetricContributions.sourceKey,
                `expense:${expense.id}`,
              ),
            ),
          ),
      ).toEqual([]);
      const deletedReplay = await f.api(
        "DELETE",
        f.world.cookie,
        `entries/${expense.id}`,
        deletion,
      );
      expect(deletedReplay.status).toBe(200);
      expect((await deletedReplay.json()).expense).toEqual(tombstone);
      await flush();
      expect(await f.eventsFor(expense.id)).toHaveLength(3);
      expect((await metrics()).every((row) => row.amountMinor === 0n)).toBe(
        true,
      );
      expect(await core(foreignEvents[0]!.id)).toEqual(foreignDelivery);
      expect(await metrics(f.other.businessId)).toEqual([]);
      expect(
        await getDb()
          .select()
          .from(moduleEventDeliveries)
          .where(eq(moduleEventDeliveries.eventId, sale.eventId)),
      ).toEqual(saleDeliveries);
      expect(
        (
          await getDb()
            .select()
            .from(moduleEventDeliveries)
            .where(eq(moduleEventDeliveries.id, transport!.id))
        )[0],
      ).toEqual(transport);
      await cutUnchanged();
    });
  },
);
