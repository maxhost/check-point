import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { catalogImportFiles, catalogImports } from "../schema";
import { catalogImportObjectKey } from "../r2";
import { isUniqueViolation } from "../catalog/categories";
import {
  CATALOG_IMPORT_OPEN_STATUSES,
  type CatalogImportStatus,
} from "../schema/catalog-import";
import {
  CatalogImportError,
  type CatalogImportDTO,
  type CatalogImportDraft,
  type UploadTicket,
} from "./types";
import { validateImportFiles } from "./validation";
import { signTickets } from "./uploads";
import { assertQuota, entitlementContextOf, touch } from "./quota";
import { enqueueImportCleanup, purgeImportObjects } from "./cleanup";

/** Cuanto vive un import antes de vencer. Se **extiende al pasar a `ready`** para que
 * revisar un menu largo no lo venza mientras se revisa (§7). */
export const IMPORT_TTL_MS = 24 * 60 * 60 * 1000;

export type ImportRow = typeof catalogImports.$inferSelect;

/** Lo que el negocio ve como «en curso»: los cuatro no terminales. */
const OPEN: readonly CatalogImportStatus[] = CATALOG_IMPORT_OPEN_STATUSES;

export const notFound = () =>
  new CatalogImportError(
    404,
    "catalog_import_not_found",
    "No encontramos esa importación.",
  );

/**
 * Spec 0090 §6 — EL DTO, ALLOW-LIST CERRADA.
 *
 * Se construye campo por campo **a proposito**: un `...row` con un `delete` de por medio
 * filtra cada columna que la tabla gane en el futuro. No viajan —ni van a viajar— la clave de
 * R2, el `provider_job_id`, el `provider_request_id`, los tokens, el costo ni la respuesta
 * cruda del modelo.
 */
export function toImportDTO(row: ImportRow): CatalogImportDTO {
  return {
    id: row.id,
    status: row.status as CatalogImportStatus,
    sourceKind: row.sourceKind === "pdf" ? "pdf" : "images",
    fileCount: row.fileCount,
    pageCount: row.pageCount,
    expiresAt: row.expiresAt.toISOString(),
    draft: (row.draft as CatalogImportDraft | null) ?? null,
    error:
      row.status === "failed"
        ? {
            code: row.failureCode ?? "catalog_import_failed",
            message:
              row.failureDetail ??
              "No pudimos analizar el menú. Probá de nuevo.",
          }
        : null,
  };
}

/** El unico import no terminal del negocio, o `null`. Es como la pantalla retoma. */
export async function activeImport(
  businessId: string,
): Promise<ImportRow | null> {
  const [row] = await getDb()
    .select()
    .from(catalogImports)
    .where(
      and(
        eq(catalogImports.businessId, businessId),
        inArray(catalogImports.status, [...OPEN]),
      ),
    )
    .orderBy(asc(catalogImports.createdAt))
    .limit(1);
  return row ?? null;
}

/** Un import del negocio por id. **Lo ajeno devuelve el mismo 404 que lo inexistente** (§9). */
export async function requireImport(
  businessId: string,
  importId: string,
): Promise<ImportRow> {
  if (!/^[0-9a-f-]{36}$/i.test(importId)) throw notFound();
  const [row] = await getDb()
    .select()
    .from(catalogImports)
    .where(
      and(
        eq(catalogImports.id, importId),
        eq(catalogImports.businessId, businessId),
      ),
    )
    .limit(1);
  if (!row) throw notFound();
  return row;
}

/**
 * §6 — `POST /api/catalog/imports`: reserva y URLs firmadas.
 *
 * **Se APROPIA de un import abandonado en `pending_upload`** (ADR 0082 §13.2): la pantalla
 * real cierra el modal sin llamar a `DELETE`, y sin esto el merchant queda trabado hasta que
 * el import venza. En `queued`/`analyzing`/`ready` responde **409**: hay trabajo pago en
 * vuelo, y **descartar un `ready` quema el analisis del dia**.
 */
