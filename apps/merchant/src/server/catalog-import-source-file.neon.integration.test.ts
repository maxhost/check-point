import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  cerrarImport,
  importIntegrationEnabled as enabled,
  limpiarNegocio,
  seedNegocio,
  type SeedImport,
} from "./catalog-import-integration-support";
import { conCookie, cookieDe } from "./permissions-integration-support";
import { getDb } from "@mi-pasaporte/db";
import { catalogImportFiles, catalogImports } from "@mi-pasaporte/db/schema";
import { and, eq } from "drizzle-orm";

/** R2 fake, igual que `catalog-import.neon.integration.test.ts`: lo que se mide son filas. */
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

const { POST: CREAR, GET: LISTAR } =
  await import("../app/api/catalog/imports/route");
const { GET: VER, DELETE: CANCELAR } =
  await import("../app/api/catalog/imports/[id]/route");
const { POST: ANALIZAR } =
  await import("../app/api/catalog/imports/[id]/analyze/route");

/**
 * Spec 0147 — `sourceFileName` POR LAS RUTAS REALES, contra Postgres.
 *
 * ORACULO DE M1 (lector sin `business_id` / con otro `import_id`) y M3 (la GET de la lista
 * pasa `null`): dos negocios con un PDF cada uno, **los dos archivos en `position = 0`**, y la
 * lista de cada uno tiene que traer SU nombre. `requireImport` corta lo ajeno en la ruta de
 * detalle, por eso el aislamiento del lector se mide sobre la LISTA.
 */
type Sembrado = { importId: string; fileId: string; objectKey: string };

let reloj = Date.now();
/** `createdAt` estrictamente creciente: la lista devuelve el ULTIMO import del negocio. */
const siguiente = () => new Date((reloj += 1_000));

