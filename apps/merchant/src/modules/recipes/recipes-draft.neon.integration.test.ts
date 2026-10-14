import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { aiRequests, stockItems } from "@mi-pasaporte/db/schema";
import {
  type ModuleWorld,
  api,
  dropModuleWorld,
  enableModules,
  modulesIntegrationEnabled,
  newItem,
  seedModuleWorld,
  seedProduct,
} from "../modules-integration-support";
import { ScriptedAiProvider, aiRaw } from "../../server/ai/ai-test-support";
import { buildRecipeDraft } from "./draft";

/** Spec 0214 — dictado de recetas con proveedor INYECTADO, y el PUT ampliado (newItem, unit). Spec
 * 0224: el uso va a `core.ai_request` (tarea `recipes.recipe_text`). */

let world: ModuleWorld;
let other: ModuleWorld;

beforeAll(async () => {
  world = await seedModuleWorld("Receta dictada");
  other = await seedModuleWorld("Receta dictada ajena");
  await enableModules(world, ["stock", "recipes"]);
  await enableModules(other, ["stock", "recipes"]);
}, 240_000);

afterAll(async () => {
  await dropModuleWorld(world);
  await dropModuleWorld(other);
}, 240_000);

const scripted = (out: { yield: number; lines: unknown[] }) =>
  new ScriptedAiProvider({
    id: "scripted",
    model: "test-model",
    run: () =>
      aiRaw({ ...out, unparsed: [] }, { inputTokens: 7, outputTokens: 3 }),
  });

const usos = () =>
  getDb()
    .select()
    .from(aiRequests)
    .where(eq(aiRequests.businessId, world.businessId));

describe.skipIf(!modulesIntegrationEnabled)(
  "Recetas: dictado (spec 0214)",
  () => {
    it("borrador por unidad: 1 kg de harina para 40 → 25 g; un insumo ajeno sale nuevo; uso kind=recipe", async () => {
      const product = await seedProduct(world, "Medialuna", "1.00");
      const harina = await newItem(world, "Harina");
      const ajeno = await newItem(other, "Manteca");
      const provider = scripted({
        yield: 40,
        lines: [
          {
            itemId: harina.id,
            name: "Harina",
            quantity: "1",
            unit: "kg",
            sourceText: "1 kilo de harina",
          },
          {
            itemId: ajeno.id,
            name: "Manteca",
            quantity: "500",
            unit: "g",
            sourceText: "500 de manteca",
          },
        ],
      });
      const { draft } = await buildRecipeDraft(
        world.businessId,
        world.ownerId,
        product,
        { text: "con 1 kilo de harina y 500 de manteca salen 40 medialunas" },
        provider,
      );
      expect(draft.yield).toBe(40);
      expect(draft.lines[0]).toMatchObject({
        itemId: harina.id,
        quantity: "25.000",
        unit: "g",
        isNew: false,
      });
      expect(draft.lines[1]).toMatchObject({
        itemId: null,
        isNew: true,
        name: "Manteca",
        quantity: "12.500",
      });
      // El modelo vio el producto y SOLO los insumos de este negocio (contexto del servidor).
      const context = provider.calls[0].input.context ?? "";
      expect(context).toContain("PRODUCTO: Medialuna");
      expect(context).toContain("Harina");
      expect(context).not.toContain("Manteca");

      const rows = await usos();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        task: "recipes.recipe_text",
        status: "ok",
        outputItems: 2,
        inputTokens: 7,
      });
    }, 120_000);

    it("producto de OTRO negocio → 404 sin llamar a la IA ni registrar uso", async () => {
      const ajeno = await seedProduct(other, "Ajeno", "1.00");
      const provider = scripted({ yield: 1, lines: [] });
      const before = (await usos()).length;
      await expect(
        buildRecipeDraft(
          world.businessId,
          world.ownerId,
          ajeno,
          { text: "algo" },
          provider,
        ),
      ).rejects.toMatchObject({ status: 404, code: "product_not_found" });
      expect(provider.calls).toHaveLength(0);
      const after = (await usos()).length;
      expect(after).toBe(before);
    }, 120_000);

    it("PUT con newItem + unit kg crea el insumo y guarda en g; existente con unit compatible convierte", async () => {
      const product = await seedProduct(world, "Pizza", "8.00");
      const muzza = await newItem(world, "Muzzarella");
      const r = await api.saveRecipe(world.cookie, product, {
        lines: [
          { itemId: muzza.id, quantity: "0.15", unit: "kg" },
          { newItem: { name: "Salsa de tomate" }, quantity: 100, unit: "ml" },
          { newItem: { name: "Oregano" }, quantity: 2, unit: "g" },
        ],
      });
      expect(r.status).toBe(200);
      const recipe = (await r.json()).recipe;
      expect(
        recipe.lines.map(
          (l: { itemName: string; quantity: string; unit: string }) => [
            l.itemName,
            l.quantity,
            l.unit,
          ],
        ),
      ).toEqual([
        ["Muzzarella", "150.000", "g"],
        ["Salsa de tomate", "100.000", "ml"],
        ["Oregano", "2.000", "g"],
      ]);
      const salsa = await getDb()
        .select({ unit: stockItems.unit })
        .from(stockItems)
        .where(
          and(
            eq(stockItems.businessId, world.businessId),
            eq(stockItems.name, "Salsa de tomate"),
          ),
        );
      expect(salsa).toEqual([{ unit: "ml" }]);
    }, 120_000);

    it("PUT: unit_mismatch, newItem sin unit, nombre tomado (sin dejar insumos creados), itemId y newItem juntos", async () => {
      const product = await seedProduct(world, "Empanada", "1.20");
      const carne = await newItem(world, "Carne");
      const code = async (lines: unknown[]) => {
        const res = await api.saveRecipe(world.cookie, product, { lines });
        return [res.status, (await res.json()).code];
      };
      expect(
        await code([{ itemId: carne.id, quantity: 1, unit: "l" }]),
      ).toEqual([422, "unit_mismatch"]);
      expect(
        await code([{ newItem: { name: "Cebolla" }, quantity: 1 }]),
      ).toEqual([422, "invalid_unit"]);
      expect(
        await code([
          { newItem: { name: "Comino" }, quantity: 1, unit: "g" },
          { newItem: { name: "carne" }, quantity: 1, unit: "g" },
        ]),
      ).toEqual([409, "item_name_taken"]);
      const comino = await getDb()
        .select({ id: stockItems.id })
        .from(stockItems)
        .where(
          and(
            eq(stockItems.businessId, world.businessId),
            eq(stockItems.name, "Comino"),
          ),
        );
      expect(comino).toHaveLength(0);
      expect(
        await code([
          { itemId: carne.id, newItem: { name: "X" }, quantity: 1, unit: "g" },
        ]),
      ).toEqual([422, "invalid_line"]);
    }, 120_000);

    it("por la ruta: texto vacio → 422; con Recetas apagado → 403", async () => {
      const product = await seedProduct(world, "Tarta", "5.00");
      const r = await api.recipeDraft(world.cookie, product, { text: "  " });
      expect(r.status).toBe(422);
      expect((await r.json()).code).toBe("invalid_text");
      const lone = await seedModuleWorld("Receta sin modulo");
      try {
        await enableModules(lone, ["stock"]);
        const p = await seedProduct(lone, "X", "1.00");
        const off = await api.recipeDraft(lone.cookie, p, { text: "harina" });
        expect(off.status).toBe(403);
        expect((await off.json()).code).toBe("module_disabled");
      } finally {
        await dropModuleWorld(lone);
      }
    }, 240_000);
  },
);
