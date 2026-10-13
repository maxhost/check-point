import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { stockItems, stockMovements } from "@mi-pasaporte/db/schema";
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
import { lastUnitCost, onHandSql } from "./stock-integration-support";

/**
 * Spec 0210 §Entradas — UNA ENTRADA, VARIAS COMPRAS (el camino del audio) y el registro general.
 * El saldo y el costo se leen POR SQL: la respuesta de la API no es el oraculo.
 */

let world: ModuleWorld;
let other: ModuleWorld;

beforeAll(async () => {
  world = await seedModuleWorld("Entradas");
  other = await seedModuleWorld("Entradas ajeno");
  await enableModules(world, ["stock"]);
  await enableModules(other, ["stock"]);
}, 240_000);

afterAll(async () => {
  await dropModuleWorld(world);
  await dropModuleWorld(other);
}, 240_000);

describe.skipIf(!modulesIntegrationEnabled)(
  "Stock: entradas (spec 0210)",
  () => {
    it("la frase del owner: harina 1 kg $25, 30 huevos $4, 2 kg de tomate $7 → tres movimientos separados", async () => {
      const harina = await newItem(world, "Harina");
      const r = await api.entry(world.cookie, {
        lines: [
          { itemId: harina.id, quantity: 1, unit: "kg", totalCost: 25 },
          {
            newItem: { name: "Huevos" },
            quantity: 30,
            unit: "unit",
            totalCost: 4,
          },
          {
            newItem: { name: "Tomate" },
            quantity: "2",
            unit: "kg",
            totalCost: "7",
          },
        ],
      });
      expect(r.status).toBe(201);
      const body = await r.json();
      expect(body.movements).toHaveLength(3);
      const entryIds = new Set(
        body.movements.map((m: { entryId: string }) => m.entryId),
      );
      expect(entryIds).toEqual(new Set([body.entryId]));

      const rows = await getDb()
        .select({
          itemId: stockMovements.itemId,
          entryId: stockMovements.entryId,
        })
        .from(stockMovements)
        .where(eq(stockMovements.entryId, body.entryId));
      expect(rows).toHaveLength(3);

      const items = await getDb()
        .select({
          id: stockItems.id,
          name: stockItems.name,
          unit: stockItems.unit,
        })
        .from(stockItems)
        .where(eq(stockItems.businessId, world.businessId));
      const byName = Object.fromEntries(items.map((i) => [i.name, i]));
      expect(byName.Huevos.unit).toBe("unit");
      expect(byName.Tomate.unit).toBe("g");

      expect(await onHandSql(harina.id)).toBe("1000.000");
      expect(await lastUnitCost(harina.id)).toBe("0.025000");
      expect(await onHandSql(byName.Huevos.id)).toBe("30.000");
      expect(await lastUnitCost(byName.Huevos.id)).toBe("0.133333");
      expect(await onHandSql(byName.Tomate.id)).toBe("2000.000");
      expect(await lastUnitCost(byName.Tomate.id)).toBe("0.003500");
    }, 120_000);

    it("sin precio suma stock y NO toca el costo; tampoco tapa una compra con precio mas vieja que llega despues", async () => {
      const item = await newItem(world, "Queso");
      await buy(world, item.id, {
        quantity: 1000,
        totalCost: 10,
        occurredAt: new Date(Date.now() - 3 * 864e5).toISOString(),
      });
      const r = await api.entry(world.cookie, {
        lines: [{ itemId: item.id, quantity: 500, unit: "g" }],
      });
      expect(r.status).toBe(201);
      expect((await r.json()).movements[0].totalCost).toBeNull();
      expect(await onHandSql(item.id)).toBe("1500.000");
      expect(await lastUnitCost(item.id)).toBe("0.010000");

      // Compra suelta tambien sin precio.
      expect(
        (await api.purchase(world.cookie, item.id, { quantity: 100 })).status,
      ).toBe(201);
      expect(await lastUnitCost(item.id)).toBe("0.010000");

      await buy(world, item.id, {
        quantity: 1000,
        totalCost: 20,
        occurredAt: new Date(Date.now() - 864e5).toISOString(),
      });
      expect(await lastUnitCost(item.id)).toBe("0.020000");
    }, 120_000);

    it("todo o nada: una linea mala cancela la entrada entera (ni stock ni insumos nuevos)", async () => {
      const item = await newItem(world, "Aceite", "ml");
      const r = await api.entry(world.cookie, {
        lines: [
          { itemId: item.id, quantity: 1, unit: "l", totalCost: 5 },
          { newItem: { name: "Sal" }, quantity: 1, unit: "kg" },
          { itemId: item.id, quantity: 1, unit: "kg" },
        ],
      });
      expect(r.status).toBe(422);
      expect((await r.json()).code).toBe("unit_mismatch");
      expect(await onHandSql(item.id)).toBe("0.000");
      const sal = await getDb()
        .select({ id: stockItems.id })
        .from(stockItems)
        .where(eq(stockItems.name, "Sal"));
      expect(sal.filter(Boolean)).toHaveLength(0);
    }, 120_000);

    it("validacion: sin lineas, mas de 30, itemId y newItem juntos, unidad invalida, cantidad 0, nombre tomado", async () => {
      const item = await newItem(world, "Levadura");
      const code = async (body: unknown) => {
        const res = await api.entry(world.cookie, body);
        return [res.status, (await res.json()).code];
      };
      expect(await code({ lines: [] })).toEqual([422, "invalid_body"]);
      expect(
        await code({
          lines: Array.from({ length: 31 }, () => ({
            itemId: item.id,
            quantity: 1,
            unit: "g",
          })),
        }),
      ).toEqual([422, "too_many_lines"]);
      expect(
        await code({
          lines: [
            { itemId: item.id, newItem: { name: "X" }, quantity: 1, unit: "g" },
          ],
        }),
      ).toEqual([422, "invalid_line"]);
      expect(
        await code({ lines: [{ itemId: item.id, quantity: 1, unit: "taza" }] }),
      ).toEqual([422, "invalid_unit"]);
      expect(
        await code({ lines: [{ itemId: item.id, quantity: 0, unit: "g" }] }),
      ).toEqual([422, "invalid_quantity"]);
      expect(
        await code({
          lines: [{ newItem: { name: "levadura" }, quantity: 1, unit: "g" }],
        }),
      ).toEqual([409, "item_name_taken"]);
    }, 120_000);

    it("un nombre nuevo repetido en la misma entrada crea UN insumo con las dos compras", async () => {
      const r = await api.entry(world.cookie, {
        lines: [
          {
            newItem: { name: "Albahaca" },
            quantity: 100,
            unit: "g",
            totalCost: 1,
          },
          { newItem: { name: "albahaca" }, quantity: 50, unit: "g" },
        ],
      });
      expect(r.status).toBe(201);
      const body = await r.json();
      expect(body.items).toHaveLength(1);
      expect(await onHandSql(body.items[0].id)).toBe("150.000");
    }, 120_000);

    it("aislamiento: un insumo de OTRO negocio es 404 y el registro general no muestra lo ajeno", async () => {
      const ajeno = await newItem(other, "Ajeno");
      const r = await api.entry(world.cookie, {
        lines: [{ itemId: ajeno.id, quantity: 1, unit: "g" }],
      });
      expect(r.status).toBe(404);
      expect((await r.json()).code).toBe("item_not_found");
      expect(await onHandSql(ajeno.id)).toBe("0.000");

      await buy(other, ajeno.id, { quantity: 5, totalCost: 1 });
      const log = (await (await api.log(world.cookie)).json()).movements;
      expect(log.length).toBeGreaterThan(0);
      expect(log.some((m: { itemId: string }) => m.itemId === ajeno.id)).toBe(
        false,
      );
      const otherLog = (await (await api.log(other.cookie)).json()).movements;
      expect(otherLog.map((m: { itemName: string }) => m.itemName)).toEqual([
        "Ajeno",
      ]);
    }, 120_000);

    it("registro general: todos los insumos, con nombre y unidad, del mas reciente al mas viejo, con limit", async () => {
      const log = (await (await api.log(world.cookie)).json()).movements;
      expect(log[0]).toMatchObject({
        itemId: expect.any(String),
        itemName: expect.any(String),
        unit: expect.stringMatching(/^(g|ml|unit)$/),
        kind: expect.stringMatching(/^(purchase|adjustment)$/),
      });
      const times = log.map((m: { occurredAt: string }) =>
        Date.parse(m.occurredAt),
      );
      expect([...times].sort((a, b) => b - a)).toEqual(times);
      expect(
        new Set(log.map((m: { itemName: string }) => m.itemName)).size,
      ).toBeGreaterThan(3);
      expect(
        (await (await api.log(world.cookie, 2)).json()).movements,
      ).toHaveLength(2);
    }, 120_000);
  },
);
