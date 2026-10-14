import { and, count, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { aiRequests } from "@mi-pasaporte/db/schema";
import type { AiInput, AiMode, AiUsage } from "./task";

/**
 * Spec 0224 §7 — EL REGISTRO `core.ai_request`. Solo lo escribe el servicio (`service.ts`). Nunca el
 * texto, la imagen, el PDF ni la salida: solo cuanto entro y cuanto salio.
 */

export type AiRequestRow = {
  businessId: string;
  userId: string | null;
  taskId: string;
  taskVersion: string;
  mode: AiMode;
  provider: string;
  model: string | null;
  status: "pending" | "ok" | "failed";
  failureCode?: string | null;
  input: AiInput;
  outputItems?: number | null;
  usage?: AiUsage;
  durationMs?: number | null;
  providerRequestId?: string | null;
  subjectId?: string | null;
};

/** Inserta una fila. Con `subjectId`, `on conflict (task, subject_id) do nothing` (un submit
 * aceptado por trabajo) y devuelve el id de la fila que ya estaba. */
export async function insertAiRequest(row: AiRequestRow): Promise<string> {
  const db = getDb();
  const finished = row.status !== "pending";
  const [inserted] = await db
    .insert(aiRequests)
    .values({
      businessId: row.businessId,
      createdByUserId: row.userId,
      task: row.taskId,
      taskVersion: row.taskVersion,
      mode: row.mode,
      provider: row.provider,
      model: row.model,
      status: row.status,
      failureCode: row.status === "failed" ? safeCode(row.failureCode) : null,
      inputChars: row.input.text?.length ?? 0,
      inputImages: row.input.images?.length ?? 0,
      inputFiles: row.input.files?.length ?? 0,
      outputItems: row.outputItems ?? null,
      inputTokens: row.usage?.inputTokens ?? null,
      outputTokens: row.usage?.outputTokens ?? null,
      durationMs: row.durationMs ?? null,
      providerRequestId: row.providerRequestId ?? null,
      subjectId: row.subjectId ?? null,
      finishedAt: finished ? sql`now()` : null,
    })
    .onConflictDoNothing({
      target: [aiRequests.task, aiRequests.subjectId],
      where: sql`subject_id is not null`,
    })
    .returning({ id: aiRequests.id });
  if (inserted) return inserted.id;
  return (await requestIdOf(row.taskId, row.subjectId ?? "")) ?? "";
}

/** El id de la fila del trabajo `subjectId`, o null. */
export async function requestIdOf(
  taskId: string,
  subjectId: string,
): Promise<string | null> {
  const [row] = await getDb()
    .select({ id: aiRequests.id })
    .from(aiRequests)
    .where(
      and(eq(aiRequests.task, taskId), eq(aiRequests.subjectId, subjectId)),
    )
    .limit(1);
  return row?.id ?? null;
}

/**
 * Cierra la fila `pending` del trabajo. `where status = 'pending'` es lo que la vuelve IDEMPOTENTE:
 * un webhook duplicado, o un cierre despues de otro, no reescribe nada. `duration_ms` sale de la
 * fila (desde el submit aceptado). Devuelve el id si cerro algo.
 */
export async function closeAiRequest(
  taskId: string,
  subjectId: string,
  close:
    | { status: "failed"; failureCode: string }
    | {
        status: "ok";
        outputItems: number;
        usage: AiUsage;
        providerRequestId: string | null;
      },
): Promise<string | null> {
  const [row] = await getDb()
    .update(aiRequests)
    .set({
      status: close.status,
      finishedAt: sql`now()`,
      durationMs: sql`greatest(0, round(extract(epoch from (now() - created_at)) * 1000))::int`,
      ...(close.status === "failed"
        ? { failureCode: safeCode(close.failureCode) }
        : {
            outputItems: close.outputItems,
            inputTokens: close.usage.inputTokens,
            outputTokens: close.usage.outputTokens,
            providerRequestId: close.providerRequestId,
          }),
    })
    .where(
      and(
        eq(aiRequests.task, taskId),
        eq(aiRequests.subjectId, subjectId),
        eq(aiRequests.status, "pending"),
      ),
    )
    .returning({ id: aiRequests.id });
  return row?.id ?? null;
}

/** Spec 0224 §2 / ADR 0143 §5 — EL ENGANCHE DE LIMITES: filas de esa tarea y negocio desde `since`. */
export async function countAiRequests(
  businessId: string,
  taskId: string,
  since: Date,
): Promise<number> {
  const [row] = await getDb()
    .select({ total: count() })
    .from(aiRequests)
    .where(
      and(
        eq(aiRequests.businessId, businessId),
        eq(aiRequests.task, taskId),
        gte(aiRequests.createdAt, since),
      ),
    );
  // `count()` ya viene mapeado; el `Number()` es el cinturon contra el bigint-como-string.
  return Number(row?.total ?? 0);
}

/** Un codigo de falla saneado (≤120, sin espacios raros). */
function safeCode(code: string | null | undefined): string {
  const clean = (code ?? "").replace(/[^A-Za-z0-9_.:-]/g, "_").slice(0, 120);
  return clean || "provider_error";
}
