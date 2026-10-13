import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import { products, recipeLines } from "@mi-pasaporte/db/schema";
import {
  type ModuleWorld,
  api,
  buy,
  dropModuleWorld,
  enableModules,
  modulesIntegrationEnabled,
  newItem,
  seedModuleWorld,
  seedProduct,
} from "../modules-integration-support";

/**
 * Spec 0210 §Plan 3 — EL MODULO RECETAS contra Neon: PUT + GET con costo y margen, insumo y
 * producto de otro negocio (404), archivados, borrar el producto borra la receta, y aislamiento.
 */

let world: ModuleWorld;
let other: ModuleWorld;

beforeAll(async () => {
  world = await seedModuleWorld("Recetas");
  other = await seedModuleWorld("Recetas ajeno");
  await enableModules(world, ["stock", "recipes"]);
  await enableModules(other, ["stock", "recipes"]);
}, 240_000);

afterAll(async () => {
  await dropModuleWorld(world);
  await dropModuleWorld(other);
}, 240_000);

async function linesInDb(productId: string) {
  return getDb()
    .select({
      itemId: recipeLines.itemId,
      quantity: recipeLines.quantity,
      position: recipeLines.position,
    })
    .from(recipeLines)
    .where(eq(recipeLines.productId, productId))
    .orderBy(recipeLines.position);
}

