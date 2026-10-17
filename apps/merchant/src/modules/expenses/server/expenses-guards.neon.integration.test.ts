import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { locations } from "@mi-pasaporte/db/schema";
import {
  enableModules,
  moduleStaff,
  modulesIntegrationEnabled,
} from "../../modules-integration-support";
import { createExpenses, mutateExpense } from "./writers";
import { getContext } from "./queries";

import type { ExpenseLine } from "../types";
import { useExpenseWorld } from "./integration-support";
const run = modulesIntegrationEnabled ? describe : describe.skip;
run("0236 expenses-guards.neon.integration.test.ts", { timeout: 60000 }, () => {
  const f = useExpenseWorld();
  const { line, post, api } = f;
  it("owner and expenses staff access API; unrelated permission, disabled module and foreign objects fail without leakage", async () => {
    const staff = await moduleStaff(f.world, ["expenses"]);
    const staffId = f.world.users.at(-1);
    const denied = await moduleStaff(f.world, ["staff"]);
    for (const path of ["context", "concepts", "entries"]) {
      expect((await api("GET", staff, path)).status).toBe(200);
      const no = await api("GET", denied, path);
      expect(no.status).toBe(403);
      expect(await no.json()).toMatchObject({ code: "missing_permission" });
    }
    const staffBody = post([line({ amountMinor: "100" })]);
    const staffWrite = await api("POST", staff, "entries", staffBody);
    expect(staffWrite.status).toBe(201);
    expect((await staffWrite.json()).expenses[0]).toMatchObject({
      createdByUserId: staffId,
      amountMinor: "100",
    });
    const forbiddenWrite = await api("POST", denied, "entries", post([line()]));
    expect(forbiddenWrite.status).toBe(403);
    expect(await forbiddenWrite.json()).toMatchObject({
      code: "missing_permission",
    });
    expect((await api("POST", "", "entries", post([line()]))).status).toBe(401);
    const foreign = (
      await createExpenses(
        f.other.businessId,
        f.other.ownerId,
        post([
          line({ locationId: f.other.locationId, conceptName: "Privado" }),
        ]),
      )
    ).expenses[0];
    const foreignEdit = await api(
      "PUT",
      f.world.cookie,
      `entries/${foreign.id}`,
      {
        ...line(),
        operationId: randomUUID(),
        expectedRevision: 1,
        expectedCurrencyCode: "USD",
      },
    );
    expect(foreignEdit.status).toBe(404);
    expect(await foreignEdit.json()).toMatchObject({
      code: "expense_not_found",
    });
    const ownList = await api("GET", f.world.cookie, "entries");
    expect(ownList.status).toBe(200);
    expect(
      (await ownList.json()).expenses.some(
        (expense: { id: string }) => expense.id === foreign.id,
      ),
    ).toBe(false);
    const notFound = await api(
      "DELETE",
      f.world.cookie,
      `entries/${foreign.id}`,
      { operationId: randomUUID(), expectedRevision: 1 },
    );
    expect(notFound.status).toBe(404);
    expect(await notFound.json()).toMatchObject({
      code: "expense_not_found",
    });
    for (const changes of [
      { locationId: f.other.locationId },
      { conceptId: foreign.conceptId },
      { conceptId: foreign.conceptId, category: "water" as const },
    ]) {
      const response = await api(
        "POST",
        f.world.cookie,
        "entries",
        post([line(changes)]),
      );
      expect(response.status).toBe(422);
      expect(JSON.stringify(await response.json())).not.toContain("Privado");
    }
    await expect(
      createExpenses(f.world.businessId, f.world.ownerId, {
        ...post([line()]),
        expectedCurrencyCode: "COP",
      }),
    ).rejects.toMatchObject({ code: "currency_conflict" });
    const disabled = await api("PUT", f.world.cookie, "", { enabled: false });
    expect(disabled.status).toBe(200);
    try {
      expect((await api("GET", staff, "entries")).status).toBe(403);
    } finally {
      await enableModules(f.world, ["expenses"]);
    }
  });
  it("HTTP validates money, dates, explicit local, boolean and category before any writes", async () => {
    for (const amountMinor of [
      0,
      1,
      "0",
      "-1",
      "1.5",
      "1e2",
      "NaN",
      "Infinity",
      "9999999999999999999",
    ]) {
      const response = await api(
        "POST",
        f.world.cookie,
        "entries",
        post([line({ amountMinor: amountMinor as string })]),
      );
      expect(response.status).toBe(422);
    }
    for (const changes of [
      { paidOn: "2026-02-29" },
      { paidOn: "infinity" },
      { locationId: undefined },
      { isFixed: null },
      { category: "unknown" },
      { conceptName: "" },
      { name: "" },
    ]) {
      const response = await api(
        "POST",
        f.world.cookie,
        "entries",
        post([{ ...line(), ...changes } as ExpenseLine]),
      );
      expect(response.status).toBe(422);
    }
    expect(
      (
        await api("POST", f.world.cookie, "entries", {
          operationId: "bad",
          lines: [line()],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await api(
          "GET",
          f.world.cookie,
          "context?locationId=" + f.other.locationId,
        )
      ).status,
    ).toBe(422);
    expect(await getContext(f.world.businessId)).toMatchObject({
      defaultLocationId: f.world.locationId,
    });
  });
  it("historical payment can retain its archived local while editing its amount", async () => {
    const own = (
      await createExpenses(
        f.world.businessId,
        f.world.ownerId,
        post([line({ amountMinor: "100" })]),
      )
    ).expenses[0];
    await getDb()
      .update(locations)
      .set({ status: "archived" })
      .where(eq(locations.id, f.world.locationId));
    try {
      const context = await getContext(f.world.businessId);
      expect(context.locations).toContainEqual({
        id: f.world.locationId,
        name: "Local de prueba",
        status: "archived",
      });
      expect(context.defaultLocationId).toBeNull();
      const edited = await mutateExpense(
        f.world.businessId,
        f.world.ownerId,
        own.id,
        "updated",
        {
          ...line({ amountMinor: "200" }),
          expectedCurrencyCode: "USD",
          expectedRevision: 1,
          operationId: randomUUID(),
        },
      );
      expect(edited.expense).toMatchObject({
        locationId: f.world.locationId,
        amountMinor: "200",
        paidOn: own.paidOn,
      });
    } finally {
      await getDb()
        .update(locations)
        .set({ status: "active" })
        .where(eq(locations.id, f.world.locationId));
    }
  });
});
