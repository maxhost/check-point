import { and, eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { businessModules } from "@mi-pasaporte/db/schema";
import { apiOwnerFailureResponse } from "../server/api-owner";
import { requireApiPermission } from "../server/api-permission";
import { ModuleError, moduleErrorResponse } from "./errors";
import type { NextResponse } from "next/server";

/**
 * Spec 0210 / ADR 0138 §6 y §7 — EL GUARD DE LAS RUTAS DE UN MODULO.
 *
 * `requireModule` corta con 403 `module_disabled` si el negocio no tiene el modulo encendido (sin
 * fila = apagado). `requireModuleAccess` es la escalera entera de una ruta de Stock o Recetas: la del
 * permiso `catalog` del core (`requireApiPermission`: sesion, membresia, permiso, email del owner,
 * `status`, cobro — ADR 0138 §7 y §8) y DESPUES el modulo, para que un staff sin `catalog` reciba
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
  { business: { id: string }; userId: string } | { response: NextResponse };

export async function requireModuleAccess(
  request: Request,
  moduleId: string,
): Promise<ModuleAccess> {
  const auth = await requireApiPermission(request, "catalog", {
    missingPermission: "No tienes permiso para gestionar el catálogo.",
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
  return { business: { id: auth.business.id }, userId: auth.userId };
}
