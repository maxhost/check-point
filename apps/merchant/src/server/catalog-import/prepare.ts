import { and, asc, eq, isNull, or, lte, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { catalogImportFiles, catalogImports } from "@mi-pasaporte/db/schema";
import {
  getPrivateObject,
  readObjectAtMost,
} from "@mi-pasaporte/domain/server/r2";
import { normalizeImageToJpeg } from "@mi-pasaporte/domain/server/assets/image";
import { type CatalogExtractionPage } from "./types";
import { countPdfPages } from "./pdf-pages";
import { MAX_IMAGE_BYTES, MAX_PDF_BYTES, MAX_PDF_PAGES } from "./validation";
import { aiProviderFromEnv } from "../ai/config";
import { AiUnavailableError } from "../ai/errors";
import { closeAiJob, submitAiTask } from "../ai/service";
import type { AiInput, AiProvider } from "../ai/task";
import { MENU_EXTRACTION_TASK } from "./menu-task";
import { touch, withinAttemptBudget } from "./quota";
import { failImport, finishAnalysis } from "./finish";
import { purgeImportObjects } from "./cleanup";
import type { ImportRow } from "./core";

/** Cuanto dura el lease de un intento. Pasado eso, el reconciliador lo vuelve a tomar: es lo
 * que impide que `analyzing` sea un pozo cuando el `after()` muere (§1). */
export const ANALYZE_LEASE_MS = 5 * 60 * 1000;
/** Intentos antes de cerrar en `failed` (§7). */
export const MAX_ATTEMPTS = 3;

export type AnalysisOutcome =
  "skipped" | "cancelled" | "submitted" | "ready" | "failed";

/**
 * Spec 0090 §1/§6 — EL TRABAJO LARGO. Corre en `after()` y tambien lo llama el
 * reconciliador; por eso **reclama la fila con un lease** en vez de asumir que es el unico.
 *
 * `update … where status='queued' and (lease_until is null or lease_until <= now())` es lo
 * que hace que **dos reconciliadores concurrentes reclamen una sola vez**: el segundo no
 * encuentra fila y devuelve `skipped`.
 */
export async function runAnalysis(
  importId: string,
  deps: { provider?: AiProvider } = {},
): Promise<AnalysisOutcome> {
  const [row] = await getDb()
    .update(catalogImports)
    .set({
      leaseUntil: new Date(Date.now() + ANALYZE_LEASE_MS),
      ...touch(),
    })
    .where(
      and(
        eq(catalogImports.id, importId),
        eq(catalogImports.status, "queued"),
        or(
          isNull(catalogImports.leaseUntil),
          lte(catalogImports.leaseUntil, new Date()),
        ),
      ),
    )
    .returning();
  if (!row) return "skipped";
  if (row.cancelRequestedAt) return closeCancelled(row);

  let provider: AiProvider;
  try {
    provider = deps.provider ?? aiProviderFromEnv();
  } catch {
    // §4: sin proveedor o clave valida el import termina `failed` con `provider_unavailable`
    // ANTES de leer R2 y de sumar `attemptCount`. **No hay fallback silencioso** (spec 0224: sin
    // `AI_PROVIDER` tampoco hay falso).
    await failImport(
      importId,
      "provider_unavailable",
      "El servicio de análisis no está configurado.",
    );
    return "failed";
  }

  try {
    const pages = await preparePages(row);
    // ADR 0083: nada anterior a la frontera del proveedor consume intentos. El POST de
    // reserva ya hizo este check para rechazar temprano; se repite aca como defensa para
    // workers internos y cambios de ventana/configuracion.
    if (!(await withinAttemptBudget(row.businessId))) {
      await failImport(
        importId,
        "catalog_import_rate_limited",
        "Se agotaron los intentos de análisis por hoy.",
      );
      return "failed";
    }
    if (row.attemptCount >= MAX_ATTEMPTS) {
      await failImport(
        importId,
        "provider_unavailable",
        "Demasiados intentos.",
      );
      return "failed";
    }
    // Fusible tecnico del MISMO import. Se incrementa inmediatamente antes de cruzar la
    // frontera externa, no al reclamar el trabajo ni durante la preparacion.
    await getDb()
      .update(catalogImports)
      .set({
        attemptCount: sql`${catalogImports.attemptCount} + 1`,
        ...touch(),
      })
      .where(eq(catalogImports.id, importId));
    // Spec 0224: el servicio registra el submit ACEPTADO en `core.ai_request` (es lo que cuenta el
    // cupo `attempts`); un rechazo no deja fila.
    const submitted = await submitAiTask(
      MENU_EXTRACTION_TASK,
      aiInputOf(pages),
      {
        businessId: row.businessId,
        userId: row.createdByUserId,
        subjectId: importId,
      },
      { provider },
    );
    if (submitted.kind === "deferred") {
      const [moved] = await getDb()
        .update(catalogImports)
        .set({
          status: "analyzing",
          providerJobId: submitted.jobId,
          leaseUntil: new Date(Date.now() + ANALYZE_LEASE_MS),
          ...touch(),
        })
        .where(
          and(
            eq(catalogImports.id, importId),
            eq(catalogImports.status, "queued"),
          ),
        )
        .returning({ id: catalogImports.id });
      // Se cancelo entre el `start` y este `update`: el trabajo termino sin resultado, y su fila
      // de uso no puede quedar `pending` (spec 0224 §6).
      if (!moved) await closeAiJob(MENU_EXTRACTION_TASK, importId, "cancelled");
      return "submitted";
    }
    await finishAnalysis(importId, submitted.result);
    return "ready";
  } catch (error) {
    // Observabilidad production-safe: el detalle del proveedor ya lo logueo el servicio
    // (`ai_request_failed`); aca solo el motivo acotado.
    if (!(error instanceof PrepareError)) {
      console.warn("catalog_import_provider_start_failed", {
        importId,
        businessId: row.businessId,
        reason:
          error instanceof AiUnavailableError ? error.reason : "provider_error",
      });
    }
    const { code, detail } = classify(error);
    await failImport(importId, code, detail);
    return "failed";
  }
}

/** Las paginas preparadas como entrada del servicio: imagenes ya JPEG o el PDF. */
function aiInputOf(pages: CatalogExtractionPage[]): AiInput {
  return {
    images: pages
      .filter((page) => page.contentType !== "application/pdf")
      .map((page) => ({ kind: "image" as const, jpeg: page.bytes })),
    files: pages
      .filter((page) => page.contentType === "application/pdf")
      .map((page) => ({
        kind: "pdf" as const,
        bytes: page.bytes,
        // No se envia el nombre original del merchant: no aporta nada al analisis.
        filename: `menu-${page.position + 1}.pdf`,
      })),
  };
}

/** El import cancelado durante `analyzing`/`queued`: se cierra y se limpian los originales. */
async function closeCancelled(row: ImportRow): Promise<"cancelled"> {
  await getDb()
    .update(catalogImports)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      leaseUntil: null,
      ...touch(),
    })
    .where(eq(catalogImports.id, row.id));
  await closeAiJob(MENU_EXTRACTION_TASK, row.id, "cancelled");
  await purgeImportObjects(row.id, row.businessId).catch(() => undefined);
  return "cancelled";
}

