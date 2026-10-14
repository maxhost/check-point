import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { aiRequests } from "@mi-pasaporte/db/schema";
import {
  type ModuleWorld,
  dropModuleWorld,
  enableModules,
  moduleStaff,
  modulesIntegrationEnabled,
  newItem,
  postModulePhotos,
  seedModuleWorld,
} from "../modules-integration-support";
import { ScriptedAiProvider, aiRaw } from "../../server/ai/ai-test-support";
import { buildPhotoDraft } from "./draft";

/**
 * Spec 0223 — el borrador de Stock desde FOTOS por la ruta real (multipart), con el proveedor FALSO
 * del entorno (`AI_PROVIDER=fake`, `vitest.setup.ts`): este test nunca llama a OpenAI. Spec 0224: el
 * uso va a `core.ai_request` (tarea `stock.entry_photo`); permisos, modulo apagado y fotos invalidas
 * sin fila. Recetas: `recipes/draft-photo.neon.integration.test.ts`.
 */

let world: ModuleWorld;
let png: Buffer;

beforeAll(async () => {
  png = await sharp({
    create: { width: 60, height: 40, channels: 3, background: "#ddd" },
  })
    .png()
    .toBuffer();
  world = await seedModuleWorld("Foto");
  await enableModules(world, ["stock"]);
}, 240_000);

afterAll(async () => {
  await dropModuleWorld(world);
}, 240_000);

/** El POST del despachador con `count` copias de la foto de prueba. */
const postPhotos = (path: string, cookie: string, count: number) =>
  postModulePhotos(
    path,
    cookie,
    Array.from({ length: count }, () => png),
  );

const rows = (businessId: string) =>
  getDb()
    .select()
    .from(aiRequests)
    .where(eq(aiRequests.businessId, businessId));

describe.skipIf(!modulesIntegrationEnabled)(
  "Borrador desde fotos (spec 0223)",
  () => {
    it("Stock por la ruta: 200 con el borrador y fila de uso de la foto, input_images=2, sin texto", async () => {
      const r = await postPhotos("stock/entries/draft-photo", world.cookie, 2);
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ draft: { lines: [], unparsed: [] } });
      const [row] = await rows(world.businessId);
      expect(row).toMatchObject({
        task: "stock.entry_photo",
        mode: "sync",
        inputImages: 2,
        inputChars: 0,
        provider: "fake",
        model: null,
        status: "ok",
        outputItems: 0,
      });
    }, 120_000);

    /** ORACULO DE M5 (spec 0224): se manda PNG; lo que llega al proveedor tiene que ser JPEG
     * (`FF D8 FF`). El adaptador no normaliza (rotula `image/jpeg` igual): no hay guard hermano. */
    it("el proveedor recibe las fotos ya en JPEG (aunque se mande PNG) y los insumos del negocio", async () => {
      const harina = await newItem(world, "Harina");
      const provider = new ScriptedAiProvider({
        id: "scripted",
        model: "m",
        run: () =>
          aiRaw({
            lines: [
              {
                itemId: harina.id,
                name: "Harina",
                quantity: "2",
                unit: "kg",
                totalCost: "3500",
                sourceText: "HARINA 000 X 2KG 3.500",
              },
            ],
            unparsed: [],
          }),
      });
      const form = new FormData();
      form.append(
        "photos",
        new File([new Uint8Array(png)], "t.png", { type: "image/png" }),
      );
      expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
      const { draft } = await buildPhotoDraft(
        world.businessId,
        world.ownerId,
        new Request("http://x.test", { method: "POST", body: form }),
        provider,
      );
      const [call] = provider.calls;
      expect(call.task.id).toBe("stock.entry_photo");
      expect(call.input.images).toHaveLength(1);
      const jpeg = call.input.images?.[0]?.jpeg ?? Buffer.alloc(0);
      expect([...jpeg.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
      expect((await sharp(jpeg).metadata()).format).toBe("jpeg");
      expect(call.input.context).toContain("Harina");
      expect(call.input.context).toContain("FOTOS: 1");
      expect(call.input.text).toBeUndefined();
      expect(draft.lines[0]).toMatchObject({
        itemId: harina.id,
        isNew: false,
        totalCost: "3500.00",
      });
    }, 120_000);

    it("0 fotos → 422 invalid_photos y no registra uso", async () => {
      const before = (await rows(world.businessId)).length;
      const r = await postPhotos("stock/entries/draft-photo", world.cookie, 0);
      expect(r.status).toBe(422);
      expect((await r.json()).code).toBe("invalid_photos");
      expect((await rows(world.businessId)).length).toBe(before);
    }, 120_000);

    it("integrante sin `stock` → 403 missing_permission; con `stock` → 200", async () => {
      const without = await moduleStaff(world, ["catalog"]);
      const denied = await postPhotos("stock/entries/draft-photo", without, 1);
      expect(denied.status).toBe(403);
      expect((await denied.json()).code).toBe("missing_permission");
      const withStock = await moduleStaff(world, ["stock"]);
      expect(
        (await postPhotos("stock/entries/draft-photo", withStock, 1)).status,
      ).toBe(200);
    }, 120_000);

    it("con el modulo apagado → 403 module_disabled", async () => {
      const lone = await seedModuleWorld("Foto sin modulo");
      try {
        const r = await postPhotos("stock/entries/draft-photo", lone.cookie, 1);
        expect(r.status).toBe(403);
        expect((await r.json()).code).toBe("module_disabled");
      } finally {
        await dropModuleWorld(lone);
      }
    }, 240_000);
  },
);
