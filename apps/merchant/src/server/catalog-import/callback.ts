import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { catalogImports } from "../schema";
import type { CatalogExtractionProvider } from "./types";
import { catalogExtractionProviderFromEnv } from "./providers/provider";
import { failImport, finishAnalysis } from "./finish";

/**
 * Spec 0090 §7 — EL CALLBACK DEL PROVEEDOR. Entrada **publica y no autenticada por sesion**.
 *
 * El orden es la regla, sin excepcion:
 *
 * 1. **se verifica la firma antes de cualquier otra cosa** (incluida la tolerancia de
 *    timestamp, que vive en `verifyWebhookSignature`);
 * 2. del payload se toma **solo el id** y se resuelve contra `provider_job_id`;
 * 3. **un id desconocido responde 200 y se ignora** — no filtra existencia ni deja al
 *    proveedor reintentando para siempre;
 * 4. **se va a buscar el resultado a la API del proveedor. El cuerpo del webhook no se
 *    cree.** Un webhook falsificado con un borrador adentro no tiene por donde entrar: el
 *    unico dato que sale del cuerpo es el id, y el contenido lo trae `poll`.
 */
export type CallbackOutcome =
  | { status: 401 }
  | {
      status: 200;
      result: "ignored" | "pending" | "ready" | "failed" | "noop";
    };

export async function handleProviderCallback(
  headers: Headers,
  rawBody: string,
  deps: { provider?: CatalogExtractionProvider } = {},
): Promise<CallbackOutcome> {
  let provider: CatalogExtractionProvider;
  try {
    provider = deps.provider ?? catalogExtractionProviderFromEnv();
  } catch {
    // Sin proveedor configurado no hay firma que verificar: **fail-closed**.
    return { status: 401 };
  }
  // PASO 1 — LA FIRMA. Antes de leer una sola fila.
  const verified = provider.verifyCallback?.(headers, rawBody) ?? null;
  if (!verified) return { status: 401 };

  // PASO 2/3 — el id contra nuestra tabla. Desconocido ⇒ 200 e ignorado.
  const [row] = await getDb()
    .select()
    .from(catalogImports)
    .where(eq(catalogImports.providerJobId, verified.jobId))
    .limit(1);
  if (!row) return { status: 200, result: "ignored" };
  if (row.status !== "analyzing" && row.status !== "queued") {
    // Ya salio de analisis (cancelado, vencido, fallado, o un webhook duplicado): no-op
    // idempotente.
    return { status: 200, result: "noop" };
  }

  // PASO 4 — EL RESULTADO SE TRAE DE LA API. **El cuerpo del webhook no se usa para nada
  // mas que el id.**
  if (!provider.poll) return { status: 200, result: "noop" };
  const result = await provider.poll(verified.jobId);
  if (result.status === "pending") return { status: 200, result: "pending" };
  if (result.status === "failed") {
    await failImport(row.id, "provider_unavailable", result.code.slice(0, 120));
    return { status: 200, result: "failed" };
  }
  const elapsed = Date.now() - row.createdAt.getTime();
  const outcome = await finishAnalysis(row.id, result.extraction, elapsed);
  return { status: 200, result: outcome === "ready" ? "ready" : "noop" };
}
