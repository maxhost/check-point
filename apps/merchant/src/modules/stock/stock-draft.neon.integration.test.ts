import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { aiRequests } from "@mi-pasaporte/db/schema";
import {
  type ModuleWorld,
  api,
  dropModuleWorld,
  enableModules,
  modulesIntegrationEnabled,
  newItem,
  seedModuleWorld,
} from "../modules-integration-support";
import { ScriptedAiProvider, aiRaw } from "../../server/ai/ai-test-support";
import { countAiRequests } from "../../server/ai/service";
import { buildDraft } from "./draft";

/** Spec 0212 — el borrador con un proveedor guionado INYECTADO (sin llamadas reales a OpenAI). Spec
 * 0224: el uso se registra en `core.ai_request` (tarea `stock.entry_text`). */

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

const scripted = (lines: unknown[]) =>
  new ScriptedAiProvider({
    id: "scripted",
    model: "test-model",
    run: () =>
      aiRaw({ lines, unparsed: [] }, { inputTokens: 10, outputTokens: 5 }),
  });

const rows = () =>
  getDb()
    .select()
    .from(aiRequests)
    .where(
      and(
        eq(aiRequests.businessId, world.businessId),
        eq(aiRequests.task, "stock.entry_text"),
      ),
    );

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
      // El modelo solo vio los insumos de ESTE negocio (en el contexto del servidor).
      const context = provider.calls[0].input.context ?? "";
      expect(context).toContain("Harina");
      expect(context).not.toContain("Huevos");
      expect(provider.calls[0].input.text).toBe(text);

      const [row] = await rows();
      expect(row).toMatchObject({
        task: "stock.entry_text",
        taskVersion: "v1",
        mode: "sync",
        provider: "scripted",
        model: "test-model",
        status: "ok",
        failureCode: null,
        outputItems: 2,
        inputChars: text.length,
        inputImages: 0,
        inputTokens: 10,
        outputTokens: 5,
        createdByUserId: world.ownerId,
      });
      expect(JSON.stringify(row)).not.toContain("harina por 25");
      const since = new Date(Date.now() - 60_000);
      expect(
        await countAiRequests(world.businessId, "stock.entry_text", since),
      ).toBe(1);
      expect(
        await countAiRequests(other.businessId, "stock.entry_text", since),
      ).toBe(0);
    }, 120_000);

    it("proveedor que falla → 503 draft_unavailable y fila failed", async () => {
      const failing = new ScriptedAiProvider({
        id: "scripted",
        model: null,
        run: () => {
          throw new Error("boom");
        },
      });
      await expect(
        buildDraft(world.businessId, world.ownerId, { text: "algo" }, failing),
      ).rejects.toMatchObject({ status: 503, code: "draft_unavailable" });
      const all = await rows();
      expect(
        all
          .filter((r) => r.status === "failed")
          .map((r) => [r.provider, r.failureCode]),
      ).toEqual([["scripted", "provider_error"]]);
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
