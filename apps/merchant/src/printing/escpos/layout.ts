import type { TicketDoc } from "../ticket/types";
import { plain } from "./plain";

/**
 * Spec 0184 — EL TICKET EN RENGLONES, antes de los bytes: puro y medible (ningun renglon pasa de
 * `columns`). El orden en el papel vive aca; `encode.ts` solo traduce cada renglon a ESC/POS.
 */
export type Paper = 58 | 80;
export const COLUMNS: Record<Paper, number> = { 58: 32, 80: 48 };

export type Row =
  | { kind: "text"; text: string; align: "left" | "center"; bold?: boolean }
  | { kind: "rule" }
  | { kind: "qr"; value: string };

/** Corta en palabras; una palabra mas larga que el ancho se parte. */
export function wrap(text: string, columns: number): string[] {
  const out: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    for (let piece = word; piece.length > 0; ) {
      const room = current ? columns - current.length - 1 : columns;
      if (piece.length <= room) {
        current = current ? `${current} ${piece}` : piece;
        piece = "";
      } else if (current) {
        out.push(current);
        current = "";
      } else {
        out.push(piece.slice(0, columns));
        piece = piece.slice(columns);
      }
    }
  }
  if (current) out.push(current);
  return out.length ? out : [""];
}

/** Izquierda y derecha en un renglon; si no entran, la izquierda va sola arriba. */
export function twoColumns(left: string, right: string, columns: number): string[] {
  const r = right.slice(0, columns);
  if (left.length + 1 + r.length <= columns)
    return [left + " ".repeat(columns - left.length - r.length) + r];
  return [...wrap(left, columns), " ".repeat(columns - r.length) + r];
}

export function layoutTicket(doc: TicketDoc, paper: Paper): Row[] {
  const columns = COLUMNS[paper];
  const text = (value: string, align: "left" | "center", bold = false): Row[] =>
    wrap(plain(value), columns).map((line) => ({
      kind: "text",
      text: line,
      align,
      ...(bold ? { bold } : {}),
    }));
  const rows: Row[] = [];
  if (doc.businessName) rows.push(...text(doc.businessName, "center", true));
  if (doc.table) rows.push(...text(doc.table, "center"));
  rows.push({ kind: "rule" });
  for (const line of doc.lines) {
    rows.push(...text(line.name, "left"));
    for (const t of twoColumns(
      plain(`${line.quantity} x ${line.unitPrice}`),
      plain(line.lineTotal),
      columns,
    ))
      rows.push({ kind: "text", text: t, align: "left" });
  }
  rows.push({ kind: "rule" });
  for (const t of twoColumns("TOTAL", plain(doc.total), columns))
    rows.push({ kind: "text", text: t, align: "left", bold: true });
  rows.push(...text(`${doc.date} ${doc.time}`, "center"));
  if (doc.qr) rows.push({ kind: "qr", value: doc.qr });
  return rows;
}
