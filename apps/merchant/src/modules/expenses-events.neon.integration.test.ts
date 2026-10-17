import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  expenses,
  expenseRevisions,
  moduleEvents,
  moduleEventDeliveries,
} from "@mi-pasaporte/db/schema";
import { modulesIntegrationEnabled } from "./modules-integration-support";
import { createExpenses } from "./expenses/server/writers";

import { captureCountCut, validateCountCut } from "./stock/count";
import {
  appendModuleEvent,
  pendingSummary,
  retryModuleEvents,
} from "../server/module-events";

import { useExpenseWorld } from "./expenses/server/integration-support";
const run = modulesIntegrationEnabled ? describe : describe.skip;
run("0236 expenses-events.neon.integration.test.ts", { timeout: 60000 }, () => {
  const f = useExpenseWorld();
  const { line, post, eventsFor } = f;
  it("real DB constraints reject nonfinite money, tenant/category references and sale without local", async () => {
    const own = (
      await createExpenses(f.world.businessId, f.world.ownerId, post([line()]))
    ).expenses[0];
    const foreign = (
      await createExpenses(
        f.other.businessId,
        f.other.ownerId,
        post([line({ locationId: null })]),
      )
    ).expenses[0];
    for (const change of [
      { amountMinor: "NaN" },
      { amountMinor: "Infinity" },
      { amountMinor: "-1" },
      { amountMinor: "0" },
      { paidOn: "infinity" },
      { locationId: f.other.locationId },
      { conceptId: foreign.conceptId },
      { category: "water" },
    ])
      await expect(
        getDb().update(expenses).set(change).where(eq(expenses.id, own.id)),
      ).rejects.toBeDefined();
    await expect(
      getDb()
        .update(expenseRevisions)
        .set({ revision: 9 })
        .where(eq(expenseRevisions.id, own.revisionId)),
    ).rejects.toBeDefined();
    await expect(
      getDb()
        .delete(expenseRevisions)
        .where(eq(expenseRevisions.id, own.revisionId)),
    ).rejects.toBeDefined();
    await expect(
      getDb().insert(moduleEvents).values({
        businessId: f.world.businessId,
        eventType: "sale.closed",
        eventVersion: 1,
        sourceId: randomUUID(),
        locationId: null,
        payload: {},
      }),
    ).rejects.toBeDefined();
  });
  it("local and global expense events do not affect sale cuts or pending consumption filters", async () => {
    const cut = await captureCountCut(f.world.businessId, f.world.locationId);
    const pendingAtCut = await pendingSummary(
      f.world.businessId,
      f.world.locationId,
    );
    const rows = (
      await createExpenses(
        f.world.businessId,
        f.world.ownerId,
        post([
          line({ locationId: f.world.locationId }),
          line({ locationId: null }),
        ]),
      )
    ).expenses;
    expect(
      await captureCountCut(f.world.businessId, f.world.locationId),
    ).toEqual(cut);
    await withDbTransaction((tx) =>
      validateCountCut(tx, f.world.businessId, f.world.locationId, cut),
    );
    const [event] = await eventsFor(rows[0].id);
    // A generic transport fixture is deliberately unrelated to consumption.
    await getDb()
      .insert(moduleEventDeliveries)
      .values({ eventId: event.id, subscriberId: "transport-fixture" });
    expect(
      await pendingSummary(f.world.businessId, f.world.locationId, [
        "sale.closed",
      ]),
    ).toEqual({ count: 0, failed: 0 });
    expect(
      (await pendingSummary(f.world.businessId, f.world.locationId)).count,
      // AN-1 adds one core delivery for the local expense; the global expense has no local.
      // Together with the transport fixture this increases the preexisting local backlog by two.
    ).toBe(pendingAtCut.count + 2);
    expect(
      await retryModuleEvents({
        businessId: f.world.businessId,
        eventTypes: ["sale.closed"],
        force: true,
      }),
    ).toEqual({ claimed: 0, applied: 0, pending: 0, failed: 0 });
    await withDbTransaction((tx) =>
      validateCountCut(tx, f.world.businessId, f.world.locationId, cut),
    );
    await getDb()
      .delete(moduleEventDeliveries)
      .where(eq(moduleEventDeliveries.eventId, event.id));
    await expect(
      withDbTransaction((tx) =>
        appendModuleEvent(tx, {
          businessId: f.world.businessId,
          eventType: "probe.recorded",
          eventVersion: 2,
          sourceId: randomUUID(),
          locationId: null,
          payload: { eventVersion: 1 },
        }),
      ),
    ).rejects.toThrow("Invalid module event envelope");
  });
});
