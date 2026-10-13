import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  conCookie,
  cookieDe,
  limpiarNegocios,
  permisosIntegrationEnabled,
  seedOwnerDeNegocio,
} from "../server/permissions-integration-support";
import { getDb } from "@mi-pasaporte/db";
import { businessModules, businesses, products } from "@mi-pasaporte/db/schema";
import { seedMember } from "../server/counter-integration-support";
import { GET as LIST_MODULES } from "../app/api/modules/route";
import { PUT as SET_MODULE } from "../app/api/modules/[moduleId]/route";
import {
  GET as LIST_ITEMS,
  POST as CREATE_ITEM,
} from "../app/api/modules/stock/items/route";
import { PATCH as UPDATE_ITEM } from "../app/api/modules/stock/items/[itemId]/route";
import { POST as PURCHASE } from "../app/api/modules/stock/items/[itemId]/purchases/route";
import { POST as ADJUST } from "../app/api/modules/stock/items/[itemId]/adjustments/route";
import { GET as MOVEMENTS } from "../app/api/modules/stock/items/[itemId]/movements/route";
import { POST as ENTRY } from "../app/api/modules/stock/entries/route";
import { GET as LOG } from "../app/api/modules/stock/movements/route";
import {
  GET as LIST_RECIPES,
  PUT as SET_RECIPES_MODULE,
} from "../app/api/modules/recipes/route";
import {
  GET as READ_RECIPE,
  PUT as SAVE_RECIPE,
} from "../app/api/modules/recipes/[productId]/route";

/**
 * Spec 0210 — EL MUNDO DE LOS MODULOS para las suites `modules-*.neon.integration`: un negocio con
 * su owner (sesion REAL) y la categoria `gcid:restaurant`. Las rutas se llaman como las llama el
 * navegador: con cookie, sin dobles. Aca no hay un solo `expect`: los oraculos viven en los tests.
 */

export const modulesIntegrationEnabled = permisosIntegrationEnabled;

export type ModuleWorld = {
  businessId: string;
  ownerId: string;
  cookie: string;
  users: string[];
};

export async function seedModuleWorld(label: string): Promise<ModuleWorld> {
  const ownerId = `modules-int-${randomUUID()}`;
  const businessId = randomUUID();
  await seedOwnerDeNegocio(
    ownerId,
    businessId,
    `mod-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${randomUUID().slice(0, 8)}`,
  );
  await getDb()
    .update(businesses)
    .set({ categoryGcid: "gcid:restaurant" })
    .where(eq(businesses.id, businessId));
  return {
    businessId,
    ownerId,
    cookie: await cookieDe(ownerId),
    users: [ownerId],
  };
}

export async function dropModuleWorld(
  world: ModuleWorld | undefined,
): Promise<void> {
  if (!world) return;
  await limpiarNegocios([world.businessId], world.users);
}

/** Enciende modulos POR SQL (montaje; el camino por la ruta lo prueba `modules-registry.neon`). */
export async function enableModules(
  world: ModuleWorld,
  ids: string[],
): Promise<void> {
  for (const moduleId of ids) {
    await getDb()
      .insert(businessModules)
      .values({ businessId: world.businessId, moduleId, enabled: true })
      .onConflictDoUpdate({
        target: [businessModules.businessId, businessModules.moduleId],
        set: { enabled: true },
      });
  }
}

/** Un integrante con `permissions` y su cookie. */
export async function moduleStaff(
  world: ModuleWorld,
  permissions: string[],
): Promise<string> {
  const userId = await seedMember({
    businessId: world.businessId,
    permissions,
  });
  world.users.push(userId);
  return cookieDe(userId);
}

export async function seedProduct(
  world: ModuleWorld,
  name: string,
  unitPrice: string | null,
): Promise<string> {
  const [row] = await getDb()
    .insert(products)
    .values({ businessId: world.businessId, name, unitPrice })
    .returning({ id: products.id });
  return row.id;
}

