import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  importIntegrationEnabled as enabled,
  limpiarNegocio,
} from "./catalog-import-integration-support";
import { conCookie } from "./permissions-integration-support";
import {
  openSessionCookie,
  seedUnverifiedOwner,
  type OwnerSeed,
} from "./unverified-owner-support";
import { getDb } from "@mi-pasaporte/db";
import { productCategories, products } from "@mi-pasaporte/db/schema";

/** R2 fake: el presign necesita credenciales que la rama de integracion no tiene (mismo doble
 * que `catalog-import.neon.integration.test.ts`); lo que esta suite mide es el GUARD y las filas. */
vi.mock("@mi-pasaporte/domain/server/r2", async () => {
  const real = await vi.importActual<
    typeof import("@mi-pasaporte/domain/server/r2")
  >("@mi-pasaporte/domain/server/r2");
  return {
    ...real,
    createTemporaryUploadUrl: async (input: { objectKey: string }) =>
      `https://r2.fake/${input.objectKey}?firmada=1`,
    deleteObjectKeys: async () => undefined,
  };
});

const { GET: CATALOG } = await import("../app/api/catalog/route");
const { POST: CATEGORY_POST } =
  await import("../app/api/catalog/category/route");
const { DELETE: CATEGORY_DELETE } =
  await import("../app/api/catalog/category/[id]/route");
const { POST: PRODUCT_POST } = await import("../app/api/catalog/product/route");
const { PUT: PRODUCT_PUT, DELETE: PRODUCT_DELETE } =
  await import("../app/api/catalog/product/[id]/route");
const { GET: STOCK_SEARCH } =
  await import("../app/api/catalog/stock/search/route");
const { POST: IMPORTS_POST, GET: IMPORTS_GET } =
  await import("../app/api/catalog/imports/route");
const { GET: IMPORT_GET, DELETE: IMPORT_DELETE } =
  await import("../app/api/catalog/imports/[id]/route");

/**
 * Spec 0165 / ADR 0125 — **EL CATALOGO NO EXIGE EMAIL VERIFICADO**, contra la base, con un owner
 * que nace como nace un alta real (`seedUnverifiedOwner`: `email_verified = false`) y una sesion
 * REAL. Todo el ciclo: categoria, producto, edicion, lista, stock, import con IA (reservar,
 * listar, ver, cancelar) y los dos borrados duros, que siguen siendo SOLO del owner (el staff
 * con `catalog` → `403 not_owner` lo fija `permisos-delegados.neon.integration.test.ts`).
 *
 * **Los oraculos de escritura son la BASE**: el nombre editado y los borrados se leen por SQL.
 * `uploads`/`analyze` (R2 y proveedor) quedan en el barrido de `catalog-sin-email-guard.test.ts`.
 */
