import { and, eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { catalogImportFiles } from "@mi-pasaporte/db/schema";
import type { ImportRow } from "./core";

/**
 * Spec 0147 — EL NOMBRE DEL PDF que viaja en `CatalogImportDTO.sourceFileName`.
 *
 * Imagenes → `null` sin consultar. PDF → el `original_name` del archivo de `position = 0`,
 * filtrado por `import_id` **y** `business_id` (el aislamiento no depende de que el llamador
 * ya haya pasado por `requireImport`). Solo se lee esa columna: ni la clave de R2 ni ningun otro
 * campo de `catalog_import_file` sale de aca.
 *
 * Sin filtro de `status`: la limpieza marca el archivo `deleted` sin borrar la fila, y el nombre
 * sobrevive. Un PDF sin fila de archivo (el insert de archivos de `createImport` va aparte, sin
 * transaccion comun) devuelve `null`, no lanza.
 */
export async function importSourceFileName(
  businessId: string,
  row: ImportRow,
): Promise<string | null> {
  if (row.sourceKind !== "pdf") return null;
  const [file] = await getDb()
    .select({ originalName: catalogImportFiles.originalName })
    .from(catalogImportFiles)
    .where(
      and(
        eq(catalogImportFiles.importId, row.id),
        eq(catalogImportFiles.businessId, businessId),
        eq(catalogImportFiles.position, 0),
      ),
    )
    .limit(1);
  return file?.originalName ?? null;
}
