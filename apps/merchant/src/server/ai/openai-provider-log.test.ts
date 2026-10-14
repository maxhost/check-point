import { afterEach, describe, expect, it, vi } from "vitest";

// El registro se dobla: aca se mide el adaptador y el log, no la base (eso es `ai-service.neon`).
vi.mock("./usage", () => ({
  insertAiRequest: vi.fn(async () => "fila-doble"),
  closeAiRequest: vi.fn(async () => null),
  requestIdOf: vi.fn(async () => null),
  countAiRequests: vi.fn(async () => 0),
}));

import { AiUnavailableError } from "./errors";
import { runAiTask } from "./service";
import {
  CLAVE,
  JPEG,
  PROMPT,
  TAREA,
  fetchDoble,
  pedido,
  proveedor,
} from "./openai-test-support";

/** Spec 0224 §4 — las FALLAS del adaptador OpenAI (timeout, red, HTTP) y el unico evento de log,
 * `ai_request_failed`, sin contenido ni clave. Aparte de `openai-provider.test.ts` por el hook
 * `file-size`. */

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fallas del adaptador (spec 0224 §4)", () => {
  it("timeout → `timeout`", async () => {
    fetchDoble(Object.assign(new Error("vencio"), { name: "TimeoutError" }));
    await expect(proveedor().run(pedido({ text: "x" }))).rejects.toMatchObject({
      reason: "timeout",
    });
  });

  it("un error de red → provider_error con `network_error` y el `cause.code`, sin la clave", async () => {
    fetchDoble(
      Object.assign(new TypeError("fetch failed"), {
        cause: { code: "ENOTFOUND" },
      }),
    );
    const error = await proveedor()
      .run(pedido({ text: "x" }))
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiUnavailableError);
    expect((error as AiUnavailableError).diagnostics).toMatchObject({
      kind: "network_error",
      operation: "create",
      causeCode: "ENOTFOUND",
      hostname: "api.openai.com",
    });
    expect(JSON.stringify(error)).not.toContain(CLAVE);
  });
});

describe("higiene del log `ai_request_failed` (spec 0224 §4)", () => {
  it("HTTP 401 → un solo `ai_request_failed` con huella y largo de la clave; ningun argumento lleva la clave, el texto, el cuerpo del proveedor ni la imagen", async () => {
    const TEXTO = "texto-centinela-del-dueño";
    const MENSAJE = `${PROMPT} cuerpo-centinela-del-proveedor`;
    fetchDoble([
      {
        ok: false,
        status: 401,
        headers: { "x-request-id": "req_diagnostico" },
        body: {
          error: {
            type: "invalid_request_error",
            code: "invalid_api_key",
            param: "authorization",
            message: MENSAJE,
          },
        },
      },
    ]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = await runAiTask(
      TAREA,
      { context: "CTX", text: TEXTO, images: [{ kind: "image", jpeg: JPEG }] },
      { businessId: "b-1", userId: "u-1" },
      { provider: proveedor() },
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiUnavailableError);
    expect((error as AiUnavailableError).reason).toBe("provider_error");
    expect(warn).toHaveBeenCalledTimes(1);
    const [evento, datos] = warn.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(evento).toBe("ai_request_failed");
    expect(datos).toMatchObject({
      task: "demo.alpha",
      provider: "openai",
      model: "modelo-x",
      reason: "provider_error",
      diagnostics: {
        kind: "http_error",
        operation: "create",
        keyLength: CLAVE.length,
        keyHasOuterWhitespace: false,
        status: 401,
        errorType: "invalid_request_error",
        errorCode: "invalid_api_key",
        errorParam: "authorization",
        requestId: "req_diagnostico",
        hostname: "api.openai.com",
        redirected: false,
      },
    });
    expect(
      (datos.diagnostics as { keyFingerprint: string }).keyFingerprint,
    ).toMatch(/^[0-9a-f]{12}$/);
    const logueado = JSON.stringify(warn.mock.calls);
    for (const centinela of [
      CLAVE,
      TEXTO,
      "cuerpo-centinela-del-proveedor",
      JPEG.toString("base64"),
      PROMPT,
    ]) {
      expect(logueado).not.toContain(centinela);
    }
  });
});
