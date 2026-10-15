import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withDbTransaction } from "@mi-pasaporte/db";
import { stockItems } from "@mi-pasaporte/db/schema";
import {
  type ModuleWorld,
  api,
  buy,
  dropModuleWorld,
  enableModules,
  modulesIntegrationEnabled,
  newItem,
  seedModuleWorld,
} from "../modules-integration-support";
import { onHandSql, waitForLockWaiters } from "./stock-integration-support";

/**
 * Spec 0210 §Plan 3 — DOS AJUSTES CONCURRENTES del mismo insumo contra Neon (aparte de
 * `stock.neon.integration.test.ts` por el hook `file-size`). El lock `FOR UPDATE` del insumo hace
 * que el segundo calcule su delta sobre el saldo que dejo el primero.
 */

let world: ModuleWorld;

async function readMovements(itemId: string) {
  const response = await api.movements(world.cookie, itemId);
  const body = await response.json();
  expect(
    response.status,
    JSON.stringify({ error: body.error, code: body.code }),
  ).toBe(200);
  expect(body.movements).toBeInstanceOf(Array);
  return body.movements;
}

beforeAll(async () => {
  world = await seedModuleWorld("Stock concurrente");
  await enableModules(world, ["stock"]);
}, 240_000);

afterAll(async () => {
  await dropModuleWorld(world);
}, 240_000);

describe.skipIf(!modulesIntegrationEnabled)(
  "Modulo Stock: concurrencia (spec 0210)",
  () => {
    it("dos ajustes CONCURRENTES dejan onHand igual a uno de los contados (el ultimo)", async () => {
      const item = await newItem(world, "Cafe en grano");
      await buy(world, item.id, { quantity: 100, totalCost: 10 });
      // BARRERA DETERMINISTA: dos requests sueltas casi nunca se solapan (medido: con el lock
      // borrado el test daba VERDE). Una transaccion T0 toma la fila del insumo y las dos
      // requests salen mientras la tiene: con el lock del codigo, las dos esperan en
      // `lockItem`; sin el, las dos leen el saldo (100) y esperan recien en el INSERT (la FK
      // pide KEY SHARE sobre la misma fila). T0 suelta cuando Postgres muestra a las DOS
      // esperando, asi que la carrera ocurre siempre.
      const { pending } = await withDbTransaction(async (tx) => {
        await tx
          .select({ id: stockItems.id })
          .from(stockItems)
          .where(eq(stockItems.id, item.id))
          .for("update");
        const pending = Promise.all([
          api.adjust(world.cookie, item.id, { countedQuantity: 10 }),
          api.adjust(world.cookie, item.id, { countedQuantity: 7 }),
        ]);
        await waitForLockWaiters(2);
        return { pending };
      });
      const [a, b] = await pending;
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      const failed = a.status === 409 ? a : b;
      expect((await failed.json()).code).toBe("count_changed");
      // Spec0227 SERIALIZABLE explicitly aborts only the concurrent count; caller retries it.
      const beforeRetry = await readMovements(item.id);
      expect(
        beforeRetry.filter((m: { kind: string }) => m.kind === "adjustment"),
      ).toHaveLength(1);
      const retry = await api.adjust(world.cookie, item.id, {
        countedQuantity: a.status === 409 ? 10 : 7,
      });
      expect(retry.status).toBe(201);
      const final = await onHandSql(item.id);
      // Sin el lock los dos leen 100 y el saldo termina en (10−100)+(7−100)+100 = −83.
      expect(["10.000", "7.000"]).toContain(final);
      const moves = await readMovements(item.id);
      const adjustments = moves.filter(
        (m: { kind: string }) => m.kind === "adjustment",
      );
      const deltas = adjustments
        .map((m: { quantity: string }) => m.quantity)
        .sort();
      // Uno calcula su delta sobre 100 y el otro sobre el contado del primero.
      expect([
        ["-3.000", "-90.000"].sort(),
        ["-93.000", "3.000"].sort(),
      ]).toContainEqual(deltas);
    }, 120_000);
  },
);
