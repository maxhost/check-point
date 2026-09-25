import { describe, expect, it } from "vitest";
import type { CatalogImport, ImportStatus } from "./catalog-ai-import-api";
import {
  importToShow,
  isProcessing,
  processingMessage,
  PROCESSING_MESSAGES,
} from "./catalog-ai-import-state";

/**
 * Spec 0093 — el modal de importacion no se cuelga. Las tres decisiones del modal, puras.
 * El cableado en el componente (que el modal reciba `dismissible`, que el intervalo corra, que
 * el `ref` se escriba) queda declarado afuera y lo cubre el QA del owner.
 */

const STATUSES: ImportStatus[] = [
  "pending_upload",
  "queued",
  "analyzing",
  "accepted",
  "failed",
  "cancelled",
  "expired",
];

/** Unica fuente de verdad del test: que combinacion es «procesando». */
const PROCESSING: Record<ImportStatus, { idle: boolean; busy: boolean }> = {
  pending_upload: { idle: false, busy: true },
  queued: { idle: true, busy: true },
  analyzing: { idle: true, busy: true },
  accepted: { idle: false, busy: false },
  failed: { idle: false, busy: false },
  cancelled: { idle: false, busy: false },
  expired: { idle: false, busy: false },
};

function catalogImport(id: string, status: ImportStatus): CatalogImport {
  return { id, status, expiresAt: "2026-09-25T00:00:00.000Z" };
}

describe("isProcessing", () => {
  for (const status of STATUSES) {
    for (const busy of [false, true]) {
      it(`${status} con busy=${busy}`, () => {
        expect(isProcessing({ status, busy })).toBe(
          busy ? PROCESSING[status].busy : PROCESSING[status].idle,
        );
      });
    }
  }

  it("sin import no hay nada procesandose, aunque haya busy", () => {
    expect(isProcessing({ status: null, busy: true })).toBe(false);
    expect(isProcessing({ status: undefined, busy: false })).toBe(false);
  });
});

describe("processingMessage", () => {
  const length = PROCESSING_MESSAGES.length;

  it("hay al menos tres textos y el primero es el que pidio el owner", () => {
    expect(length).toBeGreaterThanOrEqual(3);
    expect(PROCESSING_MESSAGES[0]).toBe("Esperá, estamos procesando tu menú…");
  });

  it("rota en orden y vuelve al principio", () => {
    expect(processingMessage(0)).toBe(PROCESSING_MESSAGES[0]);
    expect(processingMessage(1)).toBe(PROCESSING_MESSAGES[1]);
    expect(processingMessage(length - 1)).toBe(PROCESSING_MESSAGES[length - 1]);
    expect(processingMessage(length)).toBe(PROCESSING_MESSAGES[0]);
    expect(processingMessage(length + 1)).toBe(PROCESSING_MESSAGES[1]);
  });

  it("ningun texto promete un aviso por email (ADR 0085)", () => {
    for (const message of PROCESSING_MESSAGES) {
      expect(message.toLowerCase()).not.toContain("email");
      expect(message.toLowerCase()).not.toContain("avis");
    }
  });
});

describe("importToShow", () => {
  it("un accepted nunca se repinta al abrir: se abre la eleccion de archivos", () => {
    expect(importToShow(catalogImport("imp-1", "accepted"))).toBeNull();
  });

  for (const status of STATUSES.filter((status) => status !== "accepted")) {
    it(`un ${status} se muestra tal cual`, () => {
      const found = catalogImport("imp-1", status);
      expect(importToShow(found)).toBe(found);
    });
  }

  it("sin import no hay nada que mostrar", () => {
    expect(importToShow(null)).toBeNull();
  });
});
