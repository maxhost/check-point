import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MODULES } from "./registry";

/**
 * Spec 0210 — `PUT /api/modules/:moduleId` tiene que llegar a TODO modulo del registro. Next resuelve
 * `app/api/modules/<id>/route.ts` (estatico) antes que `[moduleId]`: si esa ruta base existe y no
 * exporta `PUT`, encender el modulo da 405 en produccion (medido con `next dev` para `recipes`) y
 * las suites Neon, que llaman al handler directo, no lo ven. Barrido estatico del archivo.
 */

const API = join(import.meta.dirname, "..", "app", "api", "modules");

describe("toggle de modulos vs rutas base (spec 0210)", () => {
  it("el handler generico existe y delega en putModule", () => {
    const generic = readFileSync(join(API, "[moduleId]", "route.ts"), "utf8");
    expect(generic).toMatch(/export async function PUT\b/);
    expect(generic).toMatch(/putModule\(request, moduleId\)/);
  });

  it("toda ruta base de un modulo del registro re-expone el PUT con su id fijo", () => {
    const missing: string[] = [];
    let checked = 0;
    for (const { id } of MODULES) {
      const base = join(API, id, "route.ts");
      if (!existsSync(base)) continue;
      checked += 1;
      const source = readFileSync(base, "utf8");
      if (
        !/export async function PUT\b/.test(source) ||
        !source.includes(`putModule(request, "${id}")`)
      ) {
        missing.push(id);
      }
    }
    expect(missing).toEqual([]);
    // Piso: hoy `recipes` tiene ruta base; si deja de tenerla este test tiene que mirarse de nuevo.
    expect(checked).toBeGreaterThanOrEqual(1);
  });
});
