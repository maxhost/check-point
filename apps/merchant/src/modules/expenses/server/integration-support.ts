import { randomUUID } from "node:crypto";
import { beforeAll, afterAll } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { moduleEvents } from "@mi-pasaporte/db/schema";
import {
  callModuleRoute,
  dropModuleWorld,
  enableModules,
  seedModuleWorld,
  type ModuleWorld,
} from "../../modules-integration-support";
import type { ExpenseLine } from "../types";
export function useExpenseWorld() {
  let world: ModuleWorld, other: ModuleWorld;
  beforeAll(async () => {
    world = await seedModuleWorld("expenses");
    other = await seedModuleWorld("expenses-other");
    await enableModules(world, ["expenses"]);
    await enableModules(other, ["expenses"]);
  });
  afterAll(async () => {
    await dropModuleWorld(world);
    await dropModuleWorld(other);
  });
  const line = (changes: Partial<ExpenseLine> = {}): ExpenseLine => ({
    paidOn: "2025-12-31",
    amountMinor: "900719925474099301",
    category: "personnel",
    conceptId: null,
    conceptName: "Luis",
    name: "Sueldo Luis",
    isFixed: false,
    locationId: world.locationId,
    ...changes,
  });
  const post = (lines: ExpenseLine[], operationId = randomUUID()) => ({
    operationId,
    expectedCurrencyCode: "USD",
    lines,
  });
  const api = (
    method: "GET" | "POST" | "PUT" | "DELETE",
    cookie: string,
    path: string,
    body?: unknown,
  ) =>
    callModuleRoute(
      method,
      `/api/modules/expenses${path ? "/" + path : ""}`,
      cookie,
      body,
    );
  async function eventsFor(id: string) {
    return getDb()
      .select()
      .from(moduleEvents)
      .where(
        and(
          eq(moduleEvents.businessId, world.businessId),
          sql`${moduleEvents.payload}->>'expenseId'=${id}`,
        ),
      )
      .orderBy(moduleEvents.createdAt);
  }
  return {
    get world() {
      return world;
    },
    get other() {
      return other;
    },
    line,
    post,
    api,
    eventsFor,
  };
}
