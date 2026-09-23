import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  cerrarImport,
  importIntegrationEnabled as enabled,
  limpiarNegocio,
  limpiarUsuarios,
  leerImport,
  seedImport,
  seedIntegrante,
  seedNegocio,
  type SeedImport,
} from "./catalog-import-integration-support";
import { conCookie, cookieDe } from "./permissions-integration-support";

/** R2 fake: el presign necesita credenciales que la rama de integracion no tiene, y lo que
 * estas suites miden son **filas**, no la firma de AWS (que tiene su propio camino). */
vi.mock("./r2", async () => {
  const real = await vi.importActual<typeof import("./r2")>("./r2");
  return {
    ...real,
    createTemporaryUploadUrl: async (input: { objectKey: string }) =>
      `https://r2.fake/${input.objectKey}?firmada=1`,
    deleteObjectKeys: async () => undefined,
  };
});

const { POST: CREAR, GET: LISTAR } =
  await import("../app/api/catalog/imports/route");
const { GET: VER, DELETE: CANCELAR } =
  await import("../app/api/catalog/imports/[id]/route");

/**
 * Spec 0090 §1/§6/§8 — EL CICLO DE VIDA CONTRA LA BASE, con sesiones REALES.
 *
 * Lo que solo se puede medir acá: el **indice unico parcial** de un import abierto por
 * negocio, la **apropiacion** del abandonado, el **409 que NO descarta un `ready`**, el
 * aislamiento entre negocios y el **cupo**, que se cuenta con filas.
 *
 * ORACULO DE M8 (contar el cupo tambien cuando el import termina `failed`) y de M9
 * (apropiarse tambien de un `ready`).
 */
const archivos = {
  files: [{ name: "menu.jpg", contentType: "image/jpeg", byteSize: 100_000 }],
};

const BORRADOR = {
  version: 1,
  categories: [
    {
      draftId: "c1",
      name: "Bebidas",
      resolution: { kind: "create" },
      duplicateCandidate: null,
      products: [
        {
          draftId: "p1",
          name: "Café",
          unitPrice: "3.50",
          priceStatus: "detected",
          sourceText: null,
          include: true,
          duplicateCandidate: null,
        },
      ],
    },
  ],
  warnings: [],
};

