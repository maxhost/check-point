import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { aiRequests, stockItems } from "@mi-pasaporte/db/schema";
import {
  type ModuleWorld,
  dropModuleWorld,
  enableModules,
  modulesIntegrationEnabled,
  seedModuleWorld,
} from "../modules-integration-support";
import { POST } from "../../app/api/modules/[moduleId]/[[...path]]/route";

/** R1 replaces product-bound photos with a named independent recipe, preserving
 * the real multipart/image validation and AI audit through the guarded route. */
let world: ModuleWorld;
let other: ModuleWorld;
let png: Buffer;

beforeAll(async () => {
  png = await sharp({
    create: { width: 60, height: 40, channels: 3, background: "#ddd" },
  })
    .png()
    .toBuffer();
  world = await seedModuleWorld("Foto receta");
  other = await seedModuleWorld("Foto receta ajena");
  await enableModules(world, ["stock", "recipes"]);
  await enableModules(other, ["stock", "recipes"]);
}, 240_000);

afterAll(async () => {
  await dropModuleWorld(world);
  await dropModuleWorld(other);
}, 240_000);

function postPhotos(
  name: string | null,
  count: number,
  bytes: Buffer = png,
  cookie = world.cookie,
  path = ["draft-photo"],
) {
  const form = new FormData();
  if (name !== null) form.set("name", name);
  for (let i = 0; i < count; i++)
    form.append(
      "photos",
      new File([new Uint8Array(bytes)], `photo-${i}.png`, {
        type: "image/png",
      }),
    );
  return POST(
    new Request("http://localhost/api/modules/recipes/" + path.join("/"), {
      method: "POST",
      headers: { cookie },
      body: form,
    }),
    { params: Promise.resolve({ moduleId: "recipes", path }) },
  );
}

const rows = (businessId: string) =>
  getDb()
    .select()
    .from(aiRequests)
    .where(eq(aiRequests.businessId, businessId));

describe.skipIf(!modulesIntegrationEnabled)(
  "Fotos de receta independiente (SPEC0232)",
  () => {
    it("nombre sin producto →200, audita tres fotos y no crea insumos", async () => {
      const before = await getDb()
        .select({ id: stockItems.id })
        .from(stockItems)
        .where(eq(stockItems.businessId, world.businessId));
      const response = await postPhotos("Sopa sin producto", 3);
      expect(response.status).toBe(200);
      expect((await response.json()).draft).toMatchObject({
        lines: [],
        unparsed: [],
      });
      expect(
        (await rows(world.businessId)).filter(
          (row) => row.task === "recipes.recipe_photo",
        ),
      ).toEqual([
        expect.objectContaining({
          inputImages: 3,
          inputChars: 0,
          provider: "fake",
          status: "ok",
        }),
      ]);
      expect(await rows(other.businessId)).toEqual([]);
      expect(
        await getDb()
          .select({ id: stockItems.id })
          .from(stockItems)
          .where(eq(stockItems.businessId, world.businessId)),
      ).toEqual(before);
    }, 120_000);

    it("nombre ausente/largo y multipart inválido cortan antes de uso IA", async () => {
      const before = (await rows(world.businessId)).length;
      for (const name of [null, " ", "x".repeat(121)]) {
        const response = await postPhotos(name, 1);
        expect(response.status).toBe(422);
        expect((await response.json()).code).toBe("invalid_name");
      }
      const response = await POST(
        new Request("http://localhost/api/modules/recipes/draft-photo", {
          method: "POST",
          headers: { cookie: world.cookie },
          body: "not multipart",
        }),
        {
          params: Promise.resolve({
            moduleId: "recipes",
            path: ["draft-photo"],
          }),
        },
      );
      expect(response.status).toBe(422);
      expect((await response.json()).code).toBe("invalid_photos");
      expect((await rows(world.businessId)).length).toBe(before);
    }, 120_000);

    it("0/4 fotos, falso PNG y archivo excesivo conservan validación sin fila IA", async () => {
      const before = (await rows(world.businessId)).length;
      for (const count of [0, 4]) {
        const response = await postPhotos("Sopa", count);
        expect(response.status).toBe(422);
        expect((await response.json()).code).toBe("invalid_photos");
      }
      const unsupported = await postPhotos("Sopa", 1, Buffer.from("fake-png"));
      expect(unsupported.status).toBe(415);
      expect((await unsupported.json()).code).toBe("unsupported_image");
      const huge = await postPhotos(
        "Sopa",
        1,
        Buffer.alloc(4 * 1024 * 1024 + 1),
      );
      expect(huge.status).toBe(413);
      expect((await huge.json()).code).toBe("photos_too_large");
      expect((await rows(world.businessId)).length).toBe(before);
    }, 120_000);

    it("la variante antigua por producto es404 y no consume IA", async () => {
      const before = (await rows(world.businessId)).length;
      const response = await postPhotos("Sopa", 1, png, world.cookie, [
        crypto.randomUUID(),
        "draft-photo",
      ]);
      expect(response.status).toBe(404);
      expect((await response.json()).code).toBe("route_not_found");
      expect((await rows(world.businessId)).length).toBe(before);
    }, 120_000);
  },
);
