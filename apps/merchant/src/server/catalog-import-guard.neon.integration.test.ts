import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  cerrarImport,
  importIntegrationEnabled,
  limpiarNegocio,
  seedImport,
  seedNegocio,
  sembrarCategoria,
  sembrarProducto,
  type SeedImport,
} from "./catalog-import-integration-support";

/**
 * Spec 0092 §3 / ADR 0086 — **EL ALTA MANUAL BLOQUEADA MIENTRAS SE IMPORTA, CONTRA POSTGRES.**
 *
 * Las dos altas entran **por la ruta** a proposito: el guard vive en el servicio, pero lo que
 * la pantalla ve es el cuerpo que serializa `catalogError`, y el `code` es lo unico que le
 * permite distinguir este 409 de un duplicado. Un test que llamara a `createCategory` directo
 * dejaria sin oraculo exactamente esa mitad.
 *
 * Editar, renombrar y borrar se prueban a nivel servicio: no cambian, y lo que hay que pinnear
 * es que **siguen permitidos** (el writer es aditivo y no compite con ellos).
 */
const sesion = vi.hoisted(() => ({ businessId: "" }));

vi.mock("./api-permission", () => ({
  requireApiPermission: async () => ({
    business: {
      id: sesion.businessId,
      slug: "negocio",
      countryCode: "EC",
      currencyCode: "USD",
      status: "active",
      suspensionReason: null,
    },
    userId: "u-1",
  }),
}));

const { POST: CREAR_CATEGORIA } =
  await import("../app/api/catalog/category/route");
const { POST: CREAR_PRODUCTO } =
  await import("../app/api/catalog/product/route");
const { GET: VER_CATALOGO } = await import("../app/api/catalog/route");
const {
  deleteCategory,
  deleteProduct,
  listCatalog,
  renameCategory,
  updateProduct,
} = await import("./catalog");

const pedir = (url: string, body: unknown) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const crearCategoria = (name: string) =>
  CREAR_CATEGORIA(pedir("http://localhost/api/catalog/category", { name }));

const crearProducto = (name: string) =>
  CREAR_PRODUCTO(
    pedir("http://localhost/api/catalog/product", {
      name,
      availableAllLocations: true,
    }),
  );

const ABIERTOS = ["pending_upload", "queued", "analyzing", "ready"] as const;
const TERMINALES = ["accepted", "failed", "cancelled", "expired"] as const;

