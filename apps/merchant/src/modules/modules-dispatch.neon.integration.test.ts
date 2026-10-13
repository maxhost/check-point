import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import { memberships } from "@mi-pasaporte/db/schema";
import { conCookie } from "../server/permissions-integration-support";
import { POST as CREATE_STAFF } from "../app/api/staff/route";
import { PATCH as SET_PERMISSIONS } from "../app/api/staff/[userId]/permissions/route";
import { GET as SESSION } from "../app/api/merchant/session/route";
import {
  type ModuleWorld,
  api,
  callModuleRoute,
  dropModuleWorld,
  enableModules,
  moduleStaff,
  modulesIntegrationEnabled,
  newItem,
  seedModuleWorld,
} from "./modules-integration-support";

/**
 * Spec 0216 §Plan 2, 3 y 5 — EL DESPACHADOR DE `/api/modules/<id>/…` Y LOS PERMISOS DE MODULO
 * contra Neon, con sesiones reales y por los handlers que Next elige (`callModuleRoute`).
 *
 * - Despachador: 404 `module_not_found` / `route_not_found`, 405 por metodo, `missing_permission`
 *   ANTES de mirar si el modulo esta encendido, 403 `module_disabled`, toggle por `PUT` sin path,
 *   y un uuid de otro negocio → el 404 del handler.
 * - Permisos: `stock` sin `catalog` usa Stock; `catalog` sin `stock` no; otorgar `recipes` con
 *   Recetas apagado → 422 `module_disabled_permission` (PATCH y alta); conservarlo no falla; el
 *   owner recibe tambien los de modulo; un permiso desconocido sigue siendo `unknown_permission`.
 * - `GET /api/modules` para un integrante sin `catalog` → 200 con `navigation` y `permissions`.
 */

let world: ModuleWorld;
let other: ModuleWorld;

beforeAll(async () => {
  world = await seedModuleWorld("Despachador");
  other = await seedModuleWorld("Despachador ajeno");
}, 240_000);

afterAll(async () => {
  await dropModuleWorld(world);
  await dropModuleWorld(other);
}, 240_000);

const patchPermissions = (cookie: string, userId: string, body: unknown) =>
  SET_PERMISSIONS(
    conCookie(`/api/staff/${userId}/permissions`, "PATCH", cookie, body),
    { params: Promise.resolve({ userId }) },
  );

async function storedPermissions(userId: string): Promise<string[]> {
  const [row] = await getDb()
    .select({ permissions: memberships.permissions })
    .from(memberships)
    .where(
      and(
        eq(memberships.businessId, world.businessId),
        eq(memberships.userId, userId),
      ),
    );
  return row.permissions;
}

/** El `user.id` del ultimo integrante que sembro `moduleStaff`. */
const lastStaff = (w: ModuleWorld) => w.users[w.users.length - 1];

