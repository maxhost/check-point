import { describe, expect, it } from "vitest";
import { buildTicket } from "../ticket/build";
import type { TicketOrder } from "../ticket/types";
import { encodeTicket } from "./encode";
import { COLUMNS, layoutTicket, twoColumns, wrap } from "./layout";
import { plain } from "./plain";

/** Spec 0184 — COMO se codifica: sin acentos, dentro del ancho, QR solo si hay contenido. */

const order: TicketOrder = {
  business: { name: "Café Ñandú «Pingüino»", currencyCode: "USD" },
  tableLabel: "Mesa Señorial",
  items: [
    {
      name: "Sándwich de jamón serrano con queso manchego y tomate asado al horno",
      quantity: 12,
      unitPrice: "1234.50",
      lineTotal: "14814.00",
    },
    { name: "Té", quantity: 1, unitPrice: "1.00", lineTotal: "1.00" },
  ],
  total: "14815.00",
};
const all = { showBusinessName: true, showTable: true };
const GS_PAREN_K = [0x1d, 0x28, 0x6b];

function contains(bytes: Uint8Array, seq: number[]): boolean {
  outer: for (let i = 0; i + seq.length <= bytes.length; i++) {
    for (let j = 0; j < seq.length; j++)
      if (bytes[i + j] !== seq[j]) continue outer;
    return true;
  }
  return false;
}

describe("plain (spec 0184)", () => {
  it("ORACULO DE M3 — sin acentos ni ñ, solo ASCII imprimible", () => {
    expect(plain("Café Ñandú pingüino")).toBe("Cafe Nandu pinguino");
    expect(plain("$ 2,50 €")).toBe("$ 2,50 EUR");
    expect(plain("«x»")).toBe("x");
  });
});

describe("encodeTicket (spec 0184)", () => {
  it.each([58, 80] as const)(
    "ORACULO DE M3 — %s mm: ningun byte de texto > 0x7F con acentos en la entrada",
    (paper) => {
      const bytes = encodeTicket(buildTicket(order, all), paper);
      expect(Array.from(bytes).every((b) => b <= 0x7f)).toBe(true);
      const text = new TextDecoder("latin1").decode(bytes);
      expect(text).toContain("Cafe Nandu Pinguino");
      expect(text).toContain("Mesa Senorial");
    },
  );

  it("QR nativo (`GS ( k`) solo cuando hay contenido", () => {
    expect(
      contains(encodeTicket(buildTicket(order, all), 58), GS_PAREN_K),
    ).toBe(false);
    expect(
      contains(
        encodeTicket(buildTicket(order, all, { qr: "https://x.y/z" }), 58),
        GS_PAREN_K,
      ),
    ).toBe(true);
  });

  it("bloques apagados no llegan a los bytes", () => {
    const text = new TextDecoder("latin1").decode(
      encodeTicket(
        buildTicket(order, { showBusinessName: false, showTable: false }),
        58,
      ),
    );
    expect(text).not.toContain("Cafe");
    expect(text).not.toContain("Senorial");
    expect(text).toContain("TOTAL");
  });
});

describe("layout (spec 0184)", () => {
  it.each([58, 80] as const)(
    "%s mm: ningun renglon pasa del ancho",
    (paper) => {
      const rows = layoutTicket(buildTicket(order, all, { qr: "q" }), paper);
      for (const row of rows)
        if (row.kind === "text")
          expect(row.text.length).toBeLessThanOrEqual(COLUMNS[paper]);
      expect(rows.some((r) => r.kind === "qr")).toBe(true);
    },
  );

  it("wrap parte palabras mas largas que el ancho; twoColumns alinea a la derecha", () => {
    expect(wrap("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
    expect(twoColumns("TOTAL", "$ 5,00", 16)).toEqual(["TOTAL     $ 5,00"]);
    expect(twoColumns("muy largo a la izquierda", "$ 5,00", 12)).toEqual([
      "muy largo a",
      "la izquierda",
      "      $ 5,00",
    ]);
  });
});
