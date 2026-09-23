import { describe, expect, it } from "vitest";
import { CatalogImportError } from "./catalog-import/types";
import { validateImportFiles } from "./catalog-import/validation";
import { sniffKind } from "./catalog-import/sniff";

/**
 * Spec 0090 §2/§4 — LA MATRIZ DE ENTRADA: formatos, mezcla, cantidades, tamaños, y el
 * esquema cerrado con el que se valida **siempre** la salida del proveedor.
 *
 * Cada rechazo asevera **el `code` del contrato**, no solo que tiró: el `code` es lo que la
 * pantalla programa, y un 400 con el code equivocado es un contrato roto con los tests en
 * verde.
 */
const imagen = (byteSize = 1_000, contentType = "image/jpeg") => ({
  name: "menu.jpg",
  contentType,
  byteSize,
});
const pdf = (byteSize = 1_000) => ({
  name: "menu.pdf",
  contentType: "application/pdf",
  byteSize,
});

function codigoDe(fn: () => unknown): { status: number; code: string } {
  try {
    fn();
  } catch (error) {
    if (error instanceof CatalogImportError) {
      return { status: error.status, code: error.code };
    }
    throw error;
  }
  throw new Error("no tiró");
}

describe("validación de los archivos reservados (spec 0090 §2)", () => {
  it("1 a 10 imágenes pasan y el orden se conserva", () => {
    const diez = Array.from({ length: 10 }, () => imagen());
    expect(validateImportFiles({ files: diez }).sourceKind).toBe("images");
    expect(validateImportFiles({ files: diez }).files).toHaveLength(10);
    expect(validateImportFiles({ files: [imagen()] }).files).toHaveLength(1);
  });

  it("11 imágenes no", () => {
    expect(
      codigoDe(() =>
        validateImportFiles({
          files: Array.from({ length: 11 }, () => imagen()),
        }),
      ),
    ).toEqual({ status: 400, code: "invalid_import_files" });
  });

  it("la lista vacía no", () => {
    expect(codigoDe(() => validateImportFiles({ files: [] }))).toEqual({
      status: 400,
      code: "invalid_import_files",
    });
  });

  it("un PDF solo, sí; dos PDFs, no", () => {
    expect(validateImportFiles({ files: [pdf()] }).sourceKind).toBe("pdf");
    expect(
      codigoDe(() => validateImportFiles({ files: [pdf(), pdf()] })),
    ).toEqual({
      status: 400,
      code: "invalid_import_files",
    });
  });

  it("MEZCLAR PDF e imágenes no se puede — es la regla que no se deduce", () => {
    expect(
      codigoDe(() => validateImportFiles({ files: [pdf(), imagen()] })),
    ).toEqual({ status: 400, code: "invalid_import_files" });
    expect(
      codigoDe(() => validateImportFiles({ files: [imagen(), pdf()] })),
    ).toEqual({ status: 400, code: "invalid_import_files" });
  });

  it("los formatos de cámara de Android e iPhone entran", () => {
    for (const tipo of [
      "image/heic",
      "image/heif",
      "image/webp",
      "image/png",
      "image/jpg",
    ]) {
      expect(
        validateImportFiles({ files: [imagen(1000, tipo)] }).sourceKind,
      ).toBe("images");
    }
  });

  it("GIF, SVG y ofimáticos no", () => {
    for (const tipo of [
      "image/gif",
      "image/svg+xml",
      "application/msword",
      "",
    ]) {
      expect(
        codigoDe(() => validateImportFiles({ files: [imagen(1000, tipo)] })),
      ).toEqual({ status: 400, code: "invalid_import_files" });
    }
  });

  it("los topes de tamaño son 413 y no 400", () => {
    expect(
      codigoDe(() =>
        validateImportFiles({ files: [imagen(10 * 1024 * 1024 + 1)] }),
      ),
    ).toEqual({ status: 413, code: "catalog_import_too_large" });
    expect(
      codigoDe(() =>
        validateImportFiles({ files: [pdf(20 * 1024 * 1024 + 1)] }),
      ),
    ).toEqual({ status: 413, code: "catalog_import_too_large" });
    // 6 fotos de 9 MB pasan el total de 50 MB aunque ninguna pase el tope individual.
    expect(
      codigoDe(() =>
        validateImportFiles({
          files: Array.from({ length: 6 }, () => imagen(9 * 1024 * 1024)),
        }),
      ),
    ).toEqual({ status: 413, code: "catalog_import_too_large" });
  });

  it("justo en el tope pasa", () => {
    expect(
      validateImportFiles({ files: [imagen(10 * 1024 * 1024)] }).files[0]
        .byteSize,
    ).toBe(10 * 1024 * 1024);
    expect(
      validateImportFiles({ files: [pdf(20 * 1024 * 1024)] }).sourceKind,
    ).toBe("pdf");
  });

  it("un tamaño que no es un entero positivo no", () => {
    for (const tamaño of [0, -1, 1.5, "1000", null]) {
      expect(
        codigoDe(() =>
          validateImportFiles({
            files: [
              { name: "a.jpg", contentType: "image/jpeg", byteSize: tamaño },
            ],
          }),
        ),
      ).toEqual({ status: 400, code: "invalid_import_files" });
    }
  });
});

describe("detección por bytes (spec 0090 §2)", () => {
  const head = (bytes: number[]) => Buffer.from(bytes);

  it("reconoce JPEG, PNG, WebP, ISO-BMFF (HEIC) y PDF", () => {
    expect(sniffKind(head([0xff, 0xd8, 0xff, 0xe0]))).toBe("image");
    expect(
      sniffKind(head([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe("image");
    expect(sniffKind(Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1"))).toBe(
      "image",
    );
    expect(sniffKind(Buffer.from("\0\0\0\x18ftypheic", "latin1"))).toBe(
      "image",
    );
    expect(sniffKind(Buffer.from("%PDF-1.7\n", "latin1"))).toBe("pdf");
  });

  it("un SVG o un GIF con nombre de JPEG NO son imagen: la extensión no es autoridad", () => {
    expect(sniffKind(Buffer.from("<svg xmlns=", "latin1"))).toBeNull();
    expect(sniffKind(Buffer.from("GIF89a", "latin1"))).toBeNull();
    expect(sniffKind(Buffer.from("PK\x03\x04", "latin1"))).toBeNull();
  });
});