async function sembrarConArchivo(
  seed: SeedImport,
  opts: {
    sourceKind: "pdf" | "images";
    status: string;
    name?: string | null;
    fileStatus?: string;
  },
): Promise<Sembrado> {
  const importId = randomUUID();
  const fileId = randomUUID();
  const objectKey = `catalog-imports/${seed.businessId}/${importId}/${fileId}-secreta`;
  await getDb()
    .insert(catalogImports)
    .values({
      id: importId,
      businessId: seed.businessId,
      createdByUserId: seed.userId,
      status: opts.status,
      sourceKind: opts.sourceKind,
      fileCount: 1,
      createdAt: siguiente(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  if (opts.name !== null) {
    await getDb()
      .insert(catalogImportFiles)
      .values({
        id: fileId,
        importId,
        businessId: seed.businessId,
        position: 0,
        originalName: opts.name ?? "sin-nombre",
        declaredContentType:
          opts.sourceKind === "pdf" ? "application/x-sembrado" : "image/x-s",
        byteSize: 4_242_421,
        objectKey,
        status: opts.fileStatus ?? "validated",
      });
  }
  return { importId, fileId, objectKey };
}

/** Ningun campo de `catalog_import_file` —salvo el nombre— cruza en el cuerpo. */
function sinCamposDelArchivo(cuerpo: string, s: Sembrado): void {
  for (const interno of [
    s.objectKey,
    s.fileId,
    "4242421",
    "application/x-sembrado",
    "image/x-s",
    "validated",
    "catalog-imports/",
  ]) {
    expect(cuerpo).not.toContain(interno);
  }
}

describe.skipIf(!enabled)("`sourceFileName` contra Neon (spec 0147)", () => {
  let a: SeedImport;
  let b: SeedImport;
  let cookieA = "";
  let cookieB = "";

  beforeAll(async () => {
    a = await seedNegocio("Nombre PDF A");
    b = await seedNegocio("Nombre PDF B");
    cookieA = await cookieDe(a.userId);
    cookieB = await cookieDe(b.userId);
  }, 60_000);

  afterAll(async () => {
    for (const seed of [a, b]) if (seed) await limpiarNegocio(seed);
  }, 60_000);

  const listar = async (cookie: string) => {
    const r = await LISTAR(conCookie("/api/catalog/imports", "GET", cookie));
    expect(r.status).toBe(200);
    return r.text();
  };
  const ver = (cookie: string, id: string) =>
    VER(conCookie(`/api/catalog/imports/${id}`, "GET", cookie), {
      params: Promise.resolve({ id }),
    });

  it("cada negocio recibe SU nombre en la lista y en el detalle; lo ajeno es 404", async () => {
    const deA = await sembrarConArchivo(a, {
      sourceKind: "pdf",
      status: "failed",
      name: "Carta de A.pdf",
    });
    const deB = await sembrarConArchivo(b, {
      sourceKind: "pdf",
      status: "failed",
      name: "Carta de B.pdf",
    });

    const listaA = await listar(cookieA);
    expect(JSON.parse(listaA).import).toMatchObject({
      id: deA.importId,
      sourceKind: "pdf",
      sourceFileName: "Carta de A.pdf",
    });
    expect(listaA).not.toContain("Carta de B.pdf");
    sinCamposDelArchivo(listaA, deA);

    const listaB = await listar(cookieB);
    expect(JSON.parse(listaB).import.sourceFileName).toBe("Carta de B.pdf");
    expect(listaB).not.toContain("Carta de A.pdf");

    const detalle = await ver(cookieA, deA.importId);
    expect(detalle.status).toBe(200);
    const textoDetalle = await detalle.text();
    expect(JSON.parse(textoDetalle).import.sourceFileName).toBe(
      "Carta de A.pdf",
    );
    sinCamposDelArchivo(textoDetalle, deA);

    const ajeno = await ver(cookieA, deB.importId);
    expect(ajeno.status).toBe(404);
    expect(await ajeno.text()).not.toContain("Carta de B.pdf");
  }, 60_000);

  it("un import de imágenes devuelve `null` aunque su archivo tenga nombre", async () => {
    const fotos = await sembrarConArchivo(a, {
      sourceKind: "images",
      status: "failed",
      name: "foto-del-menu.jpg",
    });
    const lista = await listar(cookieA);
    expect(JSON.parse(lista).import).toMatchObject({
      id: fotos.importId,
      sourceKind: "images",
      sourceFileName: null,
    });
    expect(lista).not.toContain("foto-del-menu.jpg");
    sinCamposDelArchivo(lista, fotos);

    const detalle = await (await ver(cookieA, fotos.importId)).json();
    expect(detalle.import.sourceFileName).toBeNull();
  }, 60_000);

  it("el nombre sobrevive a la limpieza (`deleted`) y un PDF sin archivo da `null`", async () => {
    const limpio = await sembrarConArchivo(a, {
      sourceKind: "pdf",
      status: "expired",
      name: "Vencido.pdf",
      fileStatus: "deleted",
    });
    expect(JSON.parse(await listar(cookieA)).import).toMatchObject({
      id: limpio.importId,
      sourceFileName: "Vencido.pdf",
    });

    const huerfano = await sembrarConArchivo(a, {
      sourceKind: "pdf",
      status: "failed",
      name: null,
    });
    expect(JSON.parse(await listar(cookieA)).import).toMatchObject({
      id: huerfano.importId,
      sourceFileName: null,
    });
  }, 60_000);

  it("POST devuelve el nombre ya saneado — el mismo `original_name` escrito", async () => {
    const creado = await CREAR(
      conCookie("/api/catalog/imports", "POST", cookieA, {
        files: [
          {
            name: "Menú\u0007 otoño.pdf",
            contentType: "application/pdf",
            byteSize: 100_000,
          },
        ],
      }),
    );
    expect(creado.status).toBe(201);
    const cuerpo = await creado.json();
    const [fila] = await getDb()
      .select({ originalName: catalogImportFiles.originalName })
      .from(catalogImportFiles)
      .where(
        and(
          eq(catalogImportFiles.importId, cuerpo.import.id),
          eq(catalogImportFiles.position, 0),
        ),
      );
    expect(fila.originalName).not.toContain("\u0007");
    expect(cuerpo.import.sourceFileName).toBe(fila.originalName);
    expect(cuerpo.import.sourceFileName).toContain("otoño.pdf");
    await cerrarImport(cuerpo.import.id);

    // `createImport` le pasa el nombre en mano tambien para imagenes: la regla «imagenes →
    // null» la aplica el DTO, y este es su oraculo por la ruta.
    const fotos = await CREAR(
      conCookie("/api/catalog/imports", "POST", cookieA, {
        files: [
          { name: "foto-post.jpg", contentType: "image/jpeg", byteSize: 1_000 },
        ],
      }),
    );
    expect(fotos.status).toBe(201);
    const textoFotos = await fotos.text();
    expect(JSON.parse(textoFotos).import.sourceFileName).toBeNull();
    expect(textoFotos).not.toContain("foto-post.jpg");
    await cerrarImport(JSON.parse(textoFotos).import.id);
  }, 60_000);

  it("`analyze` (idempotente) y `DELETE` devuelven el mismo campo", async () => {
    const enCola = await sembrarConArchivo(a, {
      sourceKind: "pdf",
      status: "queued",
      name: "En cola.pdf",
    });
    const analizado = await ANALIZAR(
      conCookie(
        `/api/catalog/imports/${enCola.importId}/analyze`,
        "POST",
        cookieA,
      ),
      { params: Promise.resolve({ id: enCola.importId }) },
    );
    expect(analizado.status).toBe(202);
    const textoAnalisis = await analizado.text();
    expect(JSON.parse(textoAnalisis).import.sourceFileName).toBe("En cola.pdf");
    sinCamposDelArchivo(textoAnalisis, enCola);

    const cancelado = await CANCELAR(
      conCookie(`/api/catalog/imports/${enCola.importId}`, "DELETE", cookieA),
      { params: Promise.resolve({ id: enCola.importId }) },
    );
    expect(cancelado.status).toBe(200);
    expect((await cancelado.json()).import).toMatchObject({
      status: "cancelled",
      sourceFileName: "En cola.pdf",
    });
  }, 60_000);
});
