import { and, count, eq, gte, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../db";
import { catalogImports, subscriptions } from "../schema";
import {
  limitOf,
  retryAfterSeconds,
  windowOf,
  windowStart,
  type EntitlementContext,
  type LimitKey,
} from "../entitlements";
import { CatalogImportError } from "./types";

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
 * - `catalog.imports.attempts` cuenta los submits que el proveedor **acepto** —`provider`
 *   deja de ser null solo despues de que `start()` responde—, tambien si despues fallaron.
 *   Configuracion, preparacion y submits rechazados no bloquean al merchant (ADR 0083).
 */
export type QuotaDecision = {
  key: LimitKey;
  limit: number;
  used: number;
  retryAfterSeconds: number;
};

/** La fila de `core.subscription` del negocio, o el contexto vacio si no hay ninguna. */
export async function entitlementContextOf(
  businessId: string,
): Promise<EntitlementContext> {
  const [row] = await getDb()
    .select({
      plan: subscriptions.plan,
      pendingPlan: subscriptions.pendingPlan,
      status: subscriptions.status,
      stripeSubscriptionId: subscriptions.stripeSubscriptionId,
    })
    .from(subscriptions)
    .where(eq(subscriptions.businessId, businessId))
    .limit(1);
  return row ?? { plan: null };
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
  const consumed =
    key === "catalog.imports.attempts"
      ? // `provider` se persiste solo DESPUES de que `start()` fue aceptado. `attempt_count`
        // es el fusible tecnico del import y puede crecer antes de una caida/rechazo.
        isNotNull(catalogImports.provider)
      : // **`ready` o mas alla.** Un `accepted`, un `cancelled` despues de revisar o un
        // `expired` que llego a tener borrador ya gastaron el analisis; un `failed` no,
        // y por eso `draft is not null` es el discriminante y no el `status` actual.
        isNotNull(catalogImports.draft);
  const [row] = await getDb()
    .select({ total: count() })
    .from(catalogImports)
    .where(
      and(
        eq(catalogImports.businessId, businessId),
        gte(catalogImports.createdAt, since),
        consumed,
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
  ctx: EntitlementContext,
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
        ? "Se agotaron los intentos de análisis por hoy. Probá de nuevo mañana."
        : "Ya usaste tu análisis de menú de hoy. Probá de nuevo mañana.",
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
 * La fila en curso TODAVIA NO esta contada: `provider` se escribe al volver de `start()`.
 * Por eso se admite sólo cuando `used < limit`: el submit numero `limit` pasa y el siguiente
 * se rechaza. **El valor del tope sale del catalogo** (`entitlements/catalog.ts`), que hoy lo
 * tiene en valor de pruebas; este archivo no lo conoce y no debe conocerlo.
 */
export async function withinAttemptBudget(
  businessId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const ctx = await entitlementContextOf(businessId);
  const limit = limitOf(ctx, "catalog.imports.attempts");
  const used = await usedInWindow(businessId, "catalog.imports.attempts", now);
  return used < limit;
}

/** El `updated_at` de cualquier escritura del import. Se centraliza para que ninguna
 * transicion se olvide de moverlo. */
export const touch = () => ({ updatedAt: sql`now()` });
