import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  dropBusiness,
  integrationEnabled as enabled,
  seedBusiness,
  seedMember,
  type Seed,
} from "./counter-integration-support";
import { conCookie, cookieDe } from "./permissions-integration-support";
import { getDb } from "./db";
import { memberships, users } from "./schema";
import { POST as CREATE_CATEGORY } from "../app/api/catalog/category/route";
import {
  DELETE as DELETE_CATEGORY,
  PUT as RENAME_CATEGORY,
} from "../app/api/catalog/category/[id]/route";
import { POST as CREATE_PRODUCT } from "../app/api/catalog/product/route";
import {
  DELETE as DELETE_PRODUCT,
  PUT as UPDATE_PRODUCT,
} from "../app/api/catalog/product/[id]/route";
import { POST as CREATE_LOCATION } from "../app/api/locations/route";

/**
 * Spec 0086 §3/§7 — **EL CATÁLOGO DELEGADO Y EL EJE PLAN, contra la base y con sesiones
 * REALES**: un permiso que abre crear y editar y **no** borrar, y el tope del plan que
 * alcanza al integrante por construcción. El MOSTRADOR —la otra familia que cambia de
 * comportamiento en esta spec— tiene su propio archivo
 * (`permisos-mostrador.neon.integration.test.ts`), por el hook `file-size`.
 *
 * `api-permission-surfaces.test.ts` ya mide que el guard muerde en las once entradas; lo que
 * sólo se puede medir acá es el **desenlace completo del camino feliz de un INTEGRANTE**
 * —una fila escrita en la base por alguien que no es el owner— y el **aislamiento por
 * negocio**, que con `getDb` doblado tendría los dos negocios colapsados en un objeto.
 *
 * **Cada caso de aislamiento lleva su control positivo en el MISMO vector.** Un rojo sin él
 * no distingue «aislado» de «roto».
 */
const catalogo = {
  crearCategoria: (cookie: string, body: unknown) =>
    CREATE_CATEGORY(conCookie("/api/catalog/category", "POST", cookie, body)),
  renombrarCategoria: (cookie: string, id: string, body: unknown) =>
    RENAME_CATEGORY(
      conCookie(`/api/catalog/category/${id}`, "PUT", cookie, body),
      { params: Promise.resolve({ id }) },
    ),
  borrarCategoria: (cookie: string, id: string) =>
    DELETE_CATEGORY(
      conCookie(`/api/catalog/category/${id}`, "DELETE", cookie),
      { params: Promise.resolve({ id }) },
    ),
  crearProducto: (cookie: string, body: unknown) =>
    CREATE_PRODUCT(conCookie("/api/catalog/product", "POST", cookie, body)),
  editarProducto: (cookie: string, id: string, body: unknown) =>
    UPDATE_PRODUCT(
      conCookie(`/api/catalog/product/${id}`, "PUT", cookie, body),
      {
        params: Promise.resolve({ id }),
      },
    ),
  borrarProducto: (cookie: string, id: string) =>
    DELETE_PRODUCT(conCookie(`/api/catalog/product/${id}`, "DELETE", cookie), {
      params: Promise.resolve({ id }),
    }),
};

