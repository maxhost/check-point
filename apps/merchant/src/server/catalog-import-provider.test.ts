import { describe, expect, it } from "vitest";
import {
  catalogExtractionProviderFromEnv,
  ProviderUnavailableError,
} from "./catalog-import/providers/provider";
import { FakeCatalogExtractionProvider } from "./catalog-import/providers/fake";
import {
  extractionFrom,
  OpenAiCatalogExtractionProvider,
  OpenAiRequestError,
} from "./catalog-import/providers/openai";
import { CATALOG_EXTRACTION_PROMPT } from "./catalog-import/providers/openai-schema";
import type {
  CatalogExtractionInput,
  CatalogExtractionProvider,
} from "./catalog-import/types";

/** Un entorno parcial: `catalogExtractionProviderFromEnv` lee tres claves y `ProcessEnv`
 * exige `NODE_ENV`, que no tiene nada que ver con esta decision. */
const env = (valores: Record<string, string>) =>
  valores as unknown as NodeJS.ProcessEnv;

/**
 * Spec 0090 §4 — EL CONTRATO DEL PROVEEDOR: `fake` determinista, adaptador `openai`
 * configurable, forma diferida, y **sin fallback silencioso**.
 *
 * El `poll` se prueba con un `fetch` doblado: es la unica forma de cubrir el camino del
 * webhook real sin recibirlo (declarado como limite en la spec).
 */
const entrada = (bytes = "menu"): CatalogExtractionInput => ({
  importId: "i-1",
  sourceKind: "images",
  pages: [
    { bytes: Buffer.from(bytes), contentType: "image/jpeg", position: 0 },
  ],
});

const entradaPdf = (): CatalogExtractionInput => ({
  importId: "i-pdf",
  sourceKind: "pdf",
  pages: [
    {
      bytes: Buffer.from("%PDF-1.4 menu"),
      contentType: "application/pdf",
      position: 0,
    },
  ],
});

describe("adaptador `fake` (spec 0090 §4)", () => {
  it("contesta `completed` y es determinista por contenido", async () => {
    const provider = new FakeCatalogExtractionProvider();
    const a = await provider.start(entrada());
    const b = await provider.start(entrada());
    expect(a.kind).toBe("completed");
    expect(a).toEqual(b);
  });

  it("produce los dos estados de precio, y el ambiguo con `null`", async () => {
    const result = await new FakeCatalogExtractionProvider().start(entrada());
    if (result.kind !== "completed") throw new Error("esperaba completed");
    const productos = result.extraction.categories.flatMap((c) => c.products);
    expect(productos.find((p) => p.priceStatus === "detected")?.unitPrice).toBe(
      "3.25",
    );
    expect(
      productos.find((p) => p.priceStatus === "ambiguous")?.unitPrice,
    ).toBeNull();
  });

  it("implementa SOLO `start`: la forma diferida es opcional", () => {
    const provider: CatalogExtractionProvider =
      new FakeCatalogExtractionProvider();
    expect(provider.poll).toBeUndefined();
    expect(provider.verifyCallback).toBeUndefined();
  });
});

describe("resolución del proveedor por configuración (spec 0090 §4)", () => {
  it("`fake` es el default y no necesita nada", () => {
    expect(catalogExtractionProviderFromEnv(env({})).id).toBe("fake");
  });

  /** **NO HAY FALLBACK SILENCIOSO**: caer al `fake` en producción le daría al merchant un
   * menú inventado con cara de análisis real. */
  it("`openai` SIN clave tira, no cae al fake", () => {
    expect(() =>
      catalogExtractionProviderFromEnv(
        env({ CATALOG_EXTRACTION_PROVIDER: "openai" }),
      ),
    ).toThrow(ProviderUnavailableError);
  });

  it("un proveedor desconocido tira, no cae al fake", () => {
    expect(() =>
      catalogExtractionProviderFromEnv(
        env({ CATALOG_EXTRACTION_PROVIDER: "kimi" }),
      ),
    ).toThrow(ProviderUnavailableError);
  });

  it("con clave, `openai` se construye con el modelo de la env", () => {
    const provider = catalogExtractionProviderFromEnv(
      env({
        CATALOG_EXTRACTION_PROVIDER: "openai",
        OPENAI_API_KEY: "sk-test",
        CATALOG_EXTRACTION_MODEL: "gpt-x",
      }),
    );
    expect({ id: provider.id, model: provider.model }).toEqual({
      id: "openai",
      model: "gpt-x",
    });
  });
});

/** Un `fetch` doblado: devuelve lo que se le ponga y registra lo que se le mandó. */
function fetchDoble(
  respuestas: Array<{
    ok: boolean;
    body: unknown;
    status?: number;
    headers?: Record<string, string>;
  }>,
) {
  const llamadas: Array<{ url: string; body: unknown }> = [];
  let i = 0;
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    llamadas.push({
      url: String(url),
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    const respuesta = respuestas[Math.min(i++, respuestas.length - 1)];
    return {
      ok: respuesta.ok,
      status: respuesta.status ?? (respuesta.ok ? 200 : 500),
      headers: new Headers(respuesta.headers),
      url: "https://api.openai.com/v1/responses",
      redirected: false,
      json: async () => respuesta.body,
    } as Response;
  }) as typeof fetch;
  return { llamadas, restore: () => void (globalThis.fetch = original) };
}

