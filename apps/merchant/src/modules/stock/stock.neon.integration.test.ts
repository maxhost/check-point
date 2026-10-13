import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@mi-pasaporte/db";
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
import { lastUnitCost, onHandSql } from "./stock-integration-support";

/**
 * Spec 0210 §Plan 3 — EL MODULO STOCK contra Neon: compras y `last_unit_cost` (incluida la compra
 * con fecha vieja), ajustes por conteo (los concurrentes, en `stock-concurrency.neon`), nombres, validacion y aislamiento.
 * `last_unit_cost` y el saldo se leen POR SQL: la respuesta de la API no es el oraculo.
 */

let world: ModuleWorld;
let other: ModuleWorld;

beforeAll(async () => {
  world = await seedModuleWorld("Stock");
  other = await seedModuleWorld("Stock ajeno");
  await enableModules(world, ["stock"]);
  await enableModules(other, ["stock"]);
}, 240_000);

afterAll(async () => {
  await dropModuleWorld(world);
  await dropModuleWorld(other);
}, 240_000);

describe.skipIf(!modulesIntegrationEnabled)("Modulo Stock (spec 0210)", () => {
  it("crear y listar: forma del Item, onHand 0, sin costo, orden lower(name)", async () => {
    const r = await api.createItem(world.cookie, {
      name: "  zanahoria ",
      unit: "g",
    });
    expect(r.status).toBe(201);
    const item = (await r.json()).item;
    expect(item).toEqual({
      id: item.id,
      name: "zanahoria",
      unit: "g",
      status: "active",
      onHand: "0.000",
      lastUnitCost: null,
      updatedAt: expect.any(String),
    });
    await newItem(world, "Aceite", "ml");
    const listed = (await (await api.items(world.cookie)).json()).items;
    const names = listed.map((i: { name: string }) => i.name);
    expect(names.indexOf("Aceite")).toBeLessThan(names.indexOf("zanahoria"));
  }, 120_000);

  it("compra: inserta el movimiento y fija last_unit_cost = total / cantidad (a 6)", async () => {
    const item = await newItem(world, "Harina 000");
    const r = await api.purchase(world.cookie, item.id, {
      quantity: "25000",
      totalCost: "30.00",
      note: "Bolsa de 25 kg",
    });
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body.movement).toMatchObject({
      kind: "purchase",
      quantity: "25000.000",
      totalCost: "30.00",
      countedQuantity: null,
      note: "Bolsa de 25 kg",
    });
    expect(body.item).toMatchObject({
      onHand: "25000.000",
      lastUnitCost: "0.001200",
    });
    expect(await lastUnitCost(item.id)).toBe("0.001200");
    expect(await onHandSql(item.id)).toBe("25000.000");
  }, 120_000);

  it("una compra con fecha VIEJA no pisa last_unit_cost; una mas nueva si", async () => {
    const item = await newItem(world, "Leche");
    await buy(world, item.id, {
      quantity: 1000,
      totalCost: 2,
      occurredAt: "2026-10-01T12:00:00Z",
    });
    expect(await lastUnitCost(item.id)).toBe("0.002000");

    await buy(world, item.id, {
      quantity: 1000,
      totalCost: 1,
      occurredAt: "2026-09-01T12:00:00Z",
    });
    expect(await lastUnitCost(item.id)).toBe("0.002000");

    await buy(world, item.id, { quantity: 1000, totalCost: 3 });
    expect(await lastUnitCost(item.id)).toBe("0.003000");
    expect(await onHandSql(item.id)).toBe("3000.000");

    const moves = (await (await api.movements(world.cookie, item.id)).json())
      .movements;
    expect(moves.map((m: { totalCost: string }) => m.totalCost)).toEqual([
      "3.00",
      "2.00",
      "1.00",
    ]);
    const limited = (
      await (await api.movements(world.cookie, item.id, 1)).json()
    ).movements;
    expect(limited).toHaveLength(1);
  }, 120_000);

  it("un ajuste posterior no cuenta como compra: la compra mas nueva entre medio actualiza el costo", async () => {
    const day = 24 * 60 * 60 * 1000;
    const item = await newItem(world, "Crema");
    await buy(world, item.id, {
      quantity: 1000,
      totalCost: 2,
      occurredAt: new Date(Date.now() - 2 * day).toISOString(),
    });
    expect(
      (await api.adjust(world.cookie, item.id, { countedQuantity: 500 }))
        .status,
    ).toBe(201);
    await buy(world, item.id, {
      quantity: 1000,
      totalCost: 4,
      occurredAt: new Date(Date.now() - day).toISOString(),
    });
    expect(await lastUnitCost(item.id)).toBe("0.004000");
  }, 120_000);

  it("ajuste: deja onHand = contado (delta sobre el saldo actual)", async () => {
    const item = await newItem(world, "Azucar");
    await buy(world, item.id, { quantity: "1000", totalCost: "1.50" });
    const r = await api.adjust(world.cookie, item.id, {
      countedQuantity: "820.5",
    });
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body.movement).toMatchObject({
      kind: "adjustment",
      quantity: "-179.500",
      countedQuantity: "820.500",
      totalCost: null,
    });
    expect(body.item.onHand).toBe("820.500");
    expect(await onHandSql(item.id)).toBe("820.500");
    const zero = await api.adjust(world.cookie, item.id, {
      countedQuantity: 820.5,
    });
    expect((await zero.json()).movement.quantity).toBe("0.000");
  }, 120_000);

  it("nombre duplicado (sin mayusculas) → 409; archivado no bloquea; reactivar con nombre tomado → 409", async () => {
    const item = await newItem(world, "Sal fina");
    const dup = await api.createItem(world.cookie, {
      name: "SAL FINA",
      unit: "g",
    });
    expect(dup.status).toBe(409);
    expect((await dup.json()).code).toBe("item_name_taken");

    expect(
      (await api.updateItem(world.cookie, item.id, { status: "archived" }))
        .status,
    ).toBe(200);
    await newItem(world, "Sal fina");
    const back = await api.updateItem(world.cookie, item.id, {
      status: "active",
    });
    expect(back.status).toBe(409);
    expect((await back.json()).code).toBe("item_name_taken");

    const archived = (await (await api.items(world.cookie, "archived")).json())
      .items;
    expect(archived.map((i: { id: string }) => i.id)).toContain(item.id);
    const buyArchived = await api.purchase(world.cookie, item.id, {
      quantity: 1,
      totalCost: 1,
    });
    expect(buyArchived.status).toBe(409);
    expect((await buyArchived.json()).code).toBe("item_archived");
    const adjustArchived = await api.adjust(world.cookie, item.id, {
      countedQuantity: 1,
    });
    expect(adjustArchived.status).toBe(409);
    expect((await adjustArchived.json()).code).toBe("item_archived");
  }, 120_000);

  it("validacion: 422 con el code del contrato y nada escrito", async () => {
    const item = await newItem(world, "Validar");
    const cases: [Promise<Response>, string][] = [
      [api.createItem(world.cookie, { name: "", unit: "g" }), "invalid_name"],
      [api.createItem(world.cookie, { name: "X", unit: "kg" }), "invalid_unit"],
      [api.updateItem(world.cookie, item.id, { unit: "ml" }), "unit_immutable"],
      [
        api.purchase(world.cookie, item.id, { quantity: 0, totalCost: 1 }),
        "invalid_quantity",
      ],
      [
        api.purchase(world.cookie, item.id, { quantity: 1, totalCost: -1 }),
        "invalid_cost",
      ],
      [
        api.purchase(world.cookie, item.id, {
          quantity: "1.0001",
          totalCost: 1,
        }),
        "invalid_number",
      ],
      [
        api.purchase(world.cookie, item.id, { quantity: "uno", totalCost: 1 }),
        "invalid_number",
      ],
      [
        api.purchase(world.cookie, item.id, {
          quantity: 1,
          totalCost: 1,
          occurredAt: new Date(Date.now() + 3_600_000).toISOString(),
        }),
        "invalid_date",
      ],
      [
        api.adjust(world.cookie, item.id, { countedQuantity: -1 }),
        "invalid_quantity",
      ],
    ];
    for (const [pending, code] of cases) {
      const r = await pending;
      expect(r.status, code).toBe(422);
      expect((await r.json()).code).toBe(code);
    }
    expect(await onHandSql(item.id)).toBe("0.000");
    expect(await lastUnitCost(item.id)).toBeNull();
  }, 120_000);

  it("aislamiento: B no lista, no lee, no edita ni mueve un insumo de A (404, nada escrito)", async () => {
    const mine = await newItem(world, "Secreto de A");
    await buy(world, mine.id, { quantity: 10, totalCost: 5 });
    const listed = (await (await api.items(other.cookie, "all")).json()).items;
    expect(listed.map((i: { id: string }) => i.id)).not.toContain(mine.id);
    for (const r of [
      await api.movements(other.cookie, mine.id),
      await api.updateItem(other.cookie, mine.id, { name: "Robado" }),
      await api.purchase(other.cookie, mine.id, {
        quantity: 1,
        totalCost: 100,
      }),
      await api.adjust(other.cookie, mine.id, { countedQuantity: 0 }),
    ]) {
      expect(r.status).toBe(404);
      expect((await r.json()).code).toBe("item_not_found");
    }
    const [row] = await getDb()
      .select({ name: stockItems.name })
      .from(stockItems)
      .where(eq(stockItems.id, mine.id));
    expect(row.name).toBe("Secreto de A");
    expect(await onHandSql(mine.id)).toBe("10.000");
    expect(await lastUnitCost(mine.id)).toBe("0.500000");
  }, 120_000);
});
