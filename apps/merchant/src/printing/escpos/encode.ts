import ReceiptPrinterEncoder from "@point-of-sale/receipt-printer-encoder";
import type { TicketDoc } from "../ticket/types";
import { COLUMNS, type Paper, layoutTicket } from "./layout";

/**
 * Spec 0184 — COMO SE CODIFICA: `TicketDoc` → bytes ESC/POS para termicas genericas de 58/80 mm
 * (`@point-of-sale/receipt-printer-encoder`). El QR es el nativo de la impresora (`GS ( k`).
 * Otra familia de impresoras (StarPRNT, etc.) = otro archivo hermano con la misma firma.
 */
export function encodeTicket(doc: TicketDoc, paper: Paper): Uint8Array {
  const columns = COLUMNS[paper];
  const encoder = new ReceiptPrinterEncoder({ language: "esc-pos", columns });
  encoder.initialize();
  for (const row of layoutTicket(doc, paper)) {
    if (row.kind === "rule") {
      encoder.align("left").line("-".repeat(columns));
    } else if (row.kind === "qr") {
      encoder.newline().align("center").qrcode(row.value).newline();
    } else {
      encoder
        .align(row.align)
        .bold(row.bold === true)
        .line(row.text);
    }
  }
  return encoder.align("left").newline(3).cut().encode();
}
