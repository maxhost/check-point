import { and, eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { businessModules } from "@mi-pasaporte/db/schema";
import { apiOwnerFailureResponse } from "../server/api-owner";
import { requireApiPermission } from "../server/api-permission";
import { ModuleError, moduleErrorResponse } from "./errors";
import type { NextResponse } from "next/server";
import type { ModuleRouteContext } from "./route-table";

/**
 * Spec 0210 / 0216 — ADR 0138 §6 y ADR 0139 §4 — EL GUARD DE LAS RUTAS DE UN MODULO.
 *
 * `requireModule` corta con 403 `module_disabled` si el negocio no tiene el modulo encendido (sin
 * fila = apagado). `requireModuleAccess` es la escalera entera que el despachador de
 * `/api/modules/<id>/…` aplica UNA vez antes del handler: la del permiso que pide la ruta (el del
 * modulo por defecto; `requireApiPermission`: sesion, membresia, permiso, email del owner,
 * `status`, cobro) y DESPUES el modulo, para que un integrante sin el permiso reciba
 * `missing_permission` sin enterarse de que modulos tiene el comercio.
 */
export async function requireModule(
  businessId: string,
  moduleId: string,
): Promise<void> {
  const [row] = await getDb()
    .select({ enabled: businessModules.enabled })
    .from(businessModules)
    .where(
      and(
        eq(businessModules.businessId, businessId),
        eq(businessModules.moduleId, moduleId),
      ),
    )
    .limit(1);
  if (row?.enabled !== true) {
    throw new ModuleError(
      403,
      "module_disabled",
      "Este módulo no está activado en tu negocio.",
    );
  }
}

export type ModuleAccess =
  | { business: ModuleRouteContext["business"]; userId: string }
  | { response: NextResponse };

export async function requireModuleAccess(
  request: Request,
  moduleId: string,
  permission: string,
): Promise<ModuleAccess> {
  const auth = await requireApiPermission(request, permission, {
    missingPermission: "No tienes permiso para usar este módulo.",
    emailNotVerified: "Verifica tu email para usar este módulo.",
  });
  if ("failure" in auth) {
    return { response: apiOwnerFailureResponse(auth.failure) };
  }
  try {
    await requireModule(auth.business.id, moduleId);
  } catch (error) {
    return {
      response: moduleErrorResponse(error, "No pudimos leer el módulo."),
    };
  }
  const { id, currencyCode, status } = auth.business;
  return { business: { id, currencyCode, status }, userId: auth.userId };
}