describe.skipIf(!enabled)(
  "el catálogo sin email verificado (spec 0165, ADR 0125)",
  () => {
    let seed: OwnerSeed;
    let cookie = "";
    let categoryId = "";
    let productId = "";
    let importId = "";
    const responses: Response[] = [];

    /** Cada respuesta pasa por aca: ninguna puede traer `email_not_verified` (se asevera ANTES
     * que el status, para que un rojo diga el motivo y no solo un 403), y se cuentan al final. */
    const keep = async (response: Response) => {
      responses.push(response);
      expect(await response.clone().text()).not.toContain("email_not_verified");
      return response;
    };
    const conId = (id: string) => ({ params: Promise.resolve({ id }) });
    const nameOf = async (id: string) => {
      const [row] = await getDb()
        .select({ name: products.name })
        .from(products)
        .where(eq(products.id, id));
      return row?.name ?? null;
    };

    beforeAll(async () => {
      process.env.STOCK_PROVIDER = "fake";
      seed = await seedUnverifiedOwner("catalog-sin-email");
      cookie = await openSessionCookie(seed.ownerId);
    }, 60_000);

    afterAll(async () => {
      if (seed) {
        await limpiarNegocio({
          businessId: seed.businessId,
          userId: seed.ownerId,
          slug: seed.slug,
        });
      }
    }, 60_000);

    it("ORÁCULO DE M1 — crear categoría → 201", async () => {
      const response = await keep(
        await CATEGORY_POST(
          conCookie("/api/catalog/category", "POST", cookie, {
            name: "Bebidas",
          }),
        ),
      );
      expect(response.status).toBe(201);
      categoryId = (await response.json()).id as string;
      expect(categoryId).toBeTruthy();
    }, 60_000);

    it("crear producto → 201 y editarlo → 200 con el nombre nuevo EN LA BASE", async () => {
      const created = await keep(
        await PRODUCT_POST(
          conCookie("/api/catalog/product", "POST", cookie, {
            name: "Café",
            categoryId,
            unitPrice: "1.00",
          }),
        ),
      );
      expect(created.status).toBe(201);
      productId = (await created.json()).id as string;
      expect(await nameOf(productId)).toBe("Café");

      const edited = await keep(
        await PRODUCT_PUT(
          conCookie(`/api/catalog/product/${productId}`, "PUT", cookie, {
            name: "Café doble",
            categoryId,
            unitPrice: "1.50",
          }),
          conId(productId),
        ),
      );
      expect(edited.status).toBe(200);
      expect(await nameOf(productId)).toBe("Café doble");
    }, 60_000);

    it("GET /api/catalog → 200 y lista el producto; stock → 200", async () => {
      const list = await keep(
        await CATALOG(conCookie("/api/catalog", "GET", cookie)),
      );
      expect(list.status).toBe(200);
      const body = await list.json();
      expect(
        body.products.map((p: { id: string; name: string }) => [p.id, p.name]),
      ).toEqual([[productId, "Café doble"]]);

      const stock = await keep(
        await STOCK_SEARCH(
          conCookie("/api/catalog/stock/search?q=cafe", "GET", cookie),
        ),
      );
      expect(stock.status).toBe(200);
      expect((await stock.json()).provider).toBe("fake");
    }, 60_000);

    it("import con IA: reservar → 201, listar y ver → 200, cancelar → 200 `cancelled`", async () => {
      const created = await keep(
        await IMPORTS_POST(
          conCookie("/api/catalog/imports", "POST", cookie, {
            files: [
              {
                name: "menu.jpg",
                contentType: "image/jpeg",
                byteSize: 100_000,
              },
            ],
          }),
        ),
      );
      expect(created.status).toBe(201);
      importId = (await created.json()).import.id as string;

      const list = await keep(
        await IMPORTS_GET(conCookie("/api/catalog/imports", "GET", cookie)),
      );
      expect(list.status).toBe(200);
      expect((await list.json()).import.id).toBe(importId);

      const one = await keep(
        await IMPORT_GET(
          conCookie(`/api/catalog/imports/${importId}`, "GET", cookie),
          conId(importId),
        ),
      );
      expect(one.status).toBe(200);

      const cancelled = await keep(
        await IMPORT_DELETE(
          conCookie(`/api/catalog/imports/${importId}`, "DELETE", cookie),
          conId(importId),
        ),
      );
      expect(cancelled.status).toBe(200);
      expect((await cancelled.json()).import.status).toBe("cancelled");
    }, 60_000);

    it("los dos borrados DUROS del owner → 200 y las filas ya no están", async () => {
      const product = await keep(
        await PRODUCT_DELETE(
          conCookie(`/api/catalog/product/${productId}`, "DELETE", cookie),
          conId(productId),
        ),
      );
      expect(product.status).toBe(200);
      expect(await nameOf(productId)).toBeNull();

      const category = await keep(
        await CATEGORY_DELETE(
          conCookie(`/api/catalog/category/${categoryId}`, "DELETE", cookie),
          conId(categoryId),
        ),
      );
      expect(category.status).toBe(200);
      const rows = await getDb()
        .select({ id: productCategories.id })
        .from(productCategories)
        .where(eq(productCategories.id, categoryId));
      expect(rows).toEqual([]);
    }, 60_000);

    it("el ciclo entero corrio: 11 respuestas, ninguna `email_not_verified`", () => {
      // Piso: sin el, un ciclo cortado en el primer caso dejaria la asercion de `keep` sin correr.
      expect(responses.length).toBe(11);
    });
  },
);