/**
 * §2 — LA PREPARACION. Imagenes: orientacion, JPEG, lado mayor 2048 px,
 * **SECUENCIALMENTE, nunca `Promise.all`**: con `MAX_INPUT_PIXELS_FALLBACK` (50 MP) diez
 * decodificaciones en paralelo son ~2 GB de pixeles. PDF: se cuenta con `node:zlib` y se
 * manda tal cual.
 */
export async function preparePages(
  row: ImportRow,
): Promise<CatalogExtractionPage[]> {
  const files = await getDb()
    .select()
    .from(catalogImportFiles)
    .where(eq(catalogImportFiles.importId, row.id))
    .orderBy(asc(catalogImportFiles.position));
  const pages: CatalogExtractionPage[] = [];
  const maxBytes = row.sourceKind === "pdf" ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
  for (const file of files) {
    const object = await getPrivateObject(file.objectKey);
    const body = object.Body as Parameters<typeof readObjectAtMost>[0];
    const bytes = await readObjectAtMost(body, maxBytes);
    if (row.sourceKind === "pdf") {
      const counted = countPdfPages(bytes);
      if (!counted.ok) {
        throw new PrepareError(
          counted.reason === "encrypted"
            ? "catalog_pdf_encrypted"
            : "unsupported_catalog_file",
          counted.reason === "encrypted"
            ? "El PDF está protegido."
            : "No pudimos leer ese PDF.",
        );
      }
      if (counted.pages > MAX_PDF_PAGES) {
        throw new PrepareError(
          "catalog_page_limit",
          `El PDF tiene más de ${MAX_PDF_PAGES} páginas.`,
        );
      }
      await getDb()
        .update(catalogImports)
        .set({ pageCount: counted.pages, ...touch() })
        .where(eq(catalogImports.id, row.id));
      pages.push({
        bytes,
        contentType: "application/pdf",
        position: file.position,
      });
    } else {
      const jpeg = await normalizeImageToJpeg(bytes);
      pages.push({
        bytes: jpeg,
        contentType: "image/jpeg",
        position: file.position,
      });
    }
    await getDb()
      .update(catalogImportFiles)
      .set({ status: "validated" })
      .where(eq(catalogImportFiles.id, file.id));
  }
  if (row.sourceKind !== "pdf") {
    await getDb()
      .update(catalogImports)
      .set({ pageCount: pages.length, ...touch() })
      .where(eq(catalogImports.id, row.id));
  }
  return pages;
}

/** Un fallo de preparacion con su `code` del contrato ya decidido. */
export class PrepareError extends Error {
  constructor(
    readonly code: string,
    readonly detail: string,
  ) {
    super(code);
    this.name = "PrepareError";
  }
}

/** **El detalle se SANEA**: nunca el prompt, el archivo ni un secreto (§3). Un error del
 * proveedor entra como su codigo, no como su cuerpo. */
function classify(error: unknown): { code: string; detail: string } {
  if (error instanceof PrepareError) {
    return { code: error.code, detail: error.detail };
  }
  return {
    code: "provider_unavailable",
    detail: "No pudimos analizar el menú. Prueba de nuevo.",
  };
}
