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
import {
  DELETE,
  GET,
  PATCH,
  POST,
  PUT,
} from "../app/api/modules/[moduleId]/[[...path]]/route";

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

const HANDLERS = { GET, POST, PUT, PATCH, DELETE };
type Method = keyof typeof HANDLERS;

/**
 * Spec 0216 — UNA llamada como la resuelve Next: todo `/api/modules/<id>/…` cae en el despachador
 * `[moduleId]/[[...path]]` (el unico archivo de ruta de modulos que queda), con `params` armados
 * desde la URL igual que Next (`path` ausente cuando no hay segmentos). Cambio de SOPORTE: las
 * suites siguen llamando a `api.*` con las mismas firmas.
 */
export function callModuleRoute(
  method: Method,
  url: string,
  cookie: string,
  body?: unknown,
): Promise<Response> {
  const pathname = new URL(url, "http://localhost").pathname;
  const [moduleId, ...rest] = pathname
    .replace(/^\/api\/modules\//, "")
    .split("/")
    .map(decodeURIComponent);
  const params = rest.length > 0 ? { moduleId, path: rest } : { moduleId };
  return HANDLERS[method](conCookie(url, method, cookie, body), {
    params: Promise.resolve(params),
  });
}

/** Spec 0223 — un POST multipart al despachador con `photos` (las fotos de un borrador). `path` es
 * relativo a `/api/modules/` (`<id>/…`). */
export function postModulePhotos(
  path: string,
  cookie: string,
  photos: readonly Buffer[],
): Promise<Response> {
  const form = new FormData();
  photos.forEach((photo, i) =>
    form.append(
      "photos",
      new File([new Uint8Array(photo)], `foto-${i}.png`, { type: "image/png" }),
    ),
  );
  const [moduleId, ...rest] = path.split("/");
  return POST(
    new Request(`http://localhost:3001/api/modules/${path}`, {
      method: "POST",
      headers: { cookie },
      body: form,
    }),
    { params: Promise.resolve({ moduleId, path: rest }) },
  );
}

const ITEMS = "/api/modules/stock/items";

/** Las rutas de `/api/modules/**` con la cookie del caller. Devuelven el `Response` crudo. */
export const api = {
  modules: (cookie: string) =>
    LIST_MODULES(conCookie("/api/modules", "GET", cookie)),
  setModule: (cookie: string, moduleId: string, body: unknown) =>
    callModuleRoute("PUT", `/api/modules/${moduleId}`, cookie, body),
  items: (cookie: string, status?: string) =>
    callModuleRoute(
      "GET",
      status ? `${ITEMS}?status=${status}` : ITEMS,
      cookie,
    ),
  createItem: (cookie: string, body: unknown) =>
    callModuleRoute("POST", ITEMS, cookie, body),
  updateItem: (cookie: string, itemId: string, body: unknown) =>
    callModuleRoute("PATCH", `${ITEMS}/${itemId}`, cookie, body),
  purchase: (cookie: string, itemId: string, body: unknown) =>
    callModuleRoute("POST", `${ITEMS}/${itemId}/purchases`, cookie, body),
  adjust: (cookie: string, itemId: string, body: unknown) =>
    callModuleRoute("POST", `${ITEMS}/${itemId}/adjustments`, cookie, body),
  movements: (cookie: string, itemId: string, limit?: number) =>
    callModuleRoute(
      "GET",
      `${ITEMS}/${itemId}/movements${limit === undefined ? "" : `?limit=${limit}`}`,
      cookie,
    ),
  entry: (cookie: string, body: unknown) =>
    callModuleRoute("POST", "/api/modules/stock/entries", cookie, body),
  draft: (cookie: string, body: unknown) =>
    callModuleRoute("POST", "/api/modules/stock/entries/draft", cookie, body),
  log: (cookie: string, limit?: number) =>
    callModuleRoute(
      "GET",
      `/api/modules/stock/movements${limit === undefined ? "" : `?limit=${limit}`}`,
      cookie,
    ),
  recipes: (cookie: string) =>
    callModuleRoute("GET", "/api/modules/recipes", cookie),
  recipe: (cookie: string, productId: string) =>
    callModuleRoute("GET", `/api/modules/recipes/${productId}`, cookie),
  recipeDraft: (cookie: string, productId: string, body: unknown) =>
    callModuleRoute(
      "POST",
      `/api/modules/recipes/${productId}/draft`,
      cookie,
      body,
    ),
  saveRecipe: (cookie: string, productId: string, body: unknown) =>
    callModuleRoute("PUT", `/api/modules/recipes/${productId}`, cookie, body),
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
