import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { catalogImportFiles, catalogImports } from "../schema";
import { getPrivateObject } from "../r2";
import { CatalogImportError, type CatalogImportDTO } from "./types";
import { requireImport, toImportDTO, type ImportRow } from "./core";
import { SNIFF_BYTES } from "./validation";
import { sniffKind } from "./sniff";
import { touch } from "./quota";

/**
 * Spec 0090 §6 — `POST /imports/{id}/analyze`: **barato y sincronico**.
 *
 * Lee solo la **cabecera** de cada objeto para sniffear bytes y poder contestar `422` en el
 * momento; marca los uploads, pasa a `queued` y responde **202**. El trabajo largo —normalizar
 * diez `sharp`, contar paginas, esperar al proveedor— corre **despues**, en `after()`
 * (`runAnalysis`), porque no entra en los 60 s de techo de la plataforma.
 *
 * **Es idempotente**: repetirla en `queued`, `analyzing` o `ready` devuelve el estado actual y
 * **no** dispara otra llamada al proveedor. Un reintento de red no cuesta plata.
 */
export type AnalyzeOutcome = {
  import: CatalogImportDTO;
  /** `true` solo la primera vez: es lo que decide si el llamador agenda el `after()`. */
  queued: boolean;
};

export async function startAnalyze(
  business: { id: string },
  importId: string,
): Promise<AnalyzeOutcome> {
  const row = await requireImport(business.id, importId);
  if (
    row.status === "queued" ||
    row.status === "analyzing" ||
    row.status === "ready"
  ) {
    return { import: toImportDTO(row), queued: false };
  }
  if (row.status !== "pending_upload") {
    throw new CatalogImportError(
      409,
      "catalog_import_state",
      "Esa importación ya terminó.",
    );
  }
  await confirmUploads(row);
  const [updated] = await getDb()
    .update(catalogImports)
    .set({ status: "queued", ...touch() })
    .where(
      and(
        eq(catalogImports.id, row.id),
        eq(catalogImports.status, "pending_upload"),
      ),
    )
    .returning();
  // Sin fila, otro request gano la carrera y ya lo encoló: devolver el estado actual es la
  // misma respuesta idempotente de arriba, no un error.
  if (!updated) {
    return {
      import: toImportDTO(await requireImport(business.id, importId)),
      queued: false,
    };
  }
  return { import: toImportDTO(updated), queued: true };
}

/**
 * Confirma que lo reservado esta realmente en R2 y que **los bytes son lo declarado**.
 * Cualquier falta convierte el analisis en un 4xx **antes** de gastar un peso de proveedor.
 */
async function confirmUploads(row: ImportRow): Promise<void> {
  const files = await getDb()
    .select()
    .from(catalogImportFiles)
    .where(
      and(
        eq(catalogImportFiles.importId, row.id),
        inArray(catalogImportFiles.status, [
          "reserved",
          "uploaded",
          "validated",
        ]),
      ),
    )
    .orderBy(asc(catalogImportFiles.position));
  if (files.length !== row.fileCount) {
    throw new CatalogImportError(
      413,
      "catalog_import_too_large",
      "Lo subido no coincide con lo reservado.",
    );
  }
  const expected = row.sourceKind === "pdf" ? "pdf" : "image";
  for (const file of files) {
    let head: Buffer;
    try {
      const object = await getPrivateObject(file.objectKey);
      head = await readHead(object);
    } catch {
      throw new CatalogImportError(
        413,
        "catalog_import_too_large",
        "Falta alguno de los archivos que reservaste.",
      );
    }
    if (sniffKind(head) !== expected) {
      throw new CatalogImportError(
        422,
        "unsupported_catalog_file",
        "El archivo no es del tipo que declaraste.",
      );
    }
    await getDb()
      .update(catalogImportFiles)
      .set({ status: "uploaded", uploadedAt: new Date() })
      .where(eq(catalogImportFiles.id, file.id));
  }
}

/** Lee como mucho `SNIFF_BYTES` y corta: el stream se descarta sin bajar el resto. */
async function readHead(object: {
  Body?: unknown;
  ContentLength?: number;
}): Promise<Buffer> {
  const body = object.Body as
    | AsyncIterable<Uint8Array>
    | ReadableStream<Uint8Array>
    | undefined;
  if (!body) throw new Error("empty_body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  const iterable =
    Symbol.asyncIterator in body
      ? (body as AsyncIterable<Uint8Array>)
      : toIterable(body as ReadableStream<Uint8Array>);
  for await (const chunk of iterable) {
    chunks.push(chunk);
    size += chunk.byteLength;
    if (size >= SNIFF_BYTES) break;
  }
  return Buffer.concat(chunks).subarray(0, SNIFF_BYTES);
}

async function* toIterable(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      if (value) yield value;
    }
  } finally {
    reader.releaseLock();
  }
}
