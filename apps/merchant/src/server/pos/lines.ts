import { CounterError, isUuid } from "@mi-pasaporte/domain/server/counter/core";
import type { GrantItem } from "../counter/orders";
import { buildDetailed } from "../counter/grant-input";

/**
 * Spec 0169 — LAS LINEAS de una orden del POS: el nombre de la mesa, el total y el merge del
 * `PUT`. Lo puro va arriba (tiene su test de unidad, `lines.test.ts`); el snapshot del catalogo,
 * que es el unico que toca la base, es `snapshotNewLines`.
 */

export const MAX_LINES = 200;
const MAX_TABLE_LABEL = 60;

/** `tableLabel`: texto libre, sin validar duplicados (owner, MVP). `trim`, 1..60 caracteres. */
export function normalizeTableLabel(raw: unknown): string {
  const label = typeof raw === "string" ? raw.trim() : "";
  if (label.length === 0 || label.length > MAX_TABLE_LABEL) {
    throw new CounterError(
      422,
      "invalid_table_label",
      `El nombre de la mesa tiene que tener entre 1 y ${MAX_TABLE_LABEL} caracteres.`,
    );
  }
  return label;
}

/** El total de una linea: el MISMO calculo que `buildDetailed` (`grant-input.ts`), para que la
 * orden del POS y la `core.order` del cierre digan lo mismo. */
export function lineTotalOf(unitPrice: string, quantity: number): string {
  return (Number(unitPrice) * quantity).toFixed(2);
}

/** Σ de las lineas, sumado EN CENTAVOS (sumar decimales arrastra error de punto flotante). */
export function totalOf(
  lines: readonly { unitPrice: string; quantity: number }[],
): string {
  const cents = lines.reduce(
    (sum, line) =>
      sum +
      Math.round(Number(lineTotalOf(line.unitPrice, line.quantity)) * 100),
    0,
  );
  return (cents / 100).toFixed(2);
}

/** Una linea del cuerpo de crear/editar: `lineId` presente = linea existente; ausente = nueva. */
export type IncomingLine = {
  lineId: string | null;
  quantity: unknown;
  raw: Record<string, unknown>;
};

/** `items` del cuerpo. Vacio vale (guardar la mesa antes de pedir); mas de 200 → 422. */
export function parseIncomingLines(raw: unknown): IncomingLine[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new CounterError(
      422,
      "invalid_input",
      "Los productos no son válidos.",
    );
  }
  if (raw.length > MAX_LINES) {
    throw new CounterError(
      422,
      "too_many_items",
      `Una orden puede tener hasta ${MAX_LINES} líneas.`,
    );
  }
  return raw.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new CounterError(422, "invalid_input", "Un producto no es válido.");
    }
    const item = entry as Record<string, unknown>;
    const hasLineId =
      item.lineId !== undefined && item.lineId !== null && item.lineId !== "";
    if (hasLineId && !isUuid(item.lineId)) {
      throw new CounterError(
        422,
        "unknown_line",
        "Una línea no es de esta orden.",
      );
    }
    return {
      lineId: hasLineId ? String(item.lineId).trim() : null,
      quantity: item.quantity,
      raw: item,
    };
  });
}

function parseQuantity(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new CounterError(422, "invalid_input", "La cantidad no es válida.");
  }
  return value as number;
}

export type LineMerge = {
  /** Lineas existentes que se quedan: CONSERVAN su snapshot, solo cambia cantidad y posicion. */
  kept: { id: string; quantity: number; position: number }[];
  /** Lineas existentes que no vinieron en la lista: se borran. */
  removed: string[];
  /** Lineas sin `lineId`: nuevas, hacen snapshot del catalogo. */
  added: { raw: Record<string, unknown>; position: number }[];
};

/**
 * EL MERGE DEL `PUT` (spec 0169 §Reglas), puro. La lista que manda la UI es la COMPLETA y su
 * orden es el de carga (`position`). Una linea con `lineId` de ESTA orden conserva su snapshot
 * (precio fijo al agregar, ADR 0130 §2); un `lineId` ajeno → 422 `unknown_line`; repetido → 422
 * `invalid_input`; las existentes ausentes se borran.
 */
export function mergeLines(
  existingIds: readonly string[],
  incoming: readonly IncomingLine[],
): LineMerge {
  const existing = new Set(existingIds);
  const seen = new Set<string>();
  const merge: LineMerge = { kept: [], removed: [], added: [] };
  incoming.forEach((line, position) => {
    if (line.lineId === null) {
      merge.added.push({ raw: line.raw, position });
      return;
    }
    if (!existing.has(line.lineId)) {
      throw new CounterError(
        422,
        "unknown_line",
        "Una línea no es de esta orden.",
      );
    }
    if (seen.has(line.lineId)) {
      throw new CounterError(422, "invalid_input", "Una línea está repetida.");
    }
    seen.add(line.lineId);
    merge.kept.push({
      id: line.lineId,
      quantity: parseQuantity(line.quantity),
      position,
    });
  });
  merge.removed = existingIds.filter((id) => !seen.has(id));
  return merge;
}

/** Las lineas NUEVAS hacen snapshot del catalogo con las mismas reglas y codigos que el
 * mostrador (`buildDetailed`: filtrado por `availableAtCounter(locationId)`, producto sin precio
 * exige `unitPrice` tipeado; `unknown_product`, `invalid_amount`, `invalid_input`). */
export async function snapshotNewLines(
  businessId: string,
  locationId: string | null,
  added: readonly { raw: Record<string, unknown> }[],
): Promise<GrantItem[]> {
  if (added.length === 0) return [];
  const { items } = await buildDetailed(
    businessId,
    locationId,
    added.map((line) => line.raw),
  );
  return items;
}