describe.skipIf(!modulesIntegrationEnabled)(
  "Modulo Recetas (spec 0210)",
  () => {
    it("PUT + GET: lineas en orden, costo, margen y margen % correctos; el core queda intacto", async () => {
      const harina = await newItem(world, "Harina");
      const huevo = await newItem(world, "Huevo", "unit");
      const vainilla = await newItem(world, "Vainilla", "ml");
      await buy(world, harina.id, { quantity: 25000, totalCost: "30.00" }); // 0.0012 / g
      await buy(world, huevo.id, { quantity: 30, totalCost: "4.50" }); // 0.15 / u
      const torta = await seedProduct(world, "Torta", "2.00");

      const put = await api.saveRecipe(world.cookie, torta, {
        lines: [
          { itemId: huevo.id, quantity: 2 },
          { itemId: harina.id, quantity: "200" },
        ],
      });
      expect(put.status).toBe(200);
      const recipe = (await put.json()).recipe;
      expect(recipe).toEqual({
        productId: torta,
        productName: "Torta",
        unitPrice: "2.00",
        cost: "0.54",
        costComplete: true,
        margin: "1.46",
        marginPct: "73.0",
        lineCount: 2,
        lines: [
          {
            itemId: huevo.id,
            itemName: "Huevo",
            unit: "unit",
            itemStatus: "active",
            quantity: "2.000",
            unitCost: "0.150000",
            lineCost: "0.30",
          },
          {
            itemId: harina.id,
            itemName: "Harina",
            unit: "g",
            itemStatus: "active",
            quantity: "200.000",
            unitCost: "0.001200",
            lineCost: "0.24",
          },
        ],
      });
      const read = await api.recipe(world.cookie, torta);
      expect(read.status).toBe(200);
      expect((await read.json()).recipe).toEqual(recipe);
      expect((await linesInDb(torta)).map((l) => l.position)).toEqual([0, 1]);

      // Un insumo sin compras: suma solo las conocidas, costComplete=false.
      const withUnknown = await api.saveRecipe(world.cookie, torta, {
        lines: [
          { itemId: harina.id, quantity: 200 },
          { itemId: vainilla.id, quantity: 5 },
        ],
      });
      expect((await withUnknown.json()).recipe).toMatchObject({
        cost: "0.24",
        costComplete: false,
        margin: "1.76",
        lineCount: 2,
      });

      // El modulo no escribe `core.product.unit_cost`.
      const [prod] = await getDb()
        .select({ unitCost: products.unitCost })
        .from(products)
        .where(eq(products.id, torta));
      expect(prod.unitCost).toBeNull();
    }, 120_000);

    it("GET /: todos los productos (con y sin receta), por nombre; precio null → margen null", async () => {
      const sinReceta = await seedProduct(world, "Agua", null);
      const list = (await (await api.recipes(world.cookie)).json()).recipes;
      const agua = list.find(
        (r: { productId: string }) => r.productId === sinReceta,
      );
      expect(agua).toEqual({
        productId: sinReceta,
        productName: "Agua",
        unitPrice: null,
        cost: null,
        costComplete: false,
        margin: null,
        marginPct: null,
        lineCount: 0,
      });
      const names = list.map((r: { productName: string }) => r.productName);
      expect(names).toEqual(
        [...names].sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase()),
        ),
      );
      expect(names).toContain("Torta");
    }, 120_000);

    it("insumo de OTRO negocio → 404 item_not_found; producto de otro negocio → 404 product_not_found", async () => {
      const mine = await seedProduct(world, "Cafe", "1.50");
      const foreignItem = await newItem(other, "Grano ajeno");
      const foreignProduct = await seedProduct(other, "Producto ajeno", "9.00");

      const r1 = await api.saveRecipe(world.cookie, mine, {
        lines: [{ itemId: foreignItem.id, quantity: 1 }],
      });
      expect(r1.status).toBe(404);
      expect((await r1.json()).code).toBe("item_not_found");
      expect(await linesInDb(mine)).toEqual([]);

      const myItem = await newItem(world, "Grano propio");
      const r2 = await api.saveRecipe(world.cookie, foreignProduct, {
        lines: [{ itemId: myItem.id, quantity: 1 }],
      });
      expect(r2.status).toBe(404);
      expect((await r2.json()).code).toBe("product_not_found");
      expect(await linesInDb(foreignProduct)).toEqual([]);
      const r3 = await api.recipe(world.cookie, foreignProduct);
      expect(r3.status).toBe(404);
      expect((await r3.json()).code).toBe("product_not_found");
    }, 120_000);

    it("archivado NUEVO → 409 item_archived; uno que ya estaba en la receta se conserva", async () => {
      const p = await seedProduct(world, "Medialuna", "0.80");
      const manteca = await newItem(world, "Manteca");
      const levadura = await newItem(world, "Levadura");
      await api.saveRecipe(world.cookie, p, {
        lines: [{ itemId: manteca.id, quantity: 10 }],
      });
      await api.updateItem(world.cookie, manteca.id, { status: "archived" });
      await api.updateItem(world.cookie, levadura.id, { status: "archived" });

      const keep = await api.saveRecipe(world.cookie, p, {
        lines: [{ itemId: manteca.id, quantity: 12 }],
      });
      expect(keep.status).toBe(200);
      expect((await keep.json()).recipe.lines[0]).toMatchObject({
        itemId: manteca.id,
        itemStatus: "archived",
        quantity: "12.000",
      });

      const add = await api.saveRecipe(world.cookie, p, {
        lines: [
          { itemId: manteca.id, quantity: 12 },
          { itemId: levadura.id, quantity: 1 },
        ],
      });
      expect(add.status).toBe(409);
      expect((await add.json()).code).toBe("item_archived");
      expect((await linesInDb(p)).map((l) => [l.itemId, l.quantity])).toEqual([
        [manteca.id, "12.000"],
      ]);
    }, 120_000);

    it("validacion del PUT: too_many_lines, duplicate_item, invalid_quantity; lines: [] borra", async () => {
      const p = await seedProduct(world, "Tostado", "3.00");
      const jamon = await newItem(world, "Jamon");
      const many = Array.from({ length: 51 }, () => ({
        itemId: jamon.id,
        quantity: 1,
      }));
      const cases: [unknown, string][] = [
        [{ lines: many }, "too_many_lines"],
        [
          {
            lines: [
              { itemId: jamon.id, quantity: 1 },
              { itemId: jamon.id, quantity: 2 },
            ],
          },
          "duplicate_item",
        ],
        [{ lines: [{ itemId: jamon.id, quantity: 0 }] }, "invalid_quantity"],
      ];
      for (const [body, code] of cases) {
        const r = await api.saveRecipe(world.cookie, p, body);
        expect(r.status, code).toBe(422);
        expect((await r.json()).code).toBe(code);
      }
      await api.saveRecipe(world.cookie, p, {
        lines: [{ itemId: jamon.id, quantity: 30 }],
      });
      expect(await linesInDb(p)).toHaveLength(1);
      const cleared = await api.saveRecipe(world.cookie, p, { lines: [] });
      expect((await cleared.json()).recipe).toMatchObject({
        lineCount: 0,
        cost: null,
        lines: [],
      });
      expect(await linesInDb(p)).toEqual([]);
    }, 120_000);

    it("borrar el producto borra su receta (FK cascade)", async () => {
      const p = await seedProduct(world, "Efimero", "1.00");
      const item = await newItem(world, "Insumo efimero");
      await api.saveRecipe(world.cookie, p, {
        lines: [{ itemId: item.id, quantity: 1 }],
      });
      expect(await linesInDb(p)).toHaveLength(1);
      await getDb().delete(products).where(eq(products.id, p));
      expect(await linesInDb(p)).toEqual([]);
    }, 120_000);

    it("aislamiento: B no lista ni lee las recetas ni los productos de A", async () => {
      const list = (await (await api.recipes(other.cookie)).json()).recipes;
      const names = list.map((r: { productName: string }) => r.productName);
      expect(names).not.toContain("Torta");
      expect(names).toEqual(["Producto ajeno"]);
      const [torta] = await getDb()
        .select({ id: products.id })
        .from(products)
        .where(eq(products.businessId, world.businessId));
      const r = await api.recipe(other.cookie, torta.id);
      expect(r.status).toBe(404);
      expect((await r.json()).code).toBe("product_not_found");
    }, 120_000);

    it("con recipes apagado (stock encendido) las rutas de recetas dan 403 module_disabled", async () => {
      expect(
        (await api.setModule(other.cookie, "recipes", { enabled: false }))
          .status,
      ).toBe(200);
      const r = await api.recipes(other.cookie);
      expect(r.status).toBe(403);
      expect((await r.json()).code).toBe("module_disabled");
      expect((await api.items(other.cookie)).status).toBe(200);
    }, 120_000);
  },
);
