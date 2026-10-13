import { and, eq, sql } from "drizzle-orm";
import { type DbTransaction, getDb } from "@mi-pasaporte/db";
import { businessModules } from "@mi-pasaporte/db/schema";
import { apiOwnerFailureResponse, requireApiOwner } from "../server/api-owner";
import { requireApiPermission } from "../server/api-permission";
import { ModuleError, moduleErrorResponse } from "./errors";
import type { NextResponse } from "next/server";
import type { ModuleRouteContext } from "./route-table";

/**
 * Spec 0210 / 0216 / 0220 — ADR 0138 §6, ADR 0139 §4 y ADR 0141 §4 y §7 — EL GUARD DE LAS RUTAS
 * DE UN MODULO.
 *
 * `requireModule` corta con 403 `module_disabled` si el negocio no tiene el modulo encendido (sin
 * fila = apagado). `requireModuleAccess` es la escalera entera que el despachador de
 * `/api/modules/<id>/…` aplica UNA vez antes del handler: la del permiso que pide la ruta (el del
 * modulo por defecto; `requireApiPermission`: sesion, membresia, permiso, email del owner,
 * `status`, cobro, PIN temporal) y DESPUES el modulo, para que un integrante sin el permiso reciba
 * `missing_permission` sin enterarse de que modulos tiene el comercio. `requireModuleOwnerAccess`
 * es la de una ruta `owner: true`: `requireApiOwner` y despues el modulo.
 *
 * `lockModuleEnabled` es la otra mitad del toggle (`activation.ts`): el MISMO advisory lock por
 * negocio, en modo COMPARTIDO, para que «apagar» y «crear algo que impide apagar» no se crucen.
 */

const DISABLED_MESSAGE = "Este módulo no está activado en tu negocio.";

function moduleDisabled(): ModuleError {
  return new ModuleError(403, "module_disabled", DISABLED_MESSAGE);
}

/** La llave del advisory lock de transaccion que serializa los modulos de UN negocio. */
export function moduleLockKey(businessId: string): string {
  return `business_module:${businessId}`;
}

/** ¿El modulo esta encendido para el negocio? (sin fila = apagado). */
export async function isModuleEnabled(
  businessId: string,
  moduleId: string,
  db: DbTransaction | ReturnType<typeof getDb> = getDb(),
): Promise<boolean> {
  const [row] = await db
    .select({ enabled: businessModules.enabled })
    .from(businessModules)
    .where(
      and(
        eq(businessModules.businessId, businessId),
        eq(businessModules.moduleId, moduleId),
      ),
    )
    .limit(1);
  return row?.enabled === true;
}

export async function requireModule(
  businessId: string,
  moduleId: string,
): Promise<void> {
  if (!(await isModuleEnabled(businessId, moduleId))) throw moduleDisabled();
}

/**
 * ADR 0141 §4 — dentro de la transaccion que crea algo que impide apagar el modulo (una orden
 * abierta, una mesa ocupada): toma el lock del toggle en modo COMPARTIDO (dos aperturas no se
 * esperan entre si; el toggle, que lo toma EXCLUSIVO, espera a que terminen y ellas a el) y relee
 * el modulo. Apagado → 403 `module_disabled`.
 */
export async function lockModuleEnabled(
  tx: DbTransaction,
  businessId: string,
  moduleId: string,
): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock_shared(hashtextextended(${moduleLockKey(businessId)}, 0))`,
  );
  if (!(await isModuleEnabled(businessId, moduleId, tx))) {
    throw moduleDisabled();
  }
}

export type ModuleAccess =
  | { business: ModuleRouteContext["business"]; userId: string }
  | { response: NextResponse };

async function thenModule(
  business: ModuleRouteContext["business"],
  userId: string,
  moduleId: string,
): Promise<ModuleAccess> {
  try {
    await requireModule(business.id, moduleId);
  } catch (error) {
    return {
      response: moduleErrorResponse(error, "No pudimos leer el módulo."),
    };
  }
  const { id, currencyCode, status } = business;
  return { business: { id, currencyCode, status }, userId };
}

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
  return thenModule(auth.business, auth.userId, moduleId);
}

/** ADR 0141 §7 — una ruta `owner: true`: la escalera del owner y despues el modulo encendido. */
export async function requireModuleOwnerAccess(
  request: Request,
  moduleId: string,
): Promise<ModuleAccess> {
  const auth = await requireApiOwner(request);
  if ("failure" in auth) {
    return { response: apiOwnerFailureResponse(auth.failure) };
  }
  return thenModule(auth.business, auth.userId, moduleId);
}
