import {
  check,
  index,
  integer,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { core } from "./_schemas";
import { businesses } from "./business";

/**
 * Spec 0224 / ADR 0143 §4 — EL REGISTRO UNICO DE USO DE LA IA: una fila por pedido al proveedor, de
 * cualquier funcion (menu, dictado, foto). Lo escribe solo el servicio `apps/merchant/src/server/ai/`.
 *
 * NUNCA guarda el texto, la imagen, el PDF ni la salida del modelo: solo cuanto entro y cuanto
 * salio. `task` es `<area>.<nombre>` y la base valida su FORMA, nunca una lista (ADR 0143 §2): sumar
 * una tarea no migra el core. Ninguna FK a un esquema de modulo; `subject_id` (el trabajo de la
 * funcion, hoy el `catalog_import.id`) va sin FK a proposito.
 */
export const aiRequests = core.table(
  "ai_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id"),
    task: text("task").notNull(),
    taskVersion: text("task_version").notNull(),
    mode: text("mode").notNull(),
    /** `openai` | `fake` | `unconfigured` (un sincronico sin configuracion). */
    provider: text("provider").notNull(),
    model: text("model"),
    status: text("status").notNull(),
    failureCode: text("failure_code"),
    inputChars: integer("input_chars").notNull().default(0),
    inputImages: integer("input_images").notNull().default(0),
    inputFiles: integer("input_files").notNull().default(0),
    /** Cuantos items devolvio el modelo (antes de normalizar). */
    outputItems: integer("output_items"),
    /** `integer` y no `bigint`: el driver devuelve bigint como STRING. */
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    durationMs: integer("duration_ms"),
    /** Diagnostico. Nunca a un DTO. */
    providerRequestId: text("provider_request_id"),
    subjectId: uuid("subject_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "core_ai_request_task_check",
      sql`${table.task} ~ '^[a-z][a-z0-9_]*\\.[a-z][a-z0-9_]*$'`,
    ),
    check(
      "core_ai_request_mode_check",
      sql`${table.mode} in ('sync', 'background')`,
    ),
    check(
      "core_ai_request_status_check",
      sql`${table.status} in ('pending', 'ok', 'failed')`,
    ),
    check(
      "core_ai_request_pending_background_check",
      sql`${table.status} <> 'pending' or ${table.mode} = 'background'`,
    ),
    check(
      "core_ai_request_failure_code_check",
      sql`(${table.status} = 'failed') = (${table.failureCode} is not null)`,
    ),
    check(
      "core_ai_request_finished_check",
      sql`(${table.status} = 'pending') = (${table.finishedAt} is null)`,
    ),
    check(
      "core_ai_request_counts_check",
      sql`${table.inputChars} >= 0 and ${table.inputImages} >= 0 and ${table.inputFiles} >= 0`,
    ),
    check(
      "core_ai_request_metrics_check",
      sql`(${table.outputItems} is null or ${table.outputItems} >= 0) and (${table.inputTokens} is null or ${table.inputTokens} >= 0) and (${table.outputTokens} is null or ${table.outputTokens} >= 0) and (${table.durationMs} is null or ${table.durationMs} >= 0)`,
    ),
    index("core_ai_request_business_task_created_idx").on(
      table.businessId,
      table.task,
      table.createdAt,
    ),
    uniqueIndex("core_ai_request_task_subject_unique")
      .on(table.task, table.subjectId)
      .where(sql`${table.subjectId} is not null`),
  ],
);
