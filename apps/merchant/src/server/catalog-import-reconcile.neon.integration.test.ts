import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  cerrarImport,
  importIntegrationEnabled as enabled,
  leerImport,
  limpiarNegocio,
  seedImport,
  seedNegocio,
  type SeedImport,
} from "./catalog-import-integration-support";
import type {
  CatalogExtractionProvider,
  ProviderExtraction,
} from "./catalog-import/types";

vi.mock("./r2", async () => {
  const real = await vi.importActual<typeof import("./r2")>("./r2");
  return { ...real, deleteObjectKeys: async () => undefined };
});

const { runCatalogImportReconcile } =
  await import("./catalog-import/reconcile");

/**
 * Spec 0090 §7 — EL RECONCILIADOR CONTRA LA BASE.
 *
 * ORACULO DE M4 (borrar `lease_until` del reclamo): **dos reconciliadores concurrentes
 * reclaman la misma fila UNA sola vez**, y una fila con el lease vivo no se vuelve a tocar.
 * Sin el lease, el primer caso ve dos `poll` y el segundo ve uno que no deberia existir.
 */
const EXTRACCION: ProviderExtraction = {
  categories: [
    {
      sourceId: "c1",
      name: "Rescatada",
      products: [
        {
          sourceId: "p1",
          name: "Café rescatado",
          unitPrice: "1.00",
          priceStatus: "detected",
          sourceText: null,
        },
      ],
    },
  ],
  warnings: [],
  usage: { inputTokens: 1, outputTokens: 1 },
  providerRequestId: "req_rec",
};

function proveedorQueCuenta(
  respuesta: "done" | "pending" | "failed" = "done",
): { provider: CatalogExtractionProvider; polls: string[] } {
  const polls: string[] = [];
  return {
    polls,
    provider: {
      id: "fake-diferido",
      model: "fake-v1",
      start: async () => ({ kind: "deferred" as const, jobId: "job-x" }),
      poll: async (jobId: string) => {
        polls.push(jobId);
        if (respuesta === "pending") return { status: "pending" as const };
        if (respuesta === "failed") {
          return { status: "failed" as const, code: "provider_incomplete" };
        }
        return { status: "done" as const, extraction: EXTRACCION };
      },
    },
  };
}

describe.skipIf(!enabled)("reconciliador contra Neon (spec 0090 §7)", () => {
  let a: SeedImport;

  beforeAll(async () => {
    a = await seedNegocio("Reconcile QA");
  });

  afterAll(async () => {
    await limpiarNegocio(a);
  });

  const analizando = (overrides: Record<string, unknown> = {}) =>
    seedImport({
      businessId: a.businessId,
      userId: a.userId,
      status: "analyzing",
      providerJobId: `job-${Math.random().toString(36).slice(2, 10)}`,
      leaseUntil: new Date(Date.now() - 60_000),
      attemptCount: 1,
      ...overrides,
    });

  /** ORACULO DE M4. */
  it("dos reconciliadores concurrentes reclaman la fila UNA sola vez", async () => {
    const id = await analizando();
    const uno = proveedorQueCuenta("pending");
    const dos = proveedorQueCuenta("pending");
    const [,] = await Promise.all([
      runCatalogImportReconcile({ provider: uno.provider }),
      runCatalogImportReconcile({ provider: dos.provider }),
    ]);
    expect(uno.polls.length + dos.polls.length).toBe(1);
    const fila = await leerImport(id);
    // Y el lease quedó renovado hacia el futuro: `pending` no es un error.
    expect(fila?.status).toBe("analyzing");
    expect(fila?.leaseUntil?.getTime() ?? 0).toBeGreaterThan(Date.now());
    await cerrarImport(id);
  });

  it("una fila con el lease VIVO no se reclama", async () => {
    const id = await analizando({
      leaseUntil: new Date(Date.now() + 10 * 60_000),
    });
    const { provider, polls } = proveedorQueCuenta("pending");
    await runCatalogImportReconcile({ provider });
    expect(polls).toHaveLength(0);
    await cerrarImport(id);
  });

  it("un lease VENCIDO se re-reclama y el `done` deja el borrador listo", async () => {
    const id = await analizando();
    const { provider, polls } = proveedorQueCuenta("done");
    const resumen = await runCatalogImportReconcile({ provider });
    expect(polls).toHaveLength(1);
    expect(resumen.completed).toBe(1);
    const fila = await leerImport(id);
    expect(fila?.status).toBe("ready");
    expect(fila?.draft).toMatchObject({ version: 1 });
    expect(fila?.leaseUntil).toBeNull();
    await cerrarImport(id);
  });

  it("un `failed` del proveedor cierra el import con código saneado", async () => {
    const id = await analizando();
    const { provider } = proveedorQueCuenta("failed");
    await runCatalogImportReconcile({ provider });
    const fila = await leerImport(id);
    expect(fila?.status).toBe("failed");
    expect(fila?.failureCode).toBe("provider_unavailable");
    expect(fila?.failureDetail).toBe("provider_incomplete");
  });

  it("agotados los intentos, se cierra en `failed` — `analyzing` NO es un pozo", async () => {
    const id = await analizando({ attemptCount: 9 });
    const { provider, polls } = proveedorQueCuenta("pending");
    await runCatalogImportReconcile({ provider });
    expect(polls).toHaveLength(0);
    expect((await leerImport(id))?.status).toBe("failed");
  });

  it("con `cancel_requested_at` cierra en `cancelled` y descarta el resultado", async () => {
    const id = await analizando();
    const { getDb } = await import("./db");
    const { catalogImports } = await import("./schema");
    const { eq } = await import("drizzle-orm");
    await getDb()
      .update(catalogImports)
      .set({ cancelRequestedAt: new Date() })
      .where(eq(catalogImports.id, id));
    const { provider, polls } = proveedorQueCuenta("done");
    await runCatalogImportReconcile({ provider });
    expect(polls).toHaveLength(0);
    const fila = await leerImport(id);
    expect(fila?.status).toBe("cancelled");
    expect(fila?.draft).toBeNull();
  });
});