describe.skipIf(!importIntegrationEnabled)("el alta manual y el import", () => {
  let a: SeedImport;
  let b: SeedImport;

  beforeAll(async () => {
    a = await seedNegocio("Guard A");
    b = await seedNegocio("Guard B");
    sesion.businessId = a.businessId;
  }, 60_000);

  afterAll(async () => {
    for (const seed of [a, b]) if (seed) await limpiarNegocio(seed);
  }, 60_000);

  it("con un import ABIERTO, las dos altas dan 409 con su code", async () => {
    const id = await seedImport({
      businessId: a.businessId,
      userId: a.userId,
      status: "queued",
    });
    try {
      const cat = await crearCategoria("Postres de la carrera");
      expect(cat.status).toBe(409);
      expect(await cat.json()).toMatchObject({
        code: "catalog_import_in_progress",
      });

      const prod = await crearProducto("Flan de la carrera");
      expect(prod.status).toBe(409);
      expect(await prod.json()).toMatchObject({
        code: "catalog_import_in_progress",
      });

      const catalogo = await listCatalog({
        id: a.businessId,
        currencyCode: "USD",
      });
      expect(catalogo.categories).toHaveLength(0);
      expect(catalogo.products).toHaveLength(0);
    } finally {
      await cerrarImport(id);
    }
  }, 60_000);

  it("los CUATRO estados abiertos bloquean, no solo `analyzing`", async () => {
    for (const status of ABIERTOS) {
      const id = await seedImport({
        businessId: a.businessId,
        userId: a.userId,
        status,
      });
      try {
        const res = await crearCategoria(`Bloqueada en ${status}`);
        expect(
          { status, http: res.status, body: await res.json() },
          `un import ${status} tiene que bloquear el alta`,
        ).toEqual({
          status,
          http: 409,
          body: {
            error:
              "Estamos importando tu menú. Cuando termine vas a poder volver a cargar a mano.",
            code: "catalog_import_in_progress",
          },
        });
      } finally {
        await cerrarImport(id);
      }
    }
  }, 120_000);

  it("los cuatro estados TERMINALES no bloquean nada", async () => {
    for (const status of TERMINALES) {
      await seedImport({
        businessId: a.businessId,
        userId: a.userId,
        status,
      });
      const cat = await crearCategoria(`Libre con ${status}`);
      expect([status, cat.status]).toEqual([status, 201]);
      const prod = await crearProducto(`Producto libre con ${status}`);
      expect([status, prod.status]).toEqual([status, 201]);
    }
  }, 120_000);

  it("el import abierto de OTRO negocio no bloquea a este", async () => {
    const ajeno = await seedImport({
      businessId: b.businessId,
      userId: b.userId,
      status: "analyzing",
    });
    try {
      const cat = await crearCategoria("Categoría del negocio A");
      expect(cat.status).toBe(201);
      const prod = await crearProducto("Producto del negocio A");
      expect(prod.status).toBe(201);
      expect(
        (await listCatalog({ id: a.businessId, currencyCode: "USD" }))
          .importInProgress,
      ).toBe(false);
    } finally {
      await cerrarImport(ajeno);
    }
  }, 60_000);

  it("editar, renombrar y borrar SIGUEN funcionando con un import abierto", async () => {
    const negocio = { id: a.businessId, currencyCode: "USD" };
    const categoryId = await sembrarCategoria(a.businessId, "Para editar");
    const productId = await sembrarProducto({
      businessId: a.businessId,
      name: "Para editar",
    });
    const id = await seedImport({
      businessId: a.businessId,
      userId: a.userId,
      status: "analyzing",
    });
    try {
      await expect(
        renameCategory(negocio, categoryId, { name: "Renombrada" }),
      ).resolves.toMatchObject({ name: "Renombrada" });
      await expect(
        updateProduct(negocio, productId, {
          name: "Editado",
          availableAllLocations: true,
        }),
      ).resolves.toMatchObject({ name: "Editado" });
      await expect(deleteProduct(negocio, productId)).resolves.toBeTruthy();
      await expect(deleteCategory(negocio, categoryId)).resolves.toBeTruthy();
    } finally {
      await cerrarImport(id);
    }
  }, 60_000);

  it("`GET /api/catalog` trae `importInProgress` y ninguna clave interna", async () => {
    const abierto = await VER_CATALOGO(
      new Request("http://localhost/api/catalog"),
    );
    expect(abierto.status).toBe(200);
    expect((await abierto.json()).importInProgress).toBe(false);

    const id = await seedImport({
      businessId: a.businessId,
      userId: a.userId,
      status: "analyzing",
      providerJobId: `job-${a.businessId}`,
      draft: { categories: [{ name: "extraccion cruda del modelo" }] },
    });
    try {
      const res = await VER_CATALOGO(
        new Request("http://localhost/api/catalog"),
      );
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.importInProgress).toBe(true);
      // Allow-list del GET: el booleano y nada mas. Ni el id del import, ni su estado, ni
      // el `draft`, ni la llave del proveedor.
      expect(Object.keys(body).sort()).toEqual([
        "categories",
        "currencyCode",
        "importInProgress",
        "locations",
        "products",
      ]);
      expect(JSON.stringify(body)).not.toContain("extraccion cruda");
      expect(JSON.stringify(body)).not.toContain("job-");
    } finally {
      await cerrarImport(id);
    }
  }, 60_000);
});
