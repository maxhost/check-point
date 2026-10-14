import sharp from "sharp";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { aiRequests } from "@mi-pasaporte/db/schema";

/** Espia sobre la validacion del producto (`ownProduct`), con la implementacion REAL detras. */
vi.mock("./recipes", async (importOriginal) => {
  const real = await importOriginal<typeof import("./recipes")>();
  return { ...real, ownProduct: vi.fn(real.ownProduct) };
});
const { ownProduct } = await import("./recipes");
import {
  type ModuleWorld,
  dropModuleWorld,
  enableModules,
  modulesIntegrationEnabled,
  postModulePhotos,
  seedModuleWorld,
  seedProduct,
} from "../modules-integration-support";

/**
 * Spec 0223 — la receta desde FOTOS por la ruta real (multipart), con el proveedor FALSO del
 * entorno (`AI_PROVIDER=fake`): este test nunca llama a OpenAI. Spec 0224: el uso va a
 * `core.ai_request` (tarea `recipes.recipe_photo`) y el producto se valida UNA sola vez. Stock:
 * `stock/draft-photo.neon.integration.test.ts`.
 */

let world: ModuleWorld;
let other: ModuleWorld;
let png: Buffer;

beforeEach(() => {
  vi.mocked(ownProduct).mockClear();
});

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
  "Receta desde fotos (spec 0223)",
  () => {
    it("Recetas: producto propio → 200 y fila de la foto de receta; producto ajeno → 404 sin fila", async () => {
      const mine = await seedProduct(world, "Medialuna", "1.00");
      const r = await postPhotos(
        `recipes/${mine}/draft-photo`,
        world.cookie,
        3,
      );
      expect(r.status).toBe(200);
      expect((await r.json()).draft).toMatchObject({ lines: [], unparsed: [] });
      const recipeRows = (await rows(world.businessId)).filter(
        (row) => row.task === "recipes.recipe_photo",
      );
      expect(recipeRows).toEqual([
        expect.objectContaining({
          inputImages: 3,
          inputChars: 0,
          provider: "fake",
          status: "ok",
        }),
      ]);
      // El producto se valida UNA vez (antes de las fotos), no dos (spec 0224 §6).
      expect(vi.mocked(ownProduct)).toHaveBeenCalledTimes(1);

      const foreign = await seedProduct(other, "Ajena", "1.00");
      const before = (await rows(world.businessId)).length;
      const r2 = await postPhotos(
        `recipes/${foreign}/draft-photo`,
        world.cookie,
        1,
      );
      expect(r2.status).toBe(404);
      expect((await r2.json()).code).toBe("product_not_found");
      expect((await rows(world.businessId)).length).toBe(before);
    }, 120_000);

    it("0 fotos → 422 invalid_photos sin fila (el producto se valida antes)", async () => {
      const mine = await seedProduct(world, "Pizza", "1.00");
      const before = (await rows(world.businessId)).length;
      const r = await postPhotos(
        `recipes/${mine}/draft-photo`,
        world.cookie,
        0,
      );
      expect(r.status).toBe(422);
      expect((await r.json()).code).toBe("invalid_photos");
      expect((await rows(world.businessId)).length).toBe(before);
    }, 120_000);
  },
);
