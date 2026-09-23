import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  importIntegrationEnabled as enabled,
  leerImport,
  limpiarNegocio,
  seedImport,
  seedImports,
  seedNegocio,
  type SeedImport,
} from "./catalog-import-integration-support";
import { conCookie, cookieDe } from "./permissions-integration-support";

vi.mock("./r2", async () => {
  const real = await vi.importActual<typeof import("./r2")>("./r2");
  return {
    ...real,
    createTemporaryUploadUrl: async (input: { objectKey: string }) =>
      `https://r2.fake/${input.objectKey}?firmada=1`,
    deleteObjectKeys: async () => undefined,
  };
});

const { POST: CREAR } = await import("../app/api/catalog/imports/route");
const { runAnalysis } = await import("./catalog-import/prepare");
const { limitOf } = await import("./entitlements");

/**
 * **Los dos topes salen del catalogo, no de un numero escrito acá.** Lo que estos casos miden
 * es la DECISION contra la base —que filas cuentan, y que al agotarse hay `429`—, no cuanto
 * valen: ese numero se transcribe a mano y se pinnea en `entitlements-window.test.ts`.
 * Escribirlos dos veces hacia que moverlos para las pruebas pusiera en rojo dos casos que no
 * hablan del valor.
 */
const TOPE_ANALISIS = limitOf({ plan: null }, "catalog.imports.analyses");
const TOPE_INTENTOS = limitOf({ plan: null }, "catalog.imports.attempts");

/**
 * Spec 0090 §8 / ADR 0082 §10 — **EL CUPO SE CUENTA CON FILAS, Y UN FALLO NO LO CONSUME.**
 *
 * ORACULO DE M8: si el conteo mirara cualquier import de la ventana en vez de los que
 * llegaron a tener borrador, el primer caso pasaria de 201 a 429 y este archivo se pone rojo.
 *
 * Cada caso usa su PROPIO negocio: el cupo es por negocio y compartir uno haria que el orden
 * de los tests decidiera el resultado.
 */
const archivos = {
  files: [{ name: "menu.jpg", contentType: "image/jpeg", byteSize: 100_000 }],
};

const BORRADOR = { version: 1, categories: [], warnings: [] };

describe.skipIf(!enabled)(
  "el cupo de análisis contra Neon (spec 0090 §8)",
  () => {
    let conFallo: SeedImport;
    let conAnalisis: SeedImport;
    let cookieFallo = "";
    let cookieAnalisis = "";
    /** Los negocios que crea un caso suelto, para que el teardown los borre por id. */
    const negocios: SeedImport[] = [];

    beforeAll(async () => {
      conFallo = await seedNegocio("Cupo QA fallo");
      conAnalisis = await seedNegocio("Cupo QA usado");
      cookieFallo = await cookieDe(conFallo.userId);
      cookieAnalisis = await cookieDe(conAnalisis.userId);
    });

    afterAll(async () => {
      await limpiarNegocio(conFallo);
      await limpiarNegocio(conAnalisis);
      for (const negocio of negocios) await limpiarNegocio(negocio);
    });

    const crear = (cookie: string) =>
      CREAR(conCookie("/api/catalog/imports", "POST", cookie, archivos));

    /** ORACULO DE M8. */
    it("un import `failed` de hoy NO consume el análisis del día", async () => {
      await seedImport({
        businessId: conFallo.businessId,
        userId: conFallo.userId,
        status: "failed",
        // Fue reclamado, pero el proveedor nunca acepto el submit: ADR 0083 exige que no
        // consuma ni el analisis ni el fusible operativo.
        attemptCount: 1,
      });
      const respuesta = await crear(cookieFallo);
      expect(respuesta.status).toBe(201);
    });

    it("un análisis que llegó a borrador SÍ lo consume, y el exceso es 429 con `Retry-After`", async () => {
      // El tope entero de analisis, ya gastado hoy: todos terminales, para no chocar con el
      // unico parcial por negocio. El siguiente POST es el que tiene que rebotar.
      await seedImports(TOPE_ANALISIS, {
        businessId: conAnalisis.businessId,
        userId: conAnalisis.userId,
        status: "accepted",
        draft: BORRADOR,
      });
      const respuesta = await crear(cookieAnalisis);
      expect(respuesta.status).toBe(429);
      const cuerpo = await respuesta.json();
      expect(cuerpo.code).toBe("catalog_import_rate_limited");
      expect(typeof cuerpo.retryAfterSeconds).toBe("number");
      expect(cuerpo.retryAfterSeconds).toBeGreaterThan(0);
      expect(respuesta.headers.get("retry-after")).toBe(
        String(cuerpo.retryAfterSeconds),
      );
    });

    /**
     * El techo de SUBMITS (§8), que es el que impide que el loop `cancelar → crear → analizar`
     * queme plata. Es la mitad de M10 que **solo** se puede medir contra la base: lo que decide
     * que filas cuentan es el predicado `provider is not null` del `WHERE`, y un doble de `./db`
     * no evalua predicados.
     */
    it("agotado el techo de intentos, el submit se cierra en `failed` sin llamar al proveedor", async () => {
      const negocio = await seedNegocio("Cupo QA intentos");
      negocios.push(negocio);
      // El tope entero de submits YA aceptados hoy (terminales, para no chocar con el único
      // parcial). El que sigue es el que tiene que cerrarse sin llamar al proveedor.
      await seedImports(TOPE_INTENTOS, {
        businessId: negocio.businessId,
        userId: negocio.userId,
        status: "failed",
        attemptCount: 1,
        provider: "openai",
      });
      const siguiente = await seedImport({
        businessId: negocio.businessId,
        userId: negocio.userId,
        status: "queued",
      });
      let submits = 0;
      const outcome = await runAnalysis(siguiente, {
        provider: {
          id: "doble",
          model: "doble-v1",
          start: async () => {
            submits += 1;
            return { kind: "deferred", jobId: `job-${siguiente}` };
          },
        },
      });
      expect(outcome).toBe("failed");
      expect(submits).toBe(0);
      const fila = await leerImport(siguiente);
      expect(fila?.status).toBe("failed");
      expect(fila?.failureCode).toBe("catalog_import_rate_limited");
    });

    it("un análisis de AYER no cuenta: la ventana es del día", async () => {
      const ayer = new Date(Date.now() - 36 * 60 * 60 * 1000);
      await seedImport({
        businessId: conFallo.businessId,
        userId: conFallo.userId,
        status: "cancelled",
        draft: BORRADOR,
        createdAt: ayer,
        expiresAt: new Date(ayer.getTime() + 24 * 60 * 60 * 1000),
      });
      // El negocio `conFallo` ya tiene un `pending_upload` abierto del primer caso: el POST se
      // lo apropia y crea otro, que es exactamente lo que se quiere medir acá.
      const respuesta = await crear(cookieFallo);
      expect(respuesta.status).toBe(201);
    });
  },
);
