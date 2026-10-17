import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { businesses, moduleEventDeliveries } from "@mi-pasaporte/db/schema";
import { modulesIntegrationEnabled } from "../../modules-integration-support";
import { createExpenses, mutateExpense } from "./writers";
import { listExpenses } from "./queries";

import type { Expense } from "../types";
import { useExpenseWorld } from "./integration-support";
const run = modulesIntegrationEnabled ? describe : describe.skip;
run("0236 expenses.neon.integration.test.ts", { timeout: 60000 }, () => {
  const f = useExpenseWorld();
  const { line, post, api, eventsFor } = f;
  it("batch is exact, global null is explicit and concept identity is stable across concurrent payments", async () => {
    const body = post([
      line(),
      line({
        conceptName: "  ＬＵＩＳ  ",
        locationId: null,
        amountMinor: "320",
      }),
    ]);
    const response = await api("POST", f.world.cookie, "entries", body);
    expect(response.status).toBe(201);
    const result = (await response.json()) as { expenses: Expense[] };
    expect(result.expenses).toHaveLength(2);
    expect(result.expenses[0]).toMatchObject({
      amountMinor: "900719925474099301",
      paidOn: "2025-12-31",
      paymentTimeZone: expect.any(String),
      minorUnit: 2,
      createdByUserId: f.world.ownerId,
      isFixed: false,
    });
    expect(result.expenses[1]).toMatchObject({
      conceptId: result.expenses[0].conceptId,
      locationId: null,
      amountMinor: "320",
    });
    expect(
      await createExpenses(f.world.businessId, f.world.ownerId, body),
    ).toEqual(result);
    await expect(
      createExpenses(f.world.businessId, f.world.ownerId, {
        ...body,
        lines: [line({ amountMinor: "321" })],
      }),
    ).rejects.toMatchObject({ code: "operation_conflict" });
    const concurrent = await Promise.all([
      createExpenses(
        f.world.businessId,
        f.world.ownerId,
        post([line({ conceptName: "Agua", category: "water" })]),
      ),
      createExpenses(
        f.world.businessId,
        f.world.ownerId,
        post([line({ conceptName: "AGUA", category: "water" })]),
      ),
    ]);
    expect(concurrent[0].expenses[0].conceptId).toBe(
      concurrent[1].expenses[0].conceptId,
    );
    const recorded = await eventsFor(result.expenses[0].id);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      eventType: "expense.recorded",
      sourceId: result.expenses[0].revisionId,
      eventVersion: 1,
    });
    expect(
      await getDb()
        .select()
        .from(moduleEventDeliveries)
        .where(eq(moduleEventDeliveries.eventId, recorded[0].id)),
    ).toEqual([]);
    expect(
      await listExpenses(
        f.world.businessId,
        new URLSearchParams(
          "from=2025-12-01&to=2025-12-31&locationId=business",
        ),
      ),
    ).toEqual([result.expenses[1]]);
  });
  it("two historical edits and deletion retain complete independent snapshots and replay older results after later changes", async () => {
    const originalBody = post([
      line({ amountMinor: "45000", locationId: null }),
    ]);
    const original = (
      await createExpenses(f.world.businessId, f.world.ownerId, originalBody)
    ).expenses[0];
    const editBody = {
      operationId: randomUUID(),
      expectedRevision: 1,
      expectedCurrencyCode: "USD",
      ...line({
        paidOn: "2024-02-29",
        amountMinor: "46000",
        conceptName: "Luis horas extras",
        locationId: f.world.locationId,
      }),
    };
    const first = (
      await mutateExpense(
        f.world.businessId,
        f.world.ownerId,
        original.id,
        "updated",
        editBody,
      )
    ).expense;
    await getDb()
      .update(businesses)
      .set({ currencyCode: "COP", timezone: "Asia/Tokyo" })
      .where(eq(businesses.id, f.world.businessId));
    try {
      const second = (
        await mutateExpense(
          f.world.businessId,
          f.world.ownerId,
          original.id,
          "updated",
          {
            ...editBody,
            operationId: randomUUID(),
            expectedRevision: 2,
            name: "Horas extras corregidas",
          },
        )
      ).expense;
      expect(second).toMatchObject({
        revision: 3,
        currencyCode: "USD",
        minorUnit: 2,
        paymentTimeZone: original.paymentTimeZone,
        createdByUserId: f.world.ownerId,
      });
      expect(
        new Set([original.revisionId, first.revisionId, second.revisionId])
          .size,
      ).toBe(3);
      expect(
        (
          await mutateExpense(
            f.world.businessId,
            f.world.ownerId,
            original.id,
            "updated",
            editBody,
          )
        ).expense,
      ).toEqual(first);
      expect(
        (
          await createExpenses(
            f.world.businessId,
            f.world.ownerId,
            originalBody,
          )
        ).expenses[0],
      ).toEqual(original);
      await expect(
        mutateExpense(
          f.world.businessId,
          f.world.ownerId,
          original.id,
          "updated",
          { ...editBody, operationId: randomUUID() },
        ),
      ).rejects.toMatchObject({ code: "expense_conflict" });
      const deletion = { operationId: randomUUID(), expectedRevision: 3 };
      const tombstone = (
        await mutateExpense(
          f.world.businessId,
          f.world.ownerId,
          original.id,
          "deleted",
          deletion,
        )
      ).expense;
      expect(tombstone).toMatchObject({
        ...second,
        revision: 4,
        revisionId: expect.any(String),
        updatedAt: expect.any(String),
        deletedAt: expect.any(String),
      });
      expect(
        (
          await mutateExpense(
            f.world.businessId,
            f.world.ownerId,
            original.id,
            "deleted",
            deletion,
          )
        ).expense,
      ).toEqual(tombstone);
      const history = await eventsFor(original.id);
      expect(history.map((e) => e.eventType)).toEqual([
        "expense.recorded",
        "expense.updated",
        "expense.updated",
        "expense.deleted",
      ]);
      expect(new Set(history.map((e) => e.sourceId)).size).toBe(4);
      const { id: expenseId, ...snapshot } = tombstone;
      expect(history[3].payload).toMatchObject({
        ...snapshot,
        expenseId,
        eventVersion: 1,
        operationId: deletion.operationId,
        lineIndex: 0,
      });
      expect(
        (await listExpenses(f.world.businessId, new URLSearchParams())).some(
          (e) => e.id === original.id,
        ),
      ).toBe(false);
    } finally {
      await getDb()
        .update(businesses)
        .set({ currencyCode: "USD", timezone: original.paymentTimeZone })
        .where(eq(businesses.id, f.world.businessId));
    }
  });
  it("concurrent identical operation commits one revision; concurrent edits serialize the expected revision", async () => {
    const body = post([line({ amountMinor: "100" })]);
    const results = await Promise.all([
      createExpenses(f.world.businessId, f.world.ownerId, body),
      createExpenses(f.world.businessId, f.world.ownerId, body),
    ]);
    expect(results[0]).toEqual(results[1]);
    const expense = results[0].expenses[0];
    expect(await eventsFor(expense.id)).toHaveLength(1);
    const edit = {
      ...line({ amountMinor: "200" }),
      expectedRevision: 1,
      expectedCurrencyCode: "USD",
    };
    const edited = await Promise.allSettled([
      mutateExpense(
        f.world.businessId,
        f.world.ownerId,
        expense.id,
        "updated",
        { ...edit, operationId: randomUUID() },
      ),
      mutateExpense(
        f.world.businessId,
        f.world.ownerId,
        expense.id,
        "updated",
        { ...edit, operationId: randomUUID() },
      ),
    ]);
    expect(
      edited.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = edited.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({ reason: { code: "expense_conflict" } });
    expect(await eventsFor(expense.id)).toHaveLength(2);
  });
});
