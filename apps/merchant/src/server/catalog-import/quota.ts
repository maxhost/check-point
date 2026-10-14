import { and, count, eq, gte, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { catalogImports, subscriptions } from "@mi-pasaporte/db/schema";
import {
  limitOf,
  retryAfterSeconds,
  windowOf,
  windowStart,
  type EntitlementContext,
  type LimitKey,
} from "@mi-pasaporte/domain/server/entitlements/index";
import { CatalogImportError } from "./types";
import { countAiRequests } from "../ai/service";
import { MENU_EXTRACTION_TASK } from "./menu-task";

/**
 * Spec 0090 §8 / ADR 0082 §10 — EL CUPO DE ANALISIS, centralizado en entitlements.
 *
 * No es cuota comercial (ADR 0082 §7 sigue en pie): es un control **operativo**, y hace
 * falta porque el guard compartido no tiene rate limit (`api-permission.ts` / `api-owner.ts`:
 * ni una linea), asi que `cancelar → crear → analizar` en loop es una llave de costo abierta.
 *
 * **Se cuentan FILAS de `catalog_import` en la ventana; no nace una tabla de contadores.** Y
 * las dos claves cuentan cosas distintas a proposito:
 *
 * - `catalog.imports.analyses` cuenta los que **llegaron a `ready`** (o mas alla: un
 *   `accepted` fue `ready` antes). **Un fallo no le cuesta el dia al merchant.**
 * - `catalog.imports.attempts` cuenta los submits que el proveedor **acepto**: las filas de
 *   `core.ai_request` de la tarea del menu (spec 0224; nacen solo cuando `start()` fue aceptado),
 *   tambien si despues fallaron. Configuracion, preparacion y submits rechazados no bloquean al
 *   merchant (ADR 0083).
 */
export type QuotaDecision = {
  key: LimitKey;
  limit: number;
  used: number;
  retryAfterSeconds: number;
};

/** La fila de `core.subscription` del negocio con el reloj, o `null` si no hay ninguna (la
 * capa de entitlements la trata como sin acceso: fail-closed). */
export async function entitlementContextOf(
  businessId: string,
  now: Date = new Date(),
): Promise<EntitlementContext | null> {
  const [row] = await getDb()
    .select({
      plan: subscriptions.plan,
      status: subscriptions.status,
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
      trialEndsAt: subscriptions.trialEndsAt,
    })
    .from(subscriptions)
    .where(eq(subscriptions.businessId, businessId))
    .limit(1);
  return row ? { ...row, now } : null;
}

/** Cuantas filas cuentan para esa clave en la ventana vigente. */
export async function usedInWindow(
  businessId: string,
  key: LimitKey,
  now: Date,
): Promise<number> {
  const window = windowOf(key);
  if (!window) return 0;
  const since = windowStart(window, now);
  if (key === "catalog.imports.attempts") {
    // El submit ACEPTADO, registrado por el servicio de IA. `attempt_count` es el fusible tecnico
    // del import y puede crecer antes de una caida/rechazo: no cuenta.
    return countAiRequests(businessId, MENU_EXTRACTION_TASK.id, since);
  }
  // `catalog.imports.analyses`: **`ready` o mas alla.** Un `accepted`, un `cancelled` despues de
  // revisar o un `expired` que llego a tener borrador ya gastaron el analisis; un `failed` no, y
  // por eso `draft is not null` es el discriminante y no el `status` actual.
  const [row] = await getDb()
    .select({ total: count() })
    .from(catalogImports)
    .where(
      and(
        eq(catalogImports.businessId, businessId),
        gte(catalogImports.createdAt, since),
        isNotNull(catalogImports.draft),
      ),
    );
  // `count()` de drizzle ya viene mapeado a `number`; el `Number()` es el cinturon contra
  // el bigint-como-string del driver si algun dia esto pasa a SQL crudo.
  return Number(row?.total ?? 0);
}

/**
 * Tira `429 catalog_import_rate_limited` si la clave esta agotada. El cuerpo lleva
 * `retryAfterSeconds` y la ruta agrega el header `Retry-After`: **la pantalla no hardcodea el
 * cupo**, muestra lo que le devuelve el servidor.
 */
export async function assertQuota(
  businessId: string,
  key: LimitKey,
  ctx: EntitlementContext | null,
  now: Date = new Date(),
): Promise<QuotaDecision> {
  const window = windowOf(key);
  const limit = limitOf(ctx, key);
  const used = await usedInWindow(businessId, key, now);
  const retryAfter = window ? retryAfterSeconds(window, now) : 60;
  if (used >= limit) {
    throw new CatalogImportError(
      429,
      "catalog_import_rate_limited",
      key === "catalog.imports.attempts"
        ? "Se agotaron los intentos de análisis por hoy. Prueba de nuevo mañana."
        : "Ya usaste tu análisis de menú de hoy. Prueba de nuevo mañana.",
      retryAfter,
    );
  }
  return { key, limit, used, retryAfterSeconds: retryAfter };
}

/**
 * §8 — **EL TECHO DE SUBMITS AL PROVEEDOR**, para el camino de fondo.
 *
 * No tira `429` como `assertQuota`: quien lo consulta es `runAnalysis`, donde **nadie esta
 * esperando un HTTP**. El llamador cierra el import en `failed`, que el contrato ya cubre.
 *
 * La fila en curso TODAVIA NO esta contada: su fila de `core.ai_request` nace al volver de `start()`.
 * Por eso se admite sólo cuando `used < limit`: el submit numero `limit` pasa y el siguiente
 * se rechaza. **El valor del tope sale del catalogo** (`entitlements/catalog.ts`), que hoy lo
 * tiene en valor de pruebas; este archivo no lo conoce y no debe conocerlo.
 */
export async function withinAttemptBudget(
  businessId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const ctx = await entitlementContextOf(businessId, now);
  const limit = limitOf(ctx, "catalog.imports.attempts");
  const used = await usedInWindow(businessId, "catalog.imports.attempts", now);
  return used < limit;
}

/** El `updated_at` de cualquier escritura del import. Se centraliza para que ninguna
 * transicion se olvide de moverlo. */
export const touch = () => ({ updatedAt: sql`now()` });
