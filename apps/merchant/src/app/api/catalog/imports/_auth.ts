import { NextResponse } from "next/server";
import {
  apiOwnerFailureResponse,
  type ApiOwnerBusiness,
} from "../../../../server/api-owner";
import { requireApiPermission } from "../../../../server/api-permission";
import { CatalogImportError } from "../../../../server/catalog-import";

/**
 * Spec 0090 §6 — EL GUARD Y EL RESPONDER DE `/api/catalog/imports/*`.
 *
 * El guard es **el mismo** que el del resto de `/api/catalog/*`: `requireApiPermission(…,
 * "catalog")`, owner siempre e integrante con el toggle, con la escalera completa del
 * contrato 0086 (401 `unauthorized` → 403 `not_member` → `missing_permission` →
 * `email_not_verified` solo al owner → `business_suspended`/`business_closed`).
 *
 * **Lo que NO se reusa es `catalogError`** (`api/catalog/_auth.ts:71-77`): devuelve `{error}`
 * pelado y esta feature necesita `code` estable en cada respuesta. Nace este responder y las
 * **seis rutas que usan el viejo no se tocan**.
 */
export type ImportCaller = { business: ApiOwnerBusiness; userId: string };

export async function requireImportAccess(
  request: Request,
): Promise<ImportCaller | { response: NextResponse }> {
  const auth = await requireApiPermission(request, "catalog", {
    missingPermission: "No tienes permiso para gestionar el catálogo.",
    emailNotVerified: "Verificá tu email para gestionar el catálogo.",
  });
  if ("failure" in auth) {
    return { response: apiOwnerFailureResponse(auth.failure) };
  }
  return { business: auth.business, userId: auth.userId };
}

/**
 * `{ error, code }` — y solo en el 429, `retryAfterSeconds` en el cuerpo **y** el header
 * `Retry-After`: la pantalla no hardcodea el cupo, muestra lo que le devuelve el servidor.
 *
 * Lo que no es un `CatalogImportError` cae a **503 con un `code` generico**: un error de
 * infraestructura no puede escaparse con el stack ni con el detalle del proveedor.
 */
export function importError(error: unknown, fallback: string): NextResponse {
  if (error instanceof CatalogImportError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        ...(error.retryAfterSeconds === undefined
          ? {}
          : { retryAfterSeconds: error.retryAfterSeconds }),
      },
      {
        status: error.status,
        ...(error.retryAfterSeconds === undefined
          ? {}
          : {
              headers: { "retry-after": String(error.retryAfterSeconds) },
            }),
      },
    );
  }
  return NextResponse.json(
    { error: fallback, code: "catalog_import_unavailable" },
    { status: 503 },
  );
}

/** Un cuerpo ausente es `null` y **no** un error: `analyze`, `accept` y `DELETE` se llaman
 * sin cuerpo a proposito (ADR 0082 §13.1). */
export async function readOptionalJson(request: Request): Promise<unknown> {
  const text = await request.text().catch(() => "");
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new CatalogImportError(
      400,
      "invalid_import_files",
      "El cuerpo de la solicitud no es válido.",
    );
  }
}
