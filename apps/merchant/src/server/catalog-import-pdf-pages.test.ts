import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { countPdfPages } from "./catalog-import/pdf-pages";

/**
 * Spec 0090 §2 / ADR 0082 §11 — EL CONTADOR DE PAGINAS, con PDFs sinteticos construidos acá.
 *
 * El caso que justifica la pieza entera es el de `/ObjStm`: un escaneo naive de `/Type /Page`
 * sobre el texto crudo devuelve **0**, y con un check de `<= 10` un documento de 400 paginas
 * pasaria. Por eso cada caso de abajo lleva **tambien** la medicion del naive: sin ese
 * contraste, el verde no distingue «nuestro contador funciona» de «cualquier contador
 * funcionaria».
 */

/** El escaneo naive: el que esta spec existe para NO usar. Es el oraculo por contraste. */
const naive = (pdf: Buffer): number =>
  (pdf.toString("latin1").match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length;

function plainPdf(pages: number): Buffer {
  const kids = Array.from({ length: pages }, (_, i) => `${i + 3} 0 R`).join(
    " ",
  );
  const objects = Array.from(
    { length: pages },
    (_, i) => `${i + 3} 0 obj << /Type /Page /Parent 2 0 R >> endobj\n`,
  ).join("");
  return Buffer.from(
    `%PDF-1.4\n` +
      `1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n` +
      `2 0 obj << /Type /Pages /Kids [${kids}] /Count ${pages} >> endobj\n` +
      objects +
      `trailer << /Root 1 0 R >>\n%%EOF\n`,
    "latin1",
  );
}

/** Las paginas viven DENTRO de un object stream Flate: en el texto crudo no hay ni un
 * `/Type /Page` ni un `/Count`. Es el PDF moderno. */
function objStmPdf(pages: number): Buffer {
  const inner = Array.from(
    { length: pages },
    () => `<< /Type /Page /Parent 2 0 R >>`,
  ).join(" ");
  const compressed = deflateSync(Buffer.from(inner, "latin1"));
  return Buffer.concat([
    Buffer.from(
      `%PDF-1.5\n4 0 obj << /Type /ObjStm /N ${pages} /Filter /FlateDecode /Length ${compressed.length} >>\nstream\n`,
      "latin1",
    ),
    compressed,
    Buffer.from(
      `\nendstream\nendobj\ntrailer << /Root 1 0 R >>\n%%EOF\n`,
      "latin1",
    ),
  ]);
}

describe("contador de paginas de PDF (spec 0090 §2)", () => {
  it("un PDF plano de 1 y de 10 paginas se cuenta bien", () => {
    expect(countPdfPages(plainPdf(1))).toEqual({ ok: true, pages: 1 });
    expect(countPdfPages(plainPdf(10))).toEqual({ ok: true, pages: 10 });
  });

  it("un PDF de 11 paginas cuenta 11 — el tope lo aplica quien lo llama", () => {
    expect(countPdfPages(plainPdf(11))).toEqual({ ok: true, pages: 11 });
  });

  /** ORACULO DE M-PDF: si el contador volviera al escaneo naive, este caso da 0 y un PDF
   * enorme pasaria el tope. */
  it("con `/ObjStm` el naive da 0 y nosotros contamos las paginas reales", () => {
    const pdf = objStmPdf(40);
    expect(naive(pdf)).toBe(0);
    expect(countPdfPages(pdf)).toEqual({ ok: true, pages: 40 });
  });

  it("toma el MAXIMO de las dos señales: `/Count` alto gana sobre pocos objetos", () => {
    // Un PDF con revisiones incrementales: el `/Count` del nodo raiz dice 12 y solo hay 2
    // objetos de pagina visibles. Sobre-contar solo puede rechazar un archivo valido.
    const pdf = Buffer.from(
      `%PDF-1.4\n2 0 obj << /Type /Pages /Count 12 >> endobj\n` +
        `3 0 obj << /Type /Page >> endobj\n4 0 obj << /Type /Page >> endobj\n%%EOF\n`,
      "latin1",
    );
    expect(countPdfPages(pdf)).toEqual({ ok: true, pages: 12 });
  });

  it("`/Type /Pages` NO se cuenta como pagina", () => {
    const pdf = Buffer.from(
      `%PDF-1.4\n2 0 obj << /Type /Pages /Kids [] >> endobj\n%%EOF\n`,
      "latin1",
    );
    // Sin `/Count` y sin objetos de pagina, la unica señal posible es cero: se RECHAZA.
    expect(countPdfPages(pdf)).toEqual({ ok: false, reason: "unreadable" });
  });

  it("un PDF cifrado se rechaza por `/Encrypt`", () => {
    const pdf = Buffer.concat([
      plainPdf(3),
      Buffer.from(`trailer << /Encrypt 9 0 R >>\n%%EOF\n`, "latin1"),
    ]);
    expect(countPdfPages(pdf)).toEqual({ ok: false, reason: "encrypted" });
  });

  it("un PDF indescifrable —sin ninguna señal— se rechaza, no devuelve 0", () => {
    const pdf = Buffer.from(`%PDF-1.7\n%âãÏÓ\n%%EOF\n`, "latin1");
    expect(countPdfPages(pdf)).toEqual({ ok: false, reason: "unreadable" });
  });

  it("lo que no es PDF no se cuenta", () => {
    expect(countPdfPages(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toEqual({
      ok: false,
      reason: "unreadable",
    });
  });

  it("un stream que no es Flate se ignora sin romper el conteo", () => {
    const pdf = Buffer.concat([
      Buffer.from(
        `%PDF-1.4\n2 0 obj << /Type /Pages /Count 2 >> endobj\n` +
          `5 0 obj << /Filter /LZWDecode >>\nstream\n`,
        "latin1",
      ),
      Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]),
      Buffer.from(`\nendstream\nendobj\n%%EOF\n`, "latin1"),
    ]);
    expect(countPdfPages(pdf)).toEqual({ ok: true, pages: 2 });
  });
});