const RESPUESTA_OK = {
  id: "resp_1",
  status: "completed",
  output_text: JSON.stringify({
    categories: [
      {
        sourceId: "c1",
        name: "Bebidas",
        products: [
          {
            sourceId: "p1",
            name: "Café",
            unitPrice: "2.5",
            priceStatus: "detected",
            sourceText: "Café 2,5",
          },
        ],
      },
    ],
    warnings: [],
  }),
  usage: { input_tokens: 10, output_tokens: 20 },
};

describe("adaptador `openai` (spec 0090 §4)", () => {
  it("`start` submitea con `background: true` y devuelve un jobId diferido", async () => {
    const doble = fetchDoble([{ ok: true, body: { id: "resp_1" } }]);
    try {
      const provider = new OpenAiCatalogExtractionProvider(
        "gpt-x",
        "sk",
        "whsec_x",
      );
      const result = await provider.start(entrada());
      expect(result).toEqual({ kind: "deferred", jobId: "resp_1" });
      const enviado = doble.llamadas[0].body as Record<string, unknown>;
      expect(enviado.background).toBe(true);
      // **Sin tools**: el documento del merchant no puede alcanzar ninguna capacidad.
      expect(enviado.tools).toEqual([]);
      expect(JSON.stringify(enviado.input)).toContain(
        CATALOG_EXTRACTION_PROMPT.slice(0, 40),
      );
    } finally {
      doble.restore();
    }
  });

  it("envía un PDF como `input_file`, nunca como `input_image`", async () => {
    const doble = fetchDoble([{ ok: true, body: { id: "resp_pdf" } }]);
    try {
      const provider = new OpenAiCatalogExtractionProvider(
        "gpt-x",
        "sk",
        "whsec_x",
      );
      await provider.start(entradaPdf());
      const enviado = doble.llamadas[0].body as {
        input: Array<{ content: Array<Record<string, unknown>> }>;
      };
      const archivo = enviado.input[0].content[1];
      expect(archivo).toMatchObject({
        type: "input_file",
        filename: "menu-1.pdf",
        detail: "high",
      });
      expect(archivo.file_data).toMatch(/^data:application\/pdf;base64,/);
      expect(archivo).not.toHaveProperty("image_url");
    } finally {
      doble.restore();
    }
  });

  it("`poll` distingue pending / done / failed", async () => {
    const provider = new OpenAiCatalogExtractionProvider(
      "gpt-x",
      "sk",
      "whsec_x",
    );
    for (const [estado, esperado] of [
      ["queued", "pending"],
      ["in_progress", "pending"],
      ["incomplete", "failed"],
    ] as const) {
      const doble = fetchDoble([
        { ok: true, body: { id: "resp_1", status: estado } },
      ]);
      try {
        expect((await provider.poll("resp_1")).status).toBe(esperado);
      } finally {
        doble.restore();
      }
    }
    const doble = fetchDoble([{ ok: true, body: RESPUESTA_OK }]);
    try {
      const result = await provider.poll("resp_1");
      if (result.status !== "done") throw new Error("esperaba done");
      expect(result.extraction.categories[0].products[0].unitPrice).toBe(
        "2.50",
      );
      expect(result.extraction.usage).toEqual({
        inputTokens: 10,
        outputTokens: 20,
      });
    } finally {
      doble.restore();
    }
  });

  it("un HTTP de error NO propaga el cuerpo del proveedor", async () => {
    const doble = fetchDoble([
      { ok: false, body: { error: { message: CATALOG_EXTRACTION_PROMPT } } },
    ]);
    try {
      const provider = new OpenAiCatalogExtractionProvider(
        "gpt-x",
        "sk",
        "whsec_x",
      );
      await expect(provider.start(entrada())).rejects.toThrow(
        "openai_http_500",
      );
    } finally {
      doble.restore();
    }
  });

  it("conserva el código seguro de OpenAI y descarta su mensaje", async () => {
    const secreto = `${CATALOG_EXTRACTION_PROMPT} sk-secreto`;
    const doble = fetchDoble([
      {
        ok: false,
        status: 401,
        headers: { "x-request-id": "req_diagnostico" },
        body: {
          error: {
            type: "invalid_request_error",
            code: "ip_not_authorized",
            param: "authorization",
            message: secreto,
          },
        },
      },
    ]);
    try {
      const provider = new OpenAiCatalogExtractionProvider(
        "gpt-x",
        "sk-prueba",
        "whsec_x",
      );
      const error = await provider.start(entrada()).catch((reason) => reason);
      expect(error).toBeInstanceOf(OpenAiRequestError);
      expect(error.diagnostics).toMatchObject({
        kind: "http_error",
        operation: "create",
        keyLength: 9,
        keyHasOuterWhitespace: false,
        status: 401,
        errorType: "invalid_request_error",
        errorCode: "ip_not_authorized",
        errorParam: "authorization",
        requestId: "req_diagnostico",
        hostname: "api.openai.com",
        redirected: false,
      });
      expect(JSON.stringify(error.diagnostics)).not.toContain(secreto);
      expect(JSON.stringify(error.diagnostics)).not.toContain("sk-prueba");
    } finally {
      doble.restore();
    }
  });

  it("una salida que no cumple el esquema propio se rechaza, aunque el HTTP sea 200", () => {
    expect(() =>
      extractionFrom({
        id: "resp_1",
        output_text: JSON.stringify({ categories: [{ sourceId: "c1" }] }),
      }),
    ).toThrow();
    expect(() =>
      extractionFrom({ id: "resp_1", output_text: "no soy json" }),
    ).toThrow("openai_output_not_json");
    expect(() => extractionFrom({ id: "resp_1" })).toThrow(
      "openai_no_output_text",
    );
  });
});
