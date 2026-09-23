import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { catalogImportFiles } from "../schema";
import { createTemporaryUploadUrl } from "../r2";
import { CatalogImportError, type UploadTicket } from "./types";
import { MAX_IMAGE_BYTES, MAX_PDF_BYTES } from "./validation";
import { requireImport } from "./core";

/** Cuanto vive una URL firmada. Diez minutos es lo que ya usan las otras tres subidas. */
const UPLOAD_URL_TTL_SECONDS = 10 * 60;

/**
 * §6 — `POST /imports/{id}/uploads`: **re-firma** lo que sigue en `reserved`.
 *
 * Existe porque una URL firmada dura ~10 min y 50 MB por datos moviles puede pasarse: sin
 * esta ruta, una subida cortada obliga a empezar el import de cero. **No** cambia `position`
 * ni crea filas.
 */
export async function resignUploads(
  business: { id: string },
  importId: string,
): Promise<{ uploads: UploadTicket[] }> {
  const row = await requireImport(business.id, importId);
  if (row.status !== "pending_upload") {
    throw new CatalogImportError(
      409,
      "catalog_import_state",
      "Esta importación ya no acepta archivos.",
    );
  }
  const pending = await getDb()
    .select()
    .from(catalogImportFiles)
    .where(
      and(
        eq(catalogImportFiles.importId, importId),
        eq(catalogImportFiles.status, "reserved"),
      ),
    )
    .orderBy(asc(catalogImportFiles.position));
  return {
    uploads: await signTickets(
      pending,
      row.sourceKind === "pdf" ? "pdf" : "images",
    ),
  };
}

export async function signTickets(
  files: Array<{
    id: string;
    objectKey: string;
    declaredContentType: string;
    byteSize: number;
  }>,
  sourceKind: "pdf" | "images",
): Promise<UploadTicket[]> {
  const maxBytes = sourceKind === "pdf" ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
  const tickets: UploadTicket[] = [];
  for (const file of files) {
    tickets.push({
      fileId: file.id,
      url: await createTemporaryUploadUrl({
        objectKey: file.objectKey,
        contentType: file.declaredContentType,
        byteSize: file.byteSize,
        maxBytes,
        expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
      }),
      method: "PUT",
      headers: { "content-type": file.declaredContentType },
    });
  }
  return tickets;
}