describe.skipIf(!enabled)(
  "importación de catálogo contra Neon (spec 0090)",
  () => {
    let a: SeedImport;
    let b: SeedImport;
    /** El caso del INTEGRANTE usa su propio negocio: el cupo diario es por negocio, y los
     * casos de arriba dejan en A un analisis consumido. Compartirlo haria que el orden de
     * los tests decidiera el resultado — un 429 disfrazado de fallo de permisos. */
    let c: SeedImport;
    const extras: string[] = [];
    let cookieA = "";
    let cookieB = "";

    beforeAll(async () => {
      a = await seedNegocio("Import QA A");
      b = await seedNegocio("Import QA B");
      c = await seedNegocio("Import QA C");
      cookieA = await cookieDe(a.userId);
      cookieB = await cookieDe(b.userId);
    });

    afterAll(async () => {
      await limpiarNegocio(a);
      await limpiarNegocio(b);
      await limpiarNegocio(c);
      await limpiarUsuarios(extras);
    });

    const crear = (cookie: string, body: unknown = archivos) =>
      CREAR(conCookie("/api/catalog/imports", "POST", cookie, body));
    const listar = (cookie: string) =>
      LISTAR(conCookie("/api/catalog/imports", "GET", cookie));
    const ver = (cookie: string, id: string) =>
      VER(conCookie(`/api/catalog/imports/${id}`, "GET", cookie), {
        params: Promise.resolve({ id }),
      });
    const cancelar = (cookie: string, id: string) =>
      CANCELAR(conCookie(`/api/catalog/imports/${id}`, "DELETE", cookie), {
        params: Promise.resolve({ id }),
      });

    it("reserva, devuelve URLs firmadas y el activo se retoma con el GET", async () => {
      const creado = await crear(cookieA);
      expect(creado.status).toBe(201);
      const cuerpo = await creado.json();
      expect(cuerpo.import.status).toBe("pending_upload");
      expect(cuerpo.uploads).toHaveLength(1);
      expect(cuerpo.uploads[0]).toMatchObject({
        method: "PUT",
        headers: { "content-type": "image/jpeg" },
      });
      // La clave de R2 NO viaja como campo propio del ticket.
      expect(Object.keys(cuerpo.uploads[0]).sort()).toEqual([
        "fileId",
        "headers",
        "method",
        "url",
      ]);

      const activo = await listar(cookieA);
      expect(activo.status).toBe(200);
      expect((await activo.json()).import.id).toBe(cuerpo.import.id);

      await cancelar(cookieA, cuerpo.import.id);
      const vacio = await listar(cookieA);
      expect((await vacio.json()).import).toBeNull();
    });

    it("un abandonado en `pending_upload` NO traba el siguiente: se lo apropia", async () => {
      const primero = await (await crear(cookieA)).json();
      const segundo = await crear(cookieA);
      expect(segundo.status).toBe(201);
      const nuevo = await segundo.json();
      expect(nuevo.import.id).not.toBe(primero.import.id);
      expect((await leerImport(primero.import.id))?.status).toBe("cancelled");
      await cancelar(cookieA, nuevo.import.id);
    });

    /** ORACULO DE M9: si `POST` se apropiara tambien de un `ready`, este caso se pone rojo
     * dos veces — por el status y porque el borrador desaparece. */
    it("uno en `ready` responde 409 y **el borrador sigue existiendo**", async () => {
      const listo = await seedImport({
        businessId: a.businessId,
        userId: a.userId,
        status: "ready",
        draft: BORRADOR,
      });
      const respuesta = await crear(cookieA);
      expect(respuesta.status).toBe(409);
      expect(await respuesta.json()).toMatchObject({
        code: "catalog_import_in_progress",
      });
      const fila = await leerImport(listo);
      expect(fila?.status).toBe("ready");
      expect(fila?.draft).toMatchObject({ version: 1 });
      // Y la pantalla lo retoma con el GET, que es la salida del 409.
      const retomado = await listar(cookieA);
      expect((await retomado.json()).import.draft).toMatchObject({
        version: 1,
      });
      await cancelar(cookieA, listo);
    });

    it("`queued` y `analyzing` también dan 409: hay trabajo pago en vuelo", async () => {
      for (const status of ["queued", "analyzing"] as const) {
        const id = await seedImport({
          businessId: a.businessId,
          userId: a.userId,
          status,
        });
        const respuesta = await crear(cookieA);
        expect(respuesta.status).toBe(409);
        expect((await respuesta.json()).code).toBe(
          "catalog_import_in_progress",
        );
        await cancelar(cookieA, id);
        // `analyzing` NO se cierra al cancelar: solo se marca la intencion (§1). Se cierra
        // a mano para que el caso siguiente no lo herede.
        await cerrarImport(id);
      }
    });

    it("un import AJENO devuelve el mismo 404 que uno inexistente", async () => {
      const deB = await seedImport({
        businessId: b.businessId,
        userId: b.userId,
        status: "ready",
        draft: BORRADOR,
      });
      const ajeno = await ver(cookieA, deB);
      expect(ajeno.status).toBe(404);
      expect((await ajeno.json()).code).toBe("catalog_import_not_found");
      const inexistente = await ver(
        cookieA,
        "99999999-9999-4999-8999-999999999999",
      );
      expect(inexistente.status).toBe(404);
      // El control positivo en el MISMO vector: B sí lo ve.
      expect((await ver(cookieB, deB)).status).toBe(200);
      await cancelar(cookieB, deB);
    });

    it("un integrante con `catalog` importa; sin el permiso, 403", async () => {
      const conPermiso = await seedIntegrante(c.businessId, ["catalog"]);
      const sinPermiso = await seedIntegrante(c.businessId, ["counter"]);
      extras.push(conPermiso, sinPermiso);
      const creado = await crear(await cookieDe(conPermiso));
      expect(creado.status).toBe(201);
      await cerrarImport((await creado.json()).import.id);

      const rechazado = await crear(await cookieDe(sinPermiso));
      expect(rechazado.status).toBe(403);
      expect((await rechazado.json()).code).toBe("missing_permission");
    });

    it("sin sesión es 401", async () => {
      const respuesta = await CREAR(
        new Request("http://localhost:3001/api/catalog/imports", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(archivos),
        }),
      );
      expect(respuesta.status).toBe(401);
      expect((await respuesta.json()).code).toBe("unauthorized");
    });
  },
);