export async function createImport(
  business: { id: string },
  userId: string,
  value: unknown,
): Promise<{ import: CatalogImportDTO; uploads: UploadTicket[] }> {
  const reserved = validateImportFiles(value);
  const open = await activeImport(business.id);
  if (open && open.status !== "pending_upload") {
    throw new CatalogImportError(
      409,
      "catalog_import_in_progress",
      "Ya hay una importación en curso.",
    );
  }
  const ctx = await entitlementContextOf(business.id);
  await assertQuota(business.id, "catalog.imports.analyses", ctx);
  await assertQuota(business.id, "catalog.imports.attempts", ctx);
  if (open) await takeOverAbandoned(open);

  const importId = randomUUID();
  const expiresAt = new Date(Date.now() + IMPORT_TTL_MS);
  let row: ImportRow;
  try {
    [row] = await getDb()
      .insert(catalogImports)
      .values({
        id: importId,
        businessId: business.id,
        createdByUserId: userId,
        status: "pending_upload",
        sourceKind: reserved.sourceKind,
        fileCount: reserved.files.length,
        expiresAt,
      })
      .returning();
  } catch (error) {
    // El indice unico PARCIAL de «un import abierto por negocio» es lo que resuelve la
    // carrera de dos pestañas: el segundo insert choca y contesta el mismo 409 que el
    // camino leido.
    if (isUniqueViolation(error)) {
      throw new CatalogImportError(
        409,
        "catalog_import_in_progress",
        "Ya hay una importación en curso.",
      );
    }
    throw error;
  }

  const fileRows = reserved.files.map((file, index) => {
    const fileId = randomUUID();
    return {
      id: fileId,
      importId,
      businessId: business.id,
      position: index,
      originalName: file.name,
      declaredContentType: file.contentType,
      byteSize: file.byteSize,
      objectKey: catalogImportObjectKey(business.id, importId, fileId),
    };
  });
  await getDb().insert(catalogImportFiles).values(fileRows);
  const uploads = await signTickets(fileRows, reserved.sourceKind);
  return { import: toImportDTO(row), uploads };
}

/** Cierra el abandonado en `cancelled` y borra sus originales. Nunca toca catalogo. */
async function takeOverAbandoned(open: ImportRow): Promise<void> {
  await getDb()
    .update(catalogImports)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      ...touch(),
    })
    .where(
      and(
        eq(catalogImports.id, open.id),
        eq(catalogImports.status, "pending_upload"),
      ),
    );
  await purgeImportObjects(open.id, open.businessId).catch(() => undefined);
}

/**
 * §7 / contrato §7 — `DELETE`: cancela. **Nunca toca catalogo.**
 *
 * En `analyzing` escribe `cancel_requested_at` y **deja el estado**: el callback o el
 * reconciliador, al llegar, descartan el resultado y cierran en `cancelled`. Repetirlo da
 * 200; `accepted` da 409.
 */
export async function cancelImport(
  business: { id: string },
  importId: string,
): Promise<{ import: CatalogImportDTO }> {
  const row = await requireImport(business.id, importId);
  if (row.status === "accepted") {
    throw new CatalogImportError(
      409,
      "catalog_import_already_accepted",
      "Esa importación ya fue aceptada.",
    );
  }
  if (row.status === "analyzing") {
    const [updated] = await getDb()
      .update(catalogImports)
      .set({
        cancelRequestedAt: row.cancelRequestedAt ?? new Date(),
        ...touch(),
      })
      .where(eq(catalogImports.id, row.id))
      .returning();
    return { import: toImportDTO(updated ?? row) };
  }
  if (
    row.status === "cancelled" ||
    row.status === "failed" ||
    row.status === "expired"
  ) {
    return { import: toImportDTO(row) };
  }
  const [updated] = await getDb()
    .update(catalogImports)
    .set({ status: "cancelled", cancelledAt: new Date(), ...touch() })
    .where(
      and(
        eq(catalogImports.id, row.id),
        inArray(catalogImports.status, ["pending_upload", "queued", "ready"]),
      ),
    )
    .returning();
  await enqueueImportCleanup(row.id, row.businessId).catch(() => undefined);
  await purgeImportObjects(row.id, row.businessId).catch(() => undefined);
  return { import: toImportDTO(updated ?? row) };
}
