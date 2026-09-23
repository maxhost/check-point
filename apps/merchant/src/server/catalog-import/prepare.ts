import { and, asc, eq, isNull, or, lte, sql } from "drizzle-orm";
import { getDb } from "../db";
import { catalogImportFiles, catalogImports } from "../schema";
import { getPrivateObject, readObjectAtMost } from "../r2";
import { normalizeImageToJpeg } from "../assets/image";
import {
  type CatalogExtractionPage,
  type CatalogExtractionProvider,
} from "./types";
import { countPdfPages } from "./pdf-pages";
import { MAX_IMAGE_BYTES, MAX_PDF_BYTES, MAX_PDF_PAGES } from "./validation";
import {
  catalogExtractionProviderFromEnv,
  promptVersionFromEnv,
  CATALOG_EXTRACTION_SCHEMA_VERSION,
} from "./providers/provider";
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
  | "skipped"
  | "cancelled"
  | "submitted"
  | "ready"
  | "failed";

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
  deps: { provider?: CatalogExtractionProvider } = {},
): Promise<AnalysisOutcome> {
  const started = Date.now();
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

  let provider: CatalogExtractionProvider;
  try {
    provider = deps.provider ?? catalogExtractionProviderFromEnv();
  } catch {
    // §4: sin proveedor o clave valida el import termina `failed` con `provider_unavailable`
    // y el resto del catalogo sigue funcionando. **No hay fallback silencioso.**
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
    const result = await provider.start({
      importId,
      sourceKind: row.sourceKind === "pdf" ? "pdf" : "images",
      pages,
    });
    await getDb()
      .update(catalogImports)
      .set({
        provider: provider.id,
        model: provider.model,
        promptVersion: promptVersionFromEnv(),
        schemaVersion: CATALOG_EXTRACTION_SCHEMA_VERSION,
        ...touch(),
      })
      .where(eq(catalogImports.id, importId));
    if (result.kind === "deferred") {
      await getDb()
        .update(catalogImports)
        .set({
          status: "analyzing",
          providerJobId: result.jobId,
          leaseUntil: new Date(Date.now() + ANALYZE_LEASE_MS),
          ...touch(),
        })
        .where(
          and(
            eq(catalogImports.id, importId),
            eq(catalogImports.status, "queued"),
          ),
        );
      return "submitted";
    }
    await finishAnalysis(importId, result.extraction, Date.now() - started);
    return "ready";
  } catch (error) {
    // Observabilidad production-safe: el adaptador ya descarta el body del proveedor. Se
    // conserva solo una clasificacion acotada para distinguir auth/rate-limit/red sin
    // filtrar prompt, documento, respuesta cruda ni secretos.
    if (!(error instanceof PrepareError)) {
      console.warn("catalog_import_provider_start_failed", {
        importId,
        businessId: row.businessId,
        provider: provider.id,
        model: provider.model,
        reason: safeProviderFailure(error),
      });
    }
    const { code, detail } = classify(error);
    await failImport(importId, code, detail);
    return "failed";
  }
}

function safeProviderFailure(error: unknown): string {
  if (!(error instanceof Error)) return "unknown";
  if (/^openai_http_\d{3}$/.test(error.message)) return error.message;
  if (error.message === "openai_no_job_id") return error.message;
  if (error instanceof PrepareError) return error.code;
  return error.name === "TypeError" ? "network_error" : "provider_error";
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
    detail: "No pudimos analizar el menú. Probá de nuevo.",
  };
}
