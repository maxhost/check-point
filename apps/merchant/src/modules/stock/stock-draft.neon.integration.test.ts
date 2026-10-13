import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { stockDraftRequests } from "@mi-pasaporte/db/schema";
import {
  type ModuleWorld,
  api,
  dropModuleWorld,
  enableModules,
  modulesIntegrationEnabled,
  newItem,
  seedModuleWorld,
} from "../modules-integration-support";
import { buildDraft, draftsSince } from "./draft";
import type { StockDraftProvider } from "./draft-provider";

/** Spec 0212 — el borrador con un proveedor falso INYECTADO (sin llamadas reales a OpenAI). */

let world: ModuleWorld;
let other: ModuleWorld;

beforeAll(async () => {
  world = await seedModuleWorld("Borrador");
  other = await seedModuleWorld("Borrador ajeno");
  await enableModules(world, ["stock"]);
  await enableModules(other, ["stock"]);
}, 240_000);

afterAll(async () => {
  await dropModuleWorld(world);
  await dropModuleWorld(other);
}, 240_000);

const scripted = (
  lines: unknown[],
): StockDraftProvider & { seen: string[][] } => {
  const seen: string[][] = [];
  return {
    id: "scripted",
    model: "test-model",
    seen,
    async draft(input) {
      seen.push(input.items.map((i) => i.name));
      return {
        lines,
        unparsed: [],
        usage: { inputTokens: 10, outputTokens: 5 },
      };
    },
  };
};

const rows = () =>
  getDb()
    .select()
    .from(stockDraftRequests)
    .where(eq(stockDraftRequests.businessId, world.businessId));

describe.skipIf(!modulesIntegrationEnabled)(
  "Stock: borrador desde texto (spec 0212)",
  () => {
    it("empareja con los insumos del negocio; uno ajeno sale como nuevo; registra el uso sin el texto", async () => {
      const harina = await newItem(world, "Harina");
      const ajeno = await newItem(other, "Huevos", "unit");
      const provider = scripted([
        {
          itemId: harina.id,
          name: "Harina",
          quantity: "1",
          unit: "kg",
          totalCost: "25",
          sourceText: "1kg de harina por 25",
        },
        {
          itemId: ajeno.id,
          name: "Huevos",
          quantity: "30",
          unit: "unit",
          totalCost: "4",
          sourceText: "carton de 30 por 4",
        },
      ]);
      const text =
        "Hoy compre 1kg de harina por 25 dolares, un carton de huevos que trae treinta por 4";
      const { draft } = await buildDraft(
        world.businessId,
        world.ownerId,
        { text },
        provider,
      );
      expect(draft.lines[0]).toMatchObject({
        itemId: harina.id,
        isNew: false,
        quantity: "1.000",
        unit: "kg",
      });
      expect(draft.lines[1]).toMatchObject({
        itemId: null,
        isNew: true,
        name: "Huevos",
      });
      // El modelo solo vio los insumos de ESTE negocio.
      expect(provider.seen[0]).toEqual(["Harina"]);

      const [row] = await rows();
      expect(row).toMatchObject({
        provider: "scripted",
        model: "test-model",
        status: "ok",
        lineCount: 2,
        inputChars: text.length,
        inputTokens: 10,
        outputTokens: 5,
        createdByUserId: world.ownerId,
      });
      expect(JSON.stringify(row)).not.toContain("harina por 25");
      expect(
        await draftsSince(world.businessId, new Date(Date.now() - 60_000)),
      ).toBe(1);
      expect(
        await draftsSince(other.businessId, new Date(Date.now() - 60_000)),
      ).toBe(0);
    }, 120_000);

    it("proveedor que falla → 503 draft_unavailable y fila failed", async () => {
      const failing: StockDraftProvider = {
        id: "scripted",
        model: null,
        async draft() {
          throw new Error("boom");
        },
      };
      await expect(
        buildDraft(world.businessId, world.ownerId, { text: "algo" }, failing),
      ).rejects.toMatchObject({ status: 503, code: "draft_unavailable" });
      const all = await rows();
      expect(all.filter((r) => r.status === "failed")).toHaveLength(1);
    }, 120_000);

    it("por la ruta: texto vacio → 422 sin fila; proveedor del entorno sin clave no inventa", async () => {
      const before = (await rows()).length;
      const r = await api.draft(world.cookie, { text: "   " });
      expect(r.status).toBe(422);
      expect((await r.json()).code).toBe("invalid_text");
      expect((await rows()).length).toBe(before);
    }, 120_000);

    it("con el modulo apagado → 403 module_disabled", async () => {
      const lone = await seedModuleWorld("Borrador sin modulo");
      try {
        const r = await api.draft(lone.cookie, { text: "1 kg de harina" });
        expect(r.status).toBe(403);
        expect((await r.json()).code).toBe("module_disabled");
      } finally {
        await dropModuleWorld(lone);
      }
    }, 240_000);
  },
);
