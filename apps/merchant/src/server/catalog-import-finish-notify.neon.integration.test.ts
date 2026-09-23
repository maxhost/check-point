import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  importIntegrationEnabled as enabled,
  leerImport,
  limpiarNegocio,
  seedImport,
  seedNegocio,
  type SeedImport,
} from "./catalog-import-integration-support";
import type { ProviderExtraction } from "./catalog-import/types";

vi.mock("./r2", async () => {
  const real = await vi.importActual<typeof import("./r2")>("./r2");
  return { ...real, deleteObjectKeys: async () => undefined };
});

/**
 * El writer FALLA. No es una fila inventada: que `writeImportedCatalog` pueda lanzar esta
 * probado contra Postgres en `catalog-import-write-races.neon.integration.test.ts` («un fallo
 * en el insert de productos revierte tambien las categorias»). Lo que se dobla es el momento
 * del fallo, no su posibilidad.
 */
vi.mock("./catalog-import/write", () => ({
  writeImportedCatalog: async () => {
    throw new Error("el writer no pudo escribir");
  },
}));

const { finishAnalysis, failImport } = await import("./catalog-import/finish");
const { consoleEmailOutbox } = await import("./email/console");

/**
 * Spec 0091 §7 — EL AVISO SALE **DESPUES** DEL RESULTADO FINAL.
 *
 * Esto pinnea el CABLEADO, no la regla. El `WHERE` de `notifyImportFinished` solo mira
 * `notified_at is null`: **no sabe en que estado esta el import**. Lo unico que sostiene el
 * invariante es DONDE esta la llamada dentro de `finishAnalysis` — despues de
 * `writeImportedCatalog`, nunca antes. Un `assert` sobre la regla no lo veria: la regla no
 * tiene nada que ver con el orden.
 *
 * Por eso el caso usa una escritura que FALLA, que es el unico discriminante. Con una
 * escritura exitosa los dos ordenes terminan igual (mail mandado, import `accepted`); con una
 * que falla, adelantar la llamada le manda al merchant «Tu menu ya esta en el catalogo» con el
 * catalogo VACIO, y encima se come el aviso real de fallo, porque la marca ya fue reclamada y
 * el segundo intento devuelve `already_notified`.
 *
 * Y por eso vive en Neon y no en una suite de unidad: la marca de una sola vez es una COLUMNA
 * reclamada con un `UPDATE … RETURNING`, y un doble de `./db` no la tiene.
 */
const extraccion: ProviderExtraction = {
  categories: [
    {
      sourceId: "c1",
      name: "Bebidas",
      products: [{ sourceId: "p1", name: "Cappuccino", priceText: "3,00" }],
    },
  ],
  discarded: [],
  warnings: [],
  usage: { inputTokens: 1, outputTokens: 2 },
  providerRequestId: "req_notify",
};

describe.skipIf(!enabled)("el aviso sale despues del resultado (§7)", () => {
  let a: SeedImport;

  beforeAll(async () => {
    a = await seedNegocio("Finish notify QA");
  });

  afterAll(async () => {
    await limpiarNegocio(a);
  });

  it("un writer que falla no manda el mail de importado, y el de fallo sale una sola vez", async () => {
    const id = await seedImport({
      businessId: a.businessId,
      userId: a.userId,
      status: "analyzing",
      providerJobId: `job-${Math.random().toString(36).slice(2, 10)}`,
      // Lease vivo: el reconciliador es GLOBAL y la rama de Neon es compartida.
      leaseUntil: new Date(Date.now() + 60 * 60 * 1000),
    });
    const previo = process.env.EMAIL_PROVIDER;
    process.env.EMAIL_PROVIDER = "console";
    consoleEmailOutbox.length = 0;
    try {
      await expect(finishAnalysis(id, extraccion, 10)).rejects.toThrow(
        "el writer no pudo escribir",
      );

      // El resultado final todavia NO existe: ni mail, ni marca reclamada.
      expect(consoleEmailOutbox).toHaveLength(0);
      expect((await leerImport(id))?.notifiedAt ?? null).toBeNull();

      // El resultado final llega aca, y recien aca sale el unico mail.
      await failImport(
        id,
        "provider_unavailable",
        "el writer no pudo escribir",
      );
      expect((await leerImport(id))?.status).toBe("failed");
      expect(consoleEmailOutbox).toHaveLength(1);
      expect(consoleEmailOutbox[0].subject).toBe("No pudimos leer tu menú");
    } finally {
      // El env compartido se deshace en `finally`, no en la ultima linea del cuerpo: un
      // assert que corta arriba lo dejaria puesto para todos los casos que siguen.
      if (previo === undefined) delete process.env.EMAIL_PROVIDER;
      else process.env.EMAIL_PROVIDER = previo;
      consoleEmailOutbox.length = 0;
    }
  });
});
