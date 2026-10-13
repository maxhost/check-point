import { describe, expect, it } from "vitest";
import { BUSINESS_CATEGORIES } from "../lib/business-categories";
import { MODULES, dependentsOf, moduleById } from "./registry";

/** Spec 0210 §Plan 1 — el registro: ids unicos, `requires` existe y sin ciclos, gcids validos. */

describe("registro de modulos", () => {
  it("ids unicos y de 1 a 40 caracteres (el CHECK de core.business_module)", () => {
    const ids = MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.length).toBeGreaterThan(0);
    for (const id of ids) expect(id.length).toBeLessThanOrEqual(40);
  });

  it("todo `requires` nombra un modulo del registro, y no hay ciclos", () => {
    for (const m of MODULES) {
      for (const r of m.requires)
        expect(moduleById(r), `${m.id} → ${r}`).not.toBeNull();
    }
    const visiting = new Set<string>();
    const visit = (id: string, path: string[]) => {
      expect(path, `ciclo: ${[...path, id].join(" → ")}`).not.toContain(id);
      if (visiting.has(id)) return;
      for (const r of moduleById(id)?.requires ?? []) visit(r, [...path, id]);
      visiting.add(id);
    };
    for (const m of MODULES) visit(m.id, []);
  });

  it("suggestedFor solo usa gcids de la lista curada del alta", () => {
    const known = new Set(BUSINESS_CATEGORIES.map((c) => c.gcid));
    for (const m of MODULES) {
      for (const g of m.suggestedFor)
        expect(known.has(g), `${m.id}: ${g}`).toBe(true);
    }
  });

  it("stock y recetas, en ese orden; recetas requiere stock", () => {
    expect(MODULES.map((m) => m.id)).toEqual(["stock", "recipes"]);
    expect(moduleById("recipes")?.requires).toEqual(["stock"]);
    expect(dependentsOf("stock").map((m) => m.id)).toEqual(["recipes"]);
    expect(moduleById("pos")).toBeNull();
    expect(moduleById(42)).toBeNull();
  });
});