describe.skipIf(!enabled)(
  "los permisos delegados contra Neon (spec 0086)",
  () => {
    let a: Seed;
    let b: Seed;
    const extras: string[] = [];
    /** Integrante de A con `catalog` y SIN `counter`: prueba las dos familias a la vez. */
    let catalogueroA = "";
    let cookieCatalogueroA = "";
    let categoriaA = "";
    let productoA = "";
    let categoriaB = "";
    let productoB = "";
    /** Integrante de A con `locations`: el vector del eje PLAN (§7). */
    let cookieLocalesA = "";

    const seedCatalogo = async (seed: Seed, sufijo: string) => {
      const cookie = await cookieDe(seed.userId);
      const cat = await catalogo.crearCategoria(cookie, {
        name: `Cat ${sufijo}`,
      });
      const { id: categoryId } = await cat.json();
      const prod = await catalogo.crearProducto(cookie, {
        name: `Prod ${sufijo}`,
        categoryId,
        unitPrice: "1.00",
      });
      const producto = await prod.json();
      return { categoryId, productId: producto.id as string };
    };

    beforeAll(async () => {
      a = await seedBusiness({
        name: "Deleg A",
        // `points` + `per_purchase` lo rechaza `loyalty_program_accrual_points_mode_check`
        // («Puntos nunca acumula por compra»): el par válido es `per_amount` con bloque.
        kind: "points",
        mode: "per_amount",
        grant: 10,
        blockAmount: "1.00",
      });
      b = await seedBusiness({
        name: "Deleg B",
        // `points` + `per_purchase` lo rechaza `loyalty_program_accrual_points_mode_check`
        // («Puntos nunca acumula por compra»): el par válido es `per_amount` con bloque.
        kind: "points",
        mode: "per_amount",
        grant: 10,
        blockAmount: "1.00",
      });
      catalogueroA = await seedMember({
        businessId: a.business.id,
        permissions: ["catalog"],
      });
      const localesA = await seedMember({
        businessId: a.business.id,
        permissions: ["locations"],
      });
      extras.push(catalogueroA, localesA);
      cookieCatalogueroA = await cookieDe(catalogueroA);
      cookieLocalesA = await cookieDe(localesA);
      ({ categoryId: categoriaA, productId: productoA } = await seedCatalogo(
        a,
        "A",
      ));
      ({ categoryId: categoriaB, productId: productoB } = await seedCatalogo(
        b,
        "B",
      ));
    }, 240_000);

    afterAll(async () => {
      for (const seed of [a, b]) {
        if (seed) await dropBusiness(seed.business.id);
      }
      for (const userId of [...extras, a?.userId, b?.userId].filter(Boolean)) {
        await getDb()
          .delete(memberships)
          .where(eq(memberships.userId, userId as string));
        await getDb()
          .delete(users)
          .where(eq(users.id, userId as string));
      }
    }, 180_000);

    /** **CREAR Y EDITAR SÍ**, las dos entidades y los dos verbos: es el camino feliz completo
     * de un integrante escribiendo en la base del negocio de otro. */
    it("un STAFF con `catalog` CREA y EDITA categoría y producto", async () => {
      const cat = await catalogo.crearCategoria(cookieCatalogueroA, {
        name: `Nueva ${randomUUID().slice(0, 6)}`,
      });
      expect(cat.status).toBe(201);
      const categoria = await cat.json();

      const renombrada = await catalogo.renombrarCategoria(
        cookieCatalogueroA,
        categoria.id,
        { name: "Renombrada por el staff" },
      );
      expect(renombrada.status).toBe(200);
      expect((await renombrada.json()).name).toBe("Renombrada por el staff");

      const prod = await catalogo.crearProducto(cookieCatalogueroA, {
        name: `Prod ${randomUUID().slice(0, 6)}`,
        categoryId: categoria.id,
        unitPrice: "2.50",
      });
      expect(prod.status).toBe(201);
      const producto = await prod.json();

      const editado = await catalogo.editarProducto(
        cookieCatalogueroA,
        producto.id,
        { name: "Editado por el staff", categoryId: categoria.id },
      );
      expect(editado.status).toBe(200);
      expect((await editado.json()).name).toBe("Editado por el staff");
    }, 240_000);

    /** **BORRAR NO, y son los DOS `DELETE`, no uno** (ADR 0079 §2, contrato §2.1). El borrado
     * del catálogo es DURO —`schema/catalog.ts` no tiene `archived_at`— así que ningún toggle
     * lo abre: conserva `requireApiOwner` y su `not_owner`, que ahí sigue siendo literal.
     *
     * CONTROL POSITIVO en el mismo vector: el OWNER borra lo mismo y recibe 200. Sin él, un
     * `DELETE` roto para todos pasaría este caso. */
    it("un STAFF con `catalog` recibe 403 `not_owner` en los DOS borrados, y el OWNER no", async () => {
      const prodStaff = await catalogo.borrarProducto(
        cookieCatalogueroA,
        productoA,
      );
      expect(prodStaff.status).toBe(403);
      expect((await prodStaff.json()).code).toBe("not_owner");

      const catStaff = await catalogo.borrarCategoria(
        cookieCatalogueroA,
        categoriaA,
      );
      expect(catStaff.status).toBe(403);
      expect((await catStaff.json()).code).toBe("not_owner");

      const cookieOwnerA = await cookieDe(a.userId);
      expect(
        (await catalogo.borrarProducto(cookieOwnerA, productoA)).status,
      ).toBe(200);
      expect(
        (await catalogo.borrarCategoria(cookieOwnerA, categoriaA)).status,
      ).toBe(200);
    }, 240_000);

    /** AISLAMIENTO de la familia `catalog`, con su control positivo: el integrante de A tiene
     * el permiso y aun así no toca una entidad de B — el `businessId` sale de la SESIÓN— y la
     * fila de B sigue con su nombre. */
    it("aislamiento: un STAFF de A con `catalog` no edita el producto ni la categoría de B", async () => {
      const producto = await catalogo.editarProducto(
        cookieCatalogueroA,
        productoB,
        { name: "Secuestrado", categoryId: categoriaB },
      );
      expect(producto.status).toBe(404);

      const categoria = await catalogo.renombrarCategoria(
        cookieCatalogueroA,
        categoriaB,
        { name: "Secuestrada" },
      );
      expect(categoria.status).toBe(404);

      // CONTROL POSITIVO: la MISMA llamada sobre la categoría propia responde 200.
      const propia = await catalogo.crearCategoria(cookieCatalogueroA, {
        name: `Propia ${randomUUID().slice(0, 6)}`,
      });
      expect(propia.status).toBe(201);
    }, 240_000);

    /**
     * **EL EJE PLAN ALCANZA AL STAFF POR CONSTRUCCIÓN, y es el invariante del §7.**
     *
     * `EntitlementContext` sale de la **suscripción del NEGOCIO** y no tiene noción de
     * usuario, así que un integrante con `locations` choca contra el MISMO tope que el owner
     * **sin una línea nueva**. Lo que hay que defender es el inverso: que el guard nuevo no
     * se haya vuelto un segundo camino que llegue al `INSERT` sin pasar por el writer.
     *
     * El negocio sembrado no tiene suscripción → `locations.max` cae al fallback (1) y ya
     * tiene su local, así que el segundo choca. **Es el oráculo de la mutación M6.**
     *
     * El `409 location_limit` es además la prueba de que el integrante llegó al WRITER: un
     * 403 acá diría que lo frenó el guard, que es otra cosa.
     */
    it("el TOPE DEL PLAN alcanza a un STAFF con `locations`: 409 `location_limit`", async () => {
      const response = await CREATE_LOCATION(
        conCookie("/api/locations", "POST", cookieLocalesA, {
          name: `Sucursal ${randomUUID().slice(0, 6)}`,
          address: { label: "Calle Falsa 123" },
        }),
      );
      expect(response.status).toBe(409);
      expect((await response.json()).code).toBe("location_limit");
    }, 180_000);
  },
);
