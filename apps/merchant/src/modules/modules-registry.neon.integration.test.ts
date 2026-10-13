import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import { businessModules } from "@mi-pasaporte/db/schema";
import {
  type ModuleWorld,
  api,
  dropModuleWorld,
  moduleStaff,
  modulesIntegrationEnabled,
  newItem,
  seedModuleWorld,
} from "./modules-integration-support";

/**
 * Spec 0210 §Plan 3 — EL REGISTRO DE MODULOS contra Neon, por las rutas y con sesion real:
 * dependencias (409 en los dos sentidos), apagado → 403 en una ruta del modulo, reencender conserva
 * los datos, solo el owner enciende, y un comercio no ve el estado de otro. Lo que pesa se lee por SQL.
 */

let world: ModuleWorld;
let other: ModuleWorld;

beforeAll(async () => {
  world = await seedModuleWorld("Modulos");
  other = await seedModuleWorld("Modulos ajeno");
}, 240_000);

afterAll(async () => {
  await dropModuleWorld(world);
  await dropModuleWorld(other);
}, 240_000);

async function enabledRow(w: ModuleWorld, moduleId: string) {
  const [row] = await getDb()
    .select({ enabled: businessModules.enabled })
    .from(businessModules)
    .where(
      and(
        eq(businessModules.businessId, w.businessId),
        eq(businessModules.moduleId, moduleId),
      ),
    );
  return row?.enabled ?? null;
}

describe.skipIf(!modulesIntegrationEnabled)(
  "Modulos: registro y activacion (spec 0210)",
  () => {
    it("GET /api/modules: los del registro, en orden, apagados y sugeridos para un restaurante", async () => {
      const r = await api.modules(world.cookie);
      expect(r.status).toBe(200);
      expect((await r.json()).modules).toEqual([
        {
          id: "stock",
          name: "Stock",
          description: "Insumos, compras y stock estimado",
          requires: [],
          enabled: false,
          suggested: true,
        },
        {
          id: "recipes",
          name: "Recetas",
          description: "Receta de cada producto, costo y margen",
          requires: ["stock"],
          enabled: false,
          suggested: true,
        },
      ]);
    }, 120_000);

    it("con el modulo apagado, una ruta de stock contesta 403 module_disabled", async () => {
      const r = await api.items(world.cookie);
      expect(r.status).toBe(403);
      expect((await r.json()).code).toBe("module_disabled");
    }, 120_000);

    it("dependencias: recipes sin stock → 409; apagar stock con recipes → 409; idempotente", async () => {
      const early = await api.setModule(world.cookie, "recipes", {
        enabled: true,
      });
      expect(early.status).toBe(409);
      expect(await early.json()).toMatchObject({
        code: "module_requires",
        missing: ["stock"],
      });
      expect(await enabledRow(world, "recipes")).toBeNull();

      const stock = await api.setModule(world.cookie, "stock", {
        enabled: true,
      });
      expect(stock.status).toBe(200);
      expect((await stock.json()).module).toMatchObject({
        id: "stock",
        enabled: true,
      });
      const again = await api.setModule(world.cookie, "stock", {
        enabled: true,
      });
      expect(again.status).toBe(200);

      const recipes = await api.setModule(world.cookie, "recipes", {
        enabled: true,
      });
      expect(recipes.status).toBe(200);
      expect(await enabledRow(world, "recipes")).toBe(true);

      const off = await api.setModule(world.cookie, "stock", {
        enabled: false,
      });
      expect(off.status).toBe(409);
      expect(await off.json()).toMatchObject({
        code: "module_required_by",
        dependents: ["recipes"],
      });
      expect(await enabledRow(world, "stock")).toBe(true);
    }, 120_000);

    it("apagar no borra: con stock apagado la ruta da 403 y al reencender el insumo sigue", async () => {
      const item = await newItem(world, "Harina");
      expect(
        (await api.setModule(world.cookie, "recipes", { enabled: false }))
          .status,
      ).toBe(200);
      expect(
        (await api.setModule(world.cookie, "stock", { enabled: false })).status,
      ).toBe(200);
      expect(await enabledRow(world, "stock")).toBe(false);

      const blocked = await api.updateItem(world.cookie, item.id, {
        name: "Robo",
      });
      expect(blocked.status).toBe(403);
      expect((await blocked.json()).code).toBe("module_disabled");

      expect(
        (await api.setModule(world.cookie, "stock", { enabled: true })).status,
      ).toBe(200);
      const listed = await (await api.items(world.cookie)).json();
      expect(
        listed.items.map((i: { id: string; name: string }) => [i.id, i.name]),
      ).toEqual([[item.id, "Harina"]]);
    }, 120_000);

    it("errores del PUT: 404 module_not_found (tambien pos), 422 invalid_body", async () => {
      for (const id of ["nope", "pos"]) {
        const r = await api.setModule(world.cookie, id, { enabled: true });
        expect(r.status).toBe(404);
        expect((await r.json()).code).toBe("module_not_found");
      }
      for (const body of [{}, { enabled: "true" }, []]) {
        const r = await api.setModule(world.cookie, "stock", body);
        expect(r.status).toBe(422);
        expect((await r.json()).code).toBe("invalid_body");
      }
    }, 120_000);

    it("solo el owner enciende; el staff con catalog lista pero no cambia; sin catalog no lista", async () => {
      const withCatalog = await moduleStaff(world, ["catalog"]);
      expect((await api.modules(withCatalog)).status).toBe(200);
      const put = await api.setModule(withCatalog, "stock", { enabled: false });
      expect(put.status).toBe(403);
      expect((await put.json()).code).toBe("not_owner");
      expect(await enabledRow(world, "stock")).toBe(true);

      const without = await moduleStaff(world, ["counter"]);
      const r = await api.modules(without);
      expect(r.status).toBe(403);
      expect((await r.json()).code).toBe("missing_permission");
      const items = await api.items(without);
      expect(items.status).toBe(403);
      expect((await items.json()).code).toBe("missing_permission");
    }, 120_000);

    it("aislamiento: el negocio B no ve encendido lo que encendio A, y su ruta sigue en 403", async () => {
      const r = await (await api.modules(other.cookie)).json();
      expect(r.modules.map((m: { enabled: boolean }) => m.enabled)).toEqual([
        false,
        false,
      ]);
      expect((await api.items(other.cookie)).status).toBe(403);
      expect(await enabledRow(other, "stock")).toBeNull();
    }, 120_000);
  },
);
