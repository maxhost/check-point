import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PDF,
  PROMPT,
  SALIDA,
  JPEG,
  fetchDoble,
  pedido,
  proveedor,
} from "./openai-test-support";

/**
 * Spec 0224 §4 — EL UNICO CLIENTE DE OPENAI, con `fetch` doblado. Absorbe los casos del adaptador del
 * menu (`catalog-import-provider.test.ts`) y del dictado/foto (`stock/draft-photo-provider.test.ts`),
 * con tareas NEUTRAS (`demo.alpha`): el core no nombra tareas de modulo.
 */
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("cuerpo del pedido (spec 0224 §4)", () => {
  it("`run`: store false, sin tools, system + input_text + input_image JPEG detail high, con timeout", async () => {
    const llamadas = fetchDoble([{ ok: true, body: SALIDA }]);
    const raw = await proveedor().run(
      pedido(
        {
          context: "CTX:",
          text: "dos kilos",
          images: [{ kind: "image", jpeg: JPEG }],
        },
        "low",
      ),
    );
    const body = llamadas[0].body as Record<string, unknown>;
    expect(llamadas[0].url).toBe("https://api.openai.com/v1/responses");
    expect(body.store).toBe(false);
    expect(body).not.toHaveProperty("background");
    expect(body.tools).toEqual([]);
    expect(body.model).toBe("modelo-x");
    expect(body.reasoning).toEqual({ effort: "low" });
    expect(body.text).toEqual({
      format: {
        type: "json_schema",
        name: "demo_schema",
        strict: true,
        schema: { type: "object" },
      },
    });
    expect(body.input).toEqual([
      { role: "system", content: PROMPT },
      {
        role: "user",
        content: [
          { type: "input_text", text: "CTX:\ndos kilos" },
          {
            type: "input_image",
            image_url: `data:image/jpeg;base64,${JPEG.toString("base64")}`,
            detail: "high",
          },
        ],
      },
    ]);
    expect(llamadas[0].signal).toBeInstanceOf(AbortSignal);
    expect(raw).toEqual({
      parsed: { items: [1, 2] },
      usage: { inputTokens: 10, outputTokens: 20 },
      providerRequestId: "resp_1",
    });
  });

  it("sin reasoning no manda `reasoning`; sin texto no manda `input_text` vacio", async () => {
    const llamadas = fetchDoble([{ ok: true, body: SALIDA }]);
    await proveedor().run(pedido({ images: [{ kind: "image", jpeg: JPEG }] }));
    const body = llamadas[0].body as {
      reasoning?: unknown;
      input: { content: { type: string }[] }[];
    };
    expect(body.reasoning).toBeUndefined();
    expect(body.input[1].content.map((p) => p.type)).toEqual(["input_image"]);
  });

  it("`start`: background true + store true, PDF como `input_file` (nunca `input_image`) y jobId diferido", async () => {
    const llamadas = fetchDoble([{ ok: true, body: { id: "resp_bg" } }]);
    const result = await proveedor().start(
      pedido({ files: [{ kind: "pdf", bytes: PDF, filename: "menu-1.pdf" }] }),
    );
    expect(result).toEqual({ kind: "deferred", jobId: "resp_bg" });
    const body = llamadas[0].body as {
      background: unknown;
      store: unknown;
      input: { content: Record<string, unknown>[] }[];
    };
    expect([body.background, body.store]).toEqual([true, true]);
    const archivo = body.input[1].content[0];
    expect(archivo).toMatchObject({
      type: "input_file",
      filename: "menu-1.pdf",
      detail: "high",
    });
    expect(archivo.file_data).toBe(
      `data:application/pdf;base64,${PDF.toString("base64")}`,
    );
    expect(archivo).not.toHaveProperty("image_url");
  });

  it("`start` sin id del proveedor → provider_error", async () => {
    fetchDoble([{ ok: true, body: {} }]);
    await expect(proveedor().start(pedido({}))).rejects.toMatchObject({
      reason: "provider_error",
    });
  });
});

describe("retrieve y lector de la salida (spec 0224 §4)", () => {
  it("queued / in_progress → pending; incomplete → failed; completed → done", async () => {
    for (const [estado, esperado] of [
      ["queued", { status: "pending" }],
      ["in_progress", { status: "pending" }],
      ["incomplete", { status: "failed", code: "provider_incomplete" }],
      ["", { status: "failed", code: "provider_unknown" }],
    ] as const) {
      const llamadas = fetchDoble([
        { ok: true, body: { id: "resp_1", status: estado } },
      ]);
      expect(await proveedor().retrieve("resp_1")).toEqual(esperado);
      expect(llamadas[0].url).toBe(
        "https://api.openai.com/v1/responses/resp_1",
      );
      vi.unstubAllGlobals();
    }
    fetchDoble([{ ok: true, body: SALIDA }]);
    expect(await proveedor().retrieve("resp_1")).toEqual({
      status: "done",
      raw: {
        parsed: { items: [1, 2] },
        usage: { inputTokens: 10, outputTokens: 20 },
        providerRequestId: "resp_1",
      },
    });
  });

  it("lector ESTRICTO: una parte de texto que no es `output_text` es salida invalida; la que si, vale", async () => {
    fetchDoble([
      {
        ok: true,
        body: {
          id: "r",
          output: [{ content: [{ type: "refusal", text: '{"items":[]}' }] }],
        },
      },
    ]);
    await expect(proveedor().run(pedido({ text: "x" }))).rejects.toMatchObject({
      reason: "output_invalid",
    });
    vi.unstubAllGlobals();
    fetchDoble([
      {
        ok: true,
        body: {
          id: "r",
          output: [
            { content: [{ type: "output_text", text: '{"items":[3]}' }] },
          ],
        },
      },
    ]);
    expect((await proveedor().run(pedido({ text: "x" }))).parsed).toEqual({
      items: [3],
    });
  });

  it("sin texto o con texto que no es JSON → output_invalid; el uso negativo se descarta", async () => {
    for (const body of [{ id: "r" }, { id: "r", output_text: "no soy json" }]) {
      fetchDoble([{ ok: true, body }]);
      await expect(
        proveedor().run(pedido({ text: "x" })),
      ).rejects.toMatchObject({ reason: "output_invalid" });
      vi.unstubAllGlobals();
    }
    fetchDoble([
      {
        ok: true,
        body: { ...SALIDA, usage: { input_tokens: -3, output_tokens: 2.5 } },
      },
    ]);
    expect((await proveedor().run(pedido({ text: "x" }))).usage).toEqual({
      inputTokens: null,
      outputTokens: null,
    });
  });
});
