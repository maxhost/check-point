import { describe, expect, it } from "vitest";
import { toImportDTO, type ImportRow } from "./catalog-import/core";
import {
  CATALOG_IMPORT_ERROR_CODES,
  CatalogImportError,
} from "./catalog-import/types";
import { importError } from "../app/api/catalog/imports/_auth";

/**
 * Spec 0090 §6/§9 — EL CONTRATO, POR VALOR EXACTO.
 *
 * ORACULO DE M7: la fila que se le pasa a `toImportDTO` trae **todo** lo interno
 * —`provider_job_id`, `provider_request_id`, tokens, costo en duracion— y el test asevera el
 * objeto **completo** con `toEqual` y ademas la lista de claves. Un campo de mas rompe los
 * dos asserts; un `...row` con `delete` de por medio rompe el segundo en cuanto la tabla gane
 * una columna.
 */
const FILA: ImportRow = {
  id: "11111111-1111-4111-8111-111111111111",
  businessId: "22222222-2222-4222-8222-222222222222",
  createdByUserId: "u-1",
  status: "accepted",
  sourceKind: "images",
  fileCount: 3,
  pageCount: 3,
  // La extraccion CRUDA vive en esta columna y **nunca** cruza al cliente (§9).
  draft: { categories: [{ name: "Menu crudo del proveedor" }] },
  legacyDraftVersion: 0,
  provider: "openai",
  model: "gpt-x",
  promptVersion: "v1",
  schemaVersion: "v1",
  providerJobId: "resp_secreto",
  providerRequestId: "req_secreto",
  inputTokens: 1234,
  outputTokens: 567,
  durationMs: 8900,
  attemptCount: 1,
  leaseUntil: null,
  cancelRequestedAt: null,
  acceptedSummary: {
    categoriesCreated: 12,
    categoriesReused: 2,
    productsCreated: 86,
    productsSkipped: 4,
    productsWithoutPrice: 3,
    discardedCount: 4,
    discarded: [{ text: "Milanesa ???", reason: "unreadable_name" }],
  },
  failureCode: null,
  failureDetail: null,
  createdAt: new Date("2026-09-22T10:00:00.000Z"),
  updatedAt: new Date("2026-09-22T10:00:00.000Z"),
  expiresAt: new Date("2026-09-23T10:00:00.000Z"),
  acceptedAt: null,
  cancelledAt: null,
  cleanedAt: null,
};

describe("el DTO del import es una allow-list cerrada (specs 0090 §6 / 0091 §9)", () => {
  it("devuelve EXACTAMENTE los ocho campos del contrato", () => {
    expect(toImportDTO(FILA)).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      status: "accepted",
      sourceKind: "images",
      fileCount: 3,
      pageCount: 3,
      expiresAt: "2026-09-23T10:00:00.000Z",
      result: {
        categoriesCreated: 12,
        categoriesReused: 2,
        productsCreated: 86,
        productsSkipped: 4,
        productsWithoutPrice: 3,
        discardedCount: 4,
        discarded: [{ text: "Milanesa ???", reason: "unreadable_name" }],
      },
      error: null,
    });
    expect(Object.keys(toImportDTO(FILA)).sort()).toEqual([
      "error",
      "expiresAt",
      "fileCount",
      "id",
      "pageCount",
      "result",
      "sourceKind",
      "status",
    ]);
  });

  /** §9 — `result` es un objeto **solo** en `accepted`; y la extraccion cruda de la columna
   * `draft` no cruza en ningun estado. */
  it("fuera de `accepted`, `result` es null — y la extracción cruda nunca viaja", () => {
    for (const status of [
      "pending_upload",
      "queued",
      "analyzing",
      "failed",
      "cancelled",
      "expired",
    ] as const) {
      const dto = toImportDTO({ ...FILA, status });
      expect(dto.result).toBeNull();
      expect(JSON.stringify(dto)).not.toContain("Menu crudo del proveedor");
    }
    expect(JSON.stringify(toImportDTO(FILA))).not.toContain(
      "Menu crudo del proveedor",
    );
  });

  it("NO filtra el job id, el request id, los tokens ni el negocio — ni serializado", () => {
    const serializado = JSON.stringify(toImportDTO(FILA));
    for (const secreto of [
      "resp_secreto",
      "req_secreto",
      "1234",
      "567",
      "8900",
      "22222222-2222-4222-8222-222222222222",
      "openai",
      "gpt-x",
      "u-1",
    ]) {
      expect(serializado).not.toContain(secreto);
    }
  });

  it("en `failed` el error es `{code,message}` saneado; en el resto es null", () => {
    expect(
      toImportDTO({
        ...FILA,
        status: "failed",
        draft: null,
        failureCode: "provider_unavailable",
        failureDetail: "No pudimos analizar el menú.",
      }).error,
    ).toEqual({
      code: "provider_unavailable",
      message: "No pudimos analizar el menú.",
    });
    expect(toImportDTO({ ...FILA, status: "accepted" }).error).toBeNull();
  });

  it("un `source_kind` inesperado en la base no se propaga crudo", () => {
    expect(toImportDTO({ ...FILA, sourceKind: "vhs" }).sourceKind).toBe(
      "images",
    );
  });
});

describe("la forma de los errores (contrato 0090 §0)", () => {
  it("todo error lleva `{error, code}`", async () => {
    const response = importError(
      new CatalogImportError(409, "catalog_import_in_progress", "Ya hay una."),
      "fallback",
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Ya hay una.",
      code: "catalog_import_in_progress",
    });
  });

  it("el 429 es el ÚNICO con campo extra, y va también en el header", async () => {
    const response = importError(
      new CatalogImportError(
        429,
        "catalog_import_rate_limited",
        "Ya usaste tu análisis.",
        43_200,
      ),
      "fallback",
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("43200");
    expect(await response.json()).toEqual({
      error: "Ya usaste tu análisis.",
      code: "catalog_import_rate_limited",
      retryAfterSeconds: 43_200,
    });
  });

  it("lo que NO es un error del dominio sale como 503 con code genérico, sin el mensaje", async () => {
    const response = importError(
      new Error("connect ECONNREFUSED 10.0.0.1:5432"),
      "No pudimos preparar la importación.",
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "No pudimos preparar la importación.",
      code: "catalog_import_unavailable",
    });
  });

  it("la lista de `code` es CERRADA y coincide con el contrato escrito", () => {
    expect([...CATALOG_IMPORT_ERROR_CODES].sort()).toEqual([
      "catalog_import_already_accepted",
      "catalog_import_in_progress",
      "catalog_import_not_found",
      "catalog_import_rate_limited",
      "catalog_import_state",
      "catalog_import_too_large",
      "catalog_page_limit",
      "catalog_pdf_encrypted",
      "invalid_import_files",
      "provider_unavailable",
      "unsupported_catalog_file",
    ]);
    // Spec 0091 §9 — los CUATRO que se borraron con el borrador no pueden volver de rebote.
    for (const muerto of [
      "catalog_import_version",
      "catalog_import_conflict",
      "unresolved_catalog_import",
      "invalid_catalog_draft",
    ]) {
      expect([...CATALOG_IMPORT_ERROR_CODES]).not.toContain(muerto);
    }
  });
});