const p = <T extends Record<string, string>>(params: T) => ({
  params: Promise.resolve(params),
});
const ITEMS = "/api/modules/stock/items";

/** Las rutas de `/api/modules/**` con la cookie del caller. Devuelven el `Response` crudo. */
export const api = {
  modules: (cookie: string) =>
    LIST_MODULES(conCookie("/api/modules", "GET", cookie)),
  /** El handler que Next elige de verdad: `/api/modules/recipes` es la ruta estatica de Recetas,
   * no `[moduleId]` (ver `modules/toggle-route.ts`). */
  setModule: (cookie: string, moduleId: string, body: unknown) => {
    const request = conCookie(`/api/modules/${moduleId}`, "PUT", cookie, body);
    return moduleId === "recipes"
      ? SET_RECIPES_MODULE(request)
      : SET_MODULE(request, p({ moduleId }));
  },
  items: (cookie: string, status?: string) =>
    LIST_ITEMS(
      conCookie(status ? `${ITEMS}?status=${status}` : ITEMS, "GET", cookie),
    ),
  createItem: (cookie: string, body: unknown) =>
    CREATE_ITEM(conCookie(ITEMS, "POST", cookie, body)),
  updateItem: (cookie: string, itemId: string, body: unknown) =>
    UPDATE_ITEM(
      conCookie(`${ITEMS}/${itemId}`, "PATCH", cookie, body),
      p({ itemId }),
    ),
  purchase: (cookie: string, itemId: string, body: unknown) =>
    PURCHASE(
      conCookie(`${ITEMS}/${itemId}/purchases`, "POST", cookie, body),
      p({ itemId }),
    ),
  adjust: (cookie: string, itemId: string, body: unknown) =>
    ADJUST(
      conCookie(`${ITEMS}/${itemId}/adjustments`, "POST", cookie, body),
      p({ itemId }),
    ),
  movements: (cookie: string, itemId: string, limit?: number) =>
    MOVEMENTS(
      conCookie(
        `${ITEMS}/${itemId}/movements${limit === undefined ? "" : `?limit=${limit}`}`,
        "GET",
        cookie,
      ),
      p({ itemId }),
    ),
  entry: (cookie: string, body: unknown) =>
    ENTRY(conCookie("/api/modules/stock/entries", "POST", cookie, body)),
  log: (cookie: string, limit?: number) =>
    LOG(
      conCookie(
        `/api/modules/stock/movements${limit === undefined ? "" : `?limit=${limit}`}`,
        "GET",
        cookie,
      ),
    ),
  recipes: (cookie: string) =>
    LIST_RECIPES(conCookie("/api/modules/recipes", "GET", cookie)),
  recipe: (cookie: string, productId: string) =>
    READ_RECIPE(
      conCookie(`/api/modules/recipes/${productId}`, "GET", cookie),
      p({ productId }),
    ),
  saveRecipe: (cookie: string, productId: string, body: unknown) =>
    SAVE_RECIPE(
      conCookie(`/api/modules/recipes/${productId}`, "PUT", cookie, body),
      p({ productId }),
    ),
};

/** Crea un insumo por la ruta (falla ruidoso si no es 201). */
export async function newItem(
  world: ModuleWorld,
  name: string,
  unit: "g" | "ml" | "unit" = "g",
): Promise<{ id: string; name: string }> {
  const response = await api.createItem(world.cookie, { name, unit });
  if (response.status !== 201)
    throw new Error(`newItem: ${response.status} ${await response.text()}`);
  return (await response.json()).item;
}

/** Registra una compra por la ruta (falla ruidoso si no es 201). */
export async function buy(
  world: ModuleWorld,
  itemId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const response = await api.purchase(world.cookie, itemId, body);
  if (response.status !== 201)
    throw new Error(`buy: ${response.status} ${await response.text()}`);
}
