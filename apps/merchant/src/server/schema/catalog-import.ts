import {
  check,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { core } from "./_schemas";
import { businesses } from "./business";

/**
 * Spec 0090 §1/§3 — LA IMPORTACION DE CATALOGO desde imagen o PDF.
 *
 * Las tres tablas son EFIMERAS: guardan una reserva de subida, el borrador que la IA
 * produjo y la cola de borrado de los originales. Ninguna es un activo del negocio — el
 * catalogo real sigue viviendo en `core.product` / `core.product_category`.
 */

/** Los ocho estados de §1. Es un conjunto cerrado y el `check` de la tabla lo repite. */
export const CATALOG_IMPORT_STATUSES = [
  "pending_upload",
  "queued",
  "analyzing",
  "ready",
  "accepted",
  "failed",
  "cancelled",
  "expired",
] as const;

export type CatalogImportStatus = (typeof CATALOG_IMPORT_STATUSES)[number];

/** Los terminales NUNCA retroceden (§1). El indice unico parcial de «un import abierto por
 * negocio» es exactamente su complemento. */
export const CATALOG_IMPORT_TERMINAL_STATUSES = [
  "accepted",
  "failed",
  "cancelled",
  "expired",
] as const satisfies readonly CatalogImportStatus[];

export const CATALOG_IMPORT_OPEN_STATUSES = [
  "pending_upload",
  "queued",
  "analyzing",
  "ready",
] as const satisfies readonly CatalogImportStatus[];

const statusList = CATALOG_IMPORT_STATUSES.map((s) => `'${s}'`).join(", ");
const openList = CATALOG_IMPORT_OPEN_STATUSES.map((s) => `'${s}'`).join(", ");

export const catalogImports = core.table(
  "catalog_import",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id").notNull(),
    status: text("status").notNull().default("pending_upload"),
    /** `pdf` | `images`. Nunca mezcla (§2). */
    sourceKind: text("source_kind").notNull(),
    fileCount: integer("file_count").notNull(),
    pageCount: integer("page_count"),
    draft: jsonb("draft"),
    draftVersion: integer("draft_version").notNull().default(0),
    provider: text("provider"),
    model: text("model"),
    promptVersion: text("prompt_version"),
    schemaVersion: text("schema_version"),
    /** El id diferido del proveedor: es la llave con la que entra el callback. */
    providerJobId: text("provider_job_id"),
    /** Diagnostico. NUNCA al DTO publico (§6). */
    providerRequestId: text("provider_request_id"),
    /** `integer` y no `bigint` a proposito: el driver devuelve bigint como STRING. */
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    durationMs: integer("duration_ms"),
    attemptCount: integer("attempt_count").notNull().default(0),
    /** Sin esto `analyzing` es un pozo: un `after()` muerto colgaria el negocio para
     * siempre. El reconciliador reclama por `status + lease_until`. */
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    cancelRequestedAt: timestamp("cancel_requested_at", { withTimezone: true }),
    /** El email sale UNA vez por import. */
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    acceptedSummary: jsonb("accepted_summary"),
    failureCode: text("failure_code"),
    /** Saneado: sin prompt, sin archivo y sin secreto. */
    failureDetail: text("failure_detail"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cleanedAt: timestamp("cleaned_at", { withTimezone: true }),
  },
  (table) => [
    check("catalog_import_status_check", sql.raw(`status in (${statusList})`)),
    check(
      "catalog_import_source_kind_check",
      sql.raw(`source_kind in ('pdf', 'images')`),
    ),
    check("catalog_import_file_count_check", sql`${table.fileCount} >= 1`),
    /** UN import no terminal por negocio (§1). Es parcial: `on conflict` contra el
     * necesita repetir este `where` (gotcha del repo). */
    uniqueIndex("core_catalog_import_open_unique")
      .on(table.businessId)
      .where(sql.raw(`status in (${openList})`)),
    /** La llave del callback: unico cuando no es null. */
    uniqueIndex("core_catalog_import_provider_job_unique")
      .on(table.providerJobId)
      .where(sql`${table.providerJobId} is not null`),
    index("core_catalog_import_status_lease_idx").on(
      table.status,
      table.leaseUntil,
    ),
    index("core_catalog_import_business_created_idx").on(
      table.businessId,
      table.createdAt,
    ),
  ],
);

export const catalogImportFiles = core.table(
  "catalog_import_file",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    importId: uuid("import_id")
      .notNull()
      .references(() => catalogImports.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    originalName: text("original_name").notNull(),
    declaredContentType: text("declared_content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    /** Interna de R2. JAMAS cruza al cliente (§9). */
    objectKey: text("object_key").notNull(),
    status: text("status").notNull().default("reserved"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "catalog_import_file_status_check",
      sql.raw(`status in ('reserved', 'uploaded', 'validated', 'deleted')`),
    ),
    uniqueIndex("core_catalog_import_file_position_unique").on(
      table.importId,
      table.position,
    ),
  ],
);

/**
 * Cola de borrado PROPIA (§3). No se reusa `core.product_asset_cleanup` porque su worker
 * borra por **prefijo de producto** (`deleteProductPrefix`), no una clave arbitraria: una
 * clave de import encolada ahi se intentaria borrar como `<clave>/product.webp`.
 */
export const catalogImportCleanups = core.table(
  "catalog_import_cleanup",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    notBefore: timestamp("not_before", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("core_catalog_import_cleanup_key_unique").on(table.objectKey),
    index("core_catalog_import_cleanup_not_before_idx").on(table.notBefore),
  ],
);
