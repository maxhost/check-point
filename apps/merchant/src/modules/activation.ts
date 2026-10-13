import { eq, sql } from "drizzle-orm";
import { type DbTransaction, getDb, withDbTransaction } from "@mi-pasaporte/db";
import { businessModules, businesses } from "@mi-pasaporte/db/schema";
import { ModuleError, invalidBody } from "./errors";
import type { ModuleNavigationEntry, ModulePermission } from "./contract";
import {
  MODULES,
  type ModuleManifest,
  dependentsOf,
  moduleById,
} from "./registry";

/**
 * Spec 0210 / ADR 0138 §4 y §5 — ENCENDER Y APAGAR MODULOS. Sin fila = apagado; apagar no borra
 * datos. Dependencias sin cascada: encender con un requerido apagado → 409 `module_requires`;
 * apagar con un dependiente encendido → 409 `module_required_by`.
 *
 * El cambio se serializa POR NEGOCIO con un advisory lock de transaccion: sin el, «encender
 * recipes» y «apagar stock» en paralelo leen los dos el estado viejo y dejan recipes encendido
 * sobre stock apagado. No se bloquea la fila de `core.business` (su `FOR UPDATE` frenaria toda
 * escritura que la referencia por FK).
 */

export type ModuleDTO = {
  id: string;
  name: string;
  description: string;
  requires: string[];
  enabled: boolean;
  suggested: boolean;
  /** Spec 0216 / ADR 0139 §6: lo que el menu y el selector de permisos dibujan sin nombrar modulos. */
  navigation: ModuleNavigationEntry[];
  permissions: ModulePermission[];
};

function toDTO(
  manifest: ModuleManifest,
  enabled: ReadonlySet<string>,
  categoryGcid: string | null,
): ModuleDTO {
  return {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    requires: [...manifest.requires],
    enabled: enabled.has(manifest.id),
    suggested:
      categoryGcid !== null && manifest.suggestedFor.includes(categoryGcid),
    navigation: manifest.navigation.map((entry) => ({ ...entry })),
    permissions: manifest.permissions.map((permission) => ({ ...permission })),
  };
}

async function enabledSet(
  db: DbTransaction | ReturnType<typeof getDb>,
  businessId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ id: businessModules.moduleId, enabled: businessModules.enabled })
    .from(businessModules)
    .where(eq(businessModules.businessId, businessId));
  return new Set(rows.filter((r) => r.enabled).map((r) => r.id));
}

async function categoryOf(
  db: DbTransaction | ReturnType<typeof getDb>,
  businessId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ gcid: businesses.categoryGcid })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);
  return row?.gcid ?? null;
}

/** Los ids de los modulos ENCENDIDOS del negocio (spec 0216: el writer de permisos no deja
 * otorgar el permiso de un modulo apagado). */
export async function enabledModuleIds(
  businessId: string,
): Promise<Set<string>> {
  return enabledSet(getDb(), businessId);
}

/** `GET /api/modules` — todos los del registro, en su orden. */
export async function listModules(businessId: string): Promise<ModuleDTO[]> {
  const db = getDb();
  const [enabled, gcid] = await Promise.all([
    enabledSet(db, businessId),
    categoryOf(db, businessId),
  ]);
  return MODULES.map((m) => toDTO(m, enabled, gcid));
}

/** `PUT /api/modules/:moduleId` — `{ enabled: boolean }`, idempotente. */
export async function setModuleEnabled(
  businessId: string,
  rawModuleId: unknown,
  body: Record<string, unknown>,
): Promise<ModuleDTO> {
  const manifest = moduleById(rawModuleId);
  if (!manifest) {
    throw new ModuleError(404, "module_not_found", "Ese módulo no existe.");
  }
  if (typeof body.enabled !== "boolean") {
    throw invalidBody("`enabled` tiene que ser verdadero o falso.");
  }
  const want = body.enabled;
  return withDbTransaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`business_module:${businessId}`}, 0))`,
    );
    const enabled = await enabledSet(tx, businessId);
    if (want) {
      const missing = manifest.requires.filter((id) => !enabled.has(id));
      if (missing.length > 0) {
        throw new ModuleError(
          409,
          "module_requires",
          "Primero activa los módulos que este necesita.",
          { missing },
        );
      }
    } else {
      const dependents = dependentsOf(manifest.id)
        .map((m) => m.id)
        .filter((id) => enabled.has(id));
      if (dependents.length > 0) {
        throw new ModuleError(
          409,
          "module_required_by",
          "Primero desactiva los módulos que usan este.",
          { dependents },
        );
      }
    }
    await tx
      .insert(businessModules)
      .values({ businessId, moduleId: manifest.id, enabled: want })
      .onConflictDoUpdate({
        target: [businessModules.businessId, businessModules.moduleId],
        set: { enabled: want, updatedAt: new Date() },
      });
    if (want) enabled.add(manifest.id);
    else enabled.delete(manifest.id);
    return toDTO(manifest, enabled, await categoryOf(tx, businessId));
  });
}
