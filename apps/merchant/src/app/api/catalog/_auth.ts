import { NextResponse } from "next/server";
import {
  apiOwnerFailureResponse,
  requireApiOwner,
} from "../../../server/api-owner";
import { requireApiPermission } from "../../../server/api-permission";
import { CatalogError, type OwnerBusiness } from "../../../server/catalog";

/**
 * Spec 0086 §3 — EL GUARD DE `/api/catalog/*`: el permiso `catalog`.
 *
 * **Desde la spec 0072 delegaba en `requireApiOwner`**; desde la 0086 delega en
 * `requireApiPermission`, que conserva los mismos pasos 1, 4 y 5 y suma los dos del medio
 * (membresia activa → alcance). Lo que ese cambio trae de la 0072 sigue entero: el filtro
 * `memberships.status='active'` que el resolvedor ad hoc del dominio no tenia, el gate de
 * email y el eje `core.business.status`.
 *
 * **CAMBIO DE CONTRATO:** esta superficie deja de contestar `not_owner`. Un caller sin
 * membresia recibe `not_member`; un integrante sin el toggle, `missing_permission`
 * (`0086-contratos-de-api.md` §7).
 *
 * `currencyCode` sale del mismo `innerJoin(businesses)` que ya hacia `ownerContext`, asi que
 * la forma `OwnerBusiness` que el catalogo consume no cambia.
 */
export async function requireOwner(
  request: Request,
): Promise<{ business: OwnerBusiness } | { response: NextResponse }> {
  const auth = await requireApiPermission(request, "catalog", {
    missingPermission: "No tienes permiso para gestionar el catálogo.",
    emailNotVerified: "Verificá tu email para gestionar el catálogo.",
  });
  if ("failure" in auth) {
    return { response: apiOwnerFailureResponse(auth.failure) };
  }
  return {
    business: {
      id: auth.business.id,
      currencyCode: auth.business.currencyCode,
    },
  };
}

/**
 * **EL BORRADO DURO SIGUE SIENDO DEL OWNER, y es la mitad del valor de esta spec**
 * (ADR 0079 §2 y §9, contrato 0086 §2.1). `DELETE /api/catalog/product/:id` y
 * `…/category/:id` no tienen vuelta atras —`schema/catalog.ts` no tiene `archived_at` ni
 * `deleted_at`— asi que **ningun toggle los abre**: un staff con `catalog` carga y corrige
 * productos, y no puede borrarlos.
 *
 * Conserva `requireApiOwner` y su `403 not_owner`, que ahi **sigue siendo cierto**. El dia
 * que exista el archivado (spec C) esta funcion es lo que se revisa, no el guard de arriba.
 */
export async function requireCatalogOwner(
  request: Request,
): Promise<{ business: OwnerBusiness } | { response: NextResponse }> {
  const auth = await requireApiOwner(request, {
    notOwner: "Solo el owner puede borrar del catálogo.",
    emailNotVerified: "Verificá tu email para gestionar el catálogo.",
  });
  if ("failure" in auth) {
    return { response: apiOwnerFailureResponse(auth.failure) };
  }
  return {
    business: {
      id: auth.business.id,
      currencyCode: auth.business.currencyCode,
    },
  };
}

/**
 * ADR 0086 — el cuerpo de error del dominio. **`code` sale SOLO cuando el `CatalogError` lo
 * trae**: el dominio catalogo no tiene lista cerrada de codigos, asi que todo lo que hoy no
 * lo pasa tiene que seguir respondiendo `{ error }` tal cual. Lo consume la pantalla para
 * distinguir el 409 de la importacion en curso de cualquier otro conflicto sin leer el texto.
 */
export function catalogError(error: unknown, fallback: string): NextResponse {
  if (error instanceof CatalogError) {
    return NextResponse.json(
      error.code
        ? { error: error.message, code: error.code }
        : { error: error.message },
      { status: error.status },
    );
  }
  return NextResponse.json({ error: fallback }, { status: 503 });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new CatalogError(400, "El cuerpo de la solicitud no es válido.");
  }
}
