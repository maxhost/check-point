import { describe, expect, it } from "vitest";
import type { PosOrder } from "../../app/backoffice/pos/pos-types";
import type { TicketSettings as ServerSettings } from "../../server/ticket-settings/settings";
import { buildTicket } from "./build";
import type { TicketOrder, TicketSettings } from "./types";

/** Spec 0184 — QUE se imprime: los bloques opcionales siguen al ajuste; la base va siempre. */

// Si el DTO del servidor y el del modulo se separan, esto deja de compilar.
const sameShape: TicketSettings = {} as ServerSettings;
void sameShape;
// La orden de la pantalla del POS se pasa tal cual a `buildTicket`.
const fromPos: TicketOrder = {} as PosOrder;
void fromPos;

const order: TicketOrder = {
  business: { name: "Café Ñandú", currencyCode: "USD" },
  tableLabel: "Mesa 4",
  items: [
    { name: "Capuchino", quantity: 2, unitPrice: "2.50", lineTotal: "5.00" },
    { name: "Torta", quantity: 1, unitPrice: "3.25", lineTotal: "3.25" },
  ],
  total: "8.25",
};
const now = new Date(2026, 9, 9, 14, 5);

describe("buildTicket (spec 0184)", () => {
  it.each([
    [true, true, "Café Ñandú", "Mesa 4"],
    [true, false, "Café Ñandú", null],
    [false, true, null, "Mesa 4"],
    [false, false, null, null],
  ])(
    "ORACULO DE M2 — showBusinessName=%s showTable=%s",
    (showBusinessName, showTable, businessName, table) => {
      const doc = buildTicket(order, { showBusinessName, showTable }, { now });
      expect(doc.businessName).toBe(businessName);
      expect(doc.table).toBe(table);
      // La base no depende del ajuste.
      expect(doc.lines).toHaveLength(2);
      expect(doc.total).toMatch(/8,25/);
    },
  );

  it("la base: cantidad, unitario y subtotal con moneda; fecha y hora de la impresion", () => {
    const doc = buildTicket(order, { showBusinessName: true, showTable: true }, { now });
    expect(doc.lines[0]).toMatchObject({ name: "Capuchino", quantity: 2 });
    expect(doc.lines[0].unitPrice).toMatch(/\$.*2,50/);
    expect(doc.lines[0].lineTotal).toMatch(/5,00/);
    expect(doc.date).toBe(now.toLocaleDateString("es-EC"));
    expect(doc.time).toMatch(/14:05/);
  });

  it("orden sin mesa → table null aunque el bloque este prendido", () => {
    for (const tableLabel of [null, "   "]) {
      const doc = buildTicket({ ...order, tableLabel }, { showBusinessName: true, showTable: true });
      expect(doc.table).toBeNull();
    }
  });

  it("qr: ausente o vacio → null; con contenido → el contenido", () => {
    const s = { showBusinessName: true, showTable: true };
    expect(buildTicket(order, s).qr).toBeNull();
    expect(buildTicket(order, s, { qr: "  " }).qr).toBeNull();
    expect(buildTicket(order, s, { qr: "https://my.checkpass.club/x" }).qr).toBe(
      "https://my.checkpass.club/x",
    );
  });
});