describe.skipIf(!modulesIntegrationEnabled)(
  "despachador de modulos y permisos de modulo (spec 0216)",
  () => {
    it("con todo apagado: el integrante sin permiso recibe missing_permission, no module_disabled", async () => {
      const counter = await moduleStaff(world, ["counter"]);
      const r = await api.items(counter);
      expect(r.status).toBe(403);
      expect((await r.json()).code).toBe("missing_permission");
      const owner = await api.items(world.cookie);
      expect(owner.status).toBe(403);
      expect((await owner.json()).code).toBe("module_disabled");
    }, 120_000);

    it("GET /api/modules para un integrante sin catalog: 200 con navigation y permissions", async () => {
      const counter = await moduleStaff(world, ["counter"]);
      const r = await api.modules(counter);
      expect(r.status).toBe(200);
      const { modules } = await r.json();
      expect(modules.map((m: { id: string }) => m.id)).toEqual([
        "stock",
        "recipes",
      ]);
      expect(modules[0].navigation).toEqual([
        { path: "", label: "Stock", icon: "Package", permission: "stock" },
      ]);
      expect(modules[1].permissions.map((p: { id: string }) => p.id)).toEqual([
        "recipes",
      ]);
    }, 120_000);

    it("otorgar recipes con Recetas apagado → 422; conservarlo despues de apagar no falla", async () => {
      await moduleStaff(world, ["counter"]);
      const target = lastStaff(world);
      const early = await patchPermissions(world.cookie, target, {
        permissions: ["counter", "recipes"],
      });
      expect(early.status).toBe(422);
      expect((await early.json()).code).toBe("module_disabled_permission");
      expect(await storedPermissions(target)).toEqual(["counter"]);

      const create = await CREATE_STAFF(
        conCookie("/api/staff", "POST", world.cookie, {
          name: "Alta Recetas",
          permissions: ["stock"],
        }),
      );
      expect(create.status).toBe(422);
      expect((await create.json()).code).toBe("module_disabled_permission");

      await enableModules(world, ["stock", "recipes"]);
      const granted = await patchPermissions(world.cookie, target, {
        permissions: ["counter", "recipes"],
      });
      expect(granted.status).toBe(200);
      expect((await granted.json()).staff.permissions).toEqual([
        "counter",
        "recipes",
      ]);

      expect(
        (await api.setModule(world.cookie, "recipes", { enabled: false }))
          .status,
      ).toBe(200);
      const kept = await patchPermissions(world.cookie, target, {
        permissions: ["recipes", "counter", "brand"],
      });
      expect(kept.status).toBe(200);
      expect(await storedPermissions(target)).toEqual([
        "brand",
        "counter",
        "recipes",
      ]);
      expect(
        (await api.setModule(world.cookie, "recipes", { enabled: true }))
          .status,
      ).toBe(200);
    }, 120_000);

    it("un permiso desconocido sigue siendo unknown_permission", async () => {
      await moduleStaff(world, ["counter"]);
      const r = await patchPermissions(world.cookie, lastStaff(world), {
        permissions: ["counter", "mesas"],
      });
      expect(r.status).toBe(400);
      expect((await r.json()).code).toBe("unknown_permission");
    }, 120_000);

    it("stock sin catalog usa Stock; catalog sin stock no; stock no abre Recetas", async () => {
      // Estado propio (no el que deja el caso anterior): los dos modulos encendidos.
      await enableModules(world, ["stock", "recipes"]);
      const stockOnly = await moduleStaff(world, ["stock"]);
      expect((await api.items(stockOnly)).status).toBe(200);
      const recipes = await api.recipes(stockOnly);
      expect(recipes.status).toBe(403);
      expect((await recipes.json()).code).toBe("missing_permission");

      const catalogOnly = await moduleStaff(world, ["catalog"]);
      const r = await api.items(catalogOnly);
      expect(r.status).toBe(403);
      expect((await r.json()).code).toBe("missing_permission");

      const recipesOnly = await moduleStaff(world, ["recipes"]);
      expect((await api.recipes(recipesOnly)).status).toBe(200);
    }, 120_000);

    it("el owner recibe en la sesion tambien los permisos de modulo", async () => {
      const r = await SESSION(
        conCookie("/api/merchant/session", "GET", world.cookie),
      );
      const { membership } = await r.json();
      expect(membership.role).toBe("owner");
      expect(membership.permissions).toEqual(
        expect.arrayContaining(["catalog", "stock", "recipes"]),
      );
      expect(membership.permissions.slice(-2)).toEqual(["stock", "recipes"]);
    }, 120_000);

    it("404 module_not_found, 404 route_not_found, 405 por metodo y en la base sin ruta", async () => {
      const cases: [
        Parameters<typeof callModuleRoute>[0],
        string,
        number,
        string,
      ][] = [
        ["GET", "/api/modules/nope/items", 404, "module_not_found"],
        ["GET", "/api/modules/stock/nope", 404, "route_not_found"],
        ["GET", "/api/modules/stock/items/x/nope", 404, "route_not_found"],
        ["DELETE", "/api/modules/stock/items", 405, "method_not_allowed"],
        ["POST", "/api/modules/recipes", 405, "method_not_allowed"],
        ["GET", "/api/modules/stock", 405, "method_not_allowed"],
      ];
      for (const [method, url, status, code] of cases) {
        const r = await callModuleRoute(method, url, world.cookie);
        expect(r.status, `${method} ${url}`).toBe(status);
        expect((await r.json()).code, `${method} ${url}`).toBe(code);
      }
      const allow = await callModuleRoute(
        "DELETE",
        "/api/modules/stock/items",
        world.cookie,
      );
      expect(allow.headers.get("allow")).toBe("GET, POST");
    }, 120_000);

    it("toggle por PUT sin path; un insumo de otro negocio da el 404 del handler", async () => {
      await enableModules(world, ["stock", "recipes"]);
      const off = await api.setModule(world.cookie, "recipes", {
        enabled: false,
      });
      expect(off.status).toBe(200);
      expect((await off.json()).module).toMatchObject({
        id: "recipes",
        enabled: false,
      });
      expect(
        (await api.setModule(world.cookie, "recipes", { enabled: true }))
          .status,
      ).toBe(200);

      await enableModules(other, ["stock"]);
      const foreign = await newItem(other, `Ajeno ${randomUUID().slice(0, 6)}`);
      const r = await api.updateItem(world.cookie, foreign.id, {
        name: "Robo",
      });
      expect(r.status).toBe(404);
      expect((await r.json()).code).toBe("item_not_found");
    }, 120_000);
  },
);
