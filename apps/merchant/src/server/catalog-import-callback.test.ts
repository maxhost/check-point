import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ProviderExtraction } from "./catalog-import/types";

/**
 * Spec 0090 §7 — **EL CUERPO DEL WEBHOOK NO SE CREE.**
 *
 * ORACULO DE M3: el payload que entra trae un borrador FALSO con un producto que no existe;
 * lo que la API del proveedor devuelve es otro. El test asevera que lo persistido es lo que
 * trajo `poll` y que **el producto del cuerpo no aparece por ningun lado**. Si el codigo
 * confiara en el cuerpo, este caso se pone rojo.
 *
 * Y el orden: con la firma invalida **no se toca la base** — se cuenta cero acceso a `getDb`.
 */
const estado = {
  filas: [] as unknown[][],
  sets: [] as Record<string, unknown>[],
  accesosAlaBase: 0,
};

vi.mock("./db", () => {
  const nuevaCadena = () => {
    const cadena: Record<string, unknown> = {};
    for (const metodo of [
      "select",
      "from",
      "where",
      "limit",
      "orderBy",
      "for",
      "insert",
      "values",
      "onConflictDoNothing",
      "delete",
      "update",
      "returning",
    ]) {
      cadena[metodo] = () => cadena;
    }
    cadena.set = (valor: Record<string, unknown>) => {
      estado.sets.push(valor);
      return cadena;
    };
    cadena.then = (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(estado.filas.shift() ?? []).then(resolve, reject);
    return cadena;
  };
  return {
    getDb: () => {
      estado.accesosAlaBase += 1;
      return nuevaCadena();
    },
    withDbTransaction: async () => {
      throw new Error("no debería abrir transacción");
    },
  };
});

const { handleProviderCallback } = await import("./catalog-import/callback");

const FILA = {
  id: "11111111-1111-4111-8111-111111111111",
  businessId: "22222222-2222-4222-8222-222222222222",
  createdByUserId: "u-1",
  status: "analyzing",
  sourceKind: "images",
  fileCount: 1,
  draft: null,
  draftVersion: 0,
  provider: "openai",
  model: "gpt-x",
  providerJobId: "resp_real",
  cancelRequestedAt: null,
  attemptCount: 1,
  createdAt: new Date("2026-09-22T10:00:00.000Z"),
};

/** Lo que la API del proveedor devuelve de verdad. */
const REAL: ProviderExtraction = {
  categories: [
    {
      sourceId: "c1",
      name: "Bebidas",
      products: [
        {
          sourceId: "p1",
          name: "Café de verdad",
          unitPrice: "2.50",
          priceStatus: "detected",
          sourceText: null,
        },
      ],
    },
  ],
  warnings: [],
  usage: { inputTokens: 1, outputTokens: 2 },
  providerRequestId: "req_1",
};

/** Un cuerpo de webhook con un borrador **falso** adentro. Ninguno de sus campos —salvo el
 * id— puede llegar a la base. */
const CUERPO_MALICIOSO = JSON.stringify({
  id: "evt_1",
  data: {
    id: "resp_real",
    draft: {
      categories: [
        {
          sourceId: "cX",
          name: "Categoría inyectada",
          products: [
            {
              sourceId: "pX",
              name: "PRODUCTO FALSO",
              unitPrice: "0.01",
              priceStatus: "detected",
              sourceText: null,
            },
          ],
        },
      ],
    },
  },
});

const proveedor = (opts: { firmaValida: boolean }) => ({
  id: "openai",
  model: "gpt-x",
  start: async () => {
    throw new Error("no se usa");
  },
  poll: async () => ({ status: "done" as const, extraction: REAL }),
  verifyCallback: () => (opts.firmaValida ? { jobId: "resp_real" } : null),
});

beforeEach(() => {
  estado.filas = [];
  estado.sets = [];
  estado.accesosAlaBase = 0;
});

describe("callback del proveedor (spec 0090 §7)", () => {
  it("con firma inválida contesta 401 y NO toca la base", async () => {
    const outcome = await handleProviderCallback(
      new Headers(),
      CUERPO_MALICIOSO,
      { provider: proveedor({ firmaValida: false }) },
    );
    expect(outcome).toEqual({ status: 401 });
    expect(estado.accesosAlaBase).toBe(0);
  });

  it("un job id DESCONOCIDO contesta 200 e ignora: no filtra existencia", async () => {
    estado.filas = [[]];
    const outcome = await handleProviderCallback(new Headers(), "{}", {
      provider: proveedor({ firmaValida: true }),
    });
    expect(outcome).toEqual({ status: 200, result: "ignored" });
    // Y no escribió nada.
    expect(estado.sets).toHaveLength(0);
  });

  /** ORACULO DE M3. */
  it("persiste lo que devolvió la API, NO el borrador que venía en el cuerpo", async () => {
    // 1) callback busca la fila; 2) finishAnalysis la vuelve a leer; 3) snapshot x2;
    // 4) el UPDATE que persiste; 5) la reclamación del email.
    estado.filas = [[FILA], [FILA], [], [], [{ id: FILA.id }], []];
    const outcome = await handleProviderCallback(
      new Headers(),
      CUERPO_MALICIOSO,
      { provider: proveedor({ firmaValida: true }) },
    );
    expect(outcome).toEqual({ status: 200, result: "ready" });
    const persistido = estado.sets.find((set) => "draft" in set);
    expect(persistido).toBeDefined();
    expect(JSON.stringify(persistido)).toContain("Café de verdad");
    expect(JSON.stringify(estado.sets)).not.toContain("PRODUCTO FALSO");
    expect(JSON.stringify(estado.sets)).not.toContain("Categoría inyectada");
    expect(persistido).toMatchObject({ status: "ready", draftVersion: 1 });
  });

  it("un import que ya salió de análisis es no-op idempotente", async () => {
    estado.filas = [[{ ...FILA, status: "accepted" }]];
    const outcome = await handleProviderCallback(
      new Headers(),
      CUERPO_MALICIOSO,
      { provider: proveedor({ firmaValida: true }) },
    );
    expect(outcome).toEqual({ status: 200, result: "noop" });
    expect(estado.sets).toHaveLength(0);
  });

  it("si el proveedor dice `pending`, no se escribe nada", async () => {
    estado.filas = [[FILA]];
    const outcome = await handleProviderCallback(new Headers(), "{}", {
      provider: {
        ...proveedor({ firmaValida: true }),
        poll: async () => ({ status: "pending" as const }),
      },
    });
    expect(outcome).toEqual({ status: 200, result: "pending" });
    expect(estado.sets).toHaveLength(0);
  });

  it("con `cancel_requested_at` el resultado se DESCARTA y cierra en cancelled", async () => {
    estado.filas = [
      [{ ...FILA, cancelRequestedAt: new Date() }],
      [{ ...FILA, cancelRequestedAt: new Date() }],
    ];
    const outcome = await handleProviderCallback(new Headers(), "{}", {
      provider: proveedor({ firmaValida: true }),
    });
    expect(outcome).toEqual({ status: 200, result: "noop" });
    expect(estado.sets.some((set) => set.status === "cancelled")).toBe(true);
    expect(estado.sets.some((set) => "draft" in set)).toBe(false);
  });
});
