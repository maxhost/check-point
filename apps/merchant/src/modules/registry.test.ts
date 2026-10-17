import { describe, expect, it } from "vitest";
import { BUSINESS_CATEGORIES } from "../lib/business-categories";
import {
  PERMISSIONS,
  PERMISSION_SHAPE,
} from "@mi-pasaporte/db/permissions-catalog";
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

  // Spec 0220: el POS y Mesas entran despues de los de la Fase 1 (antes `moduleById("pos")` era null).
  it("stock, recetas, pos y mesas, en ese orden; recetas requiere stock y mesas requiere el POS", () => {
    expect(MODULES.map((m) => m.id)).toEqual([
      "stock",
      "recipes",
      "pos",
      "tables",
      "expenses",
    ]);
    expect(moduleById("recipes")?.requires).toEqual(["stock"]);
    expect(dependentsOf("stock").map((m) => m.id)).toEqual(["recipes"]);
    expect(moduleById("tables")?.requires).toEqual(["pos"]);
    expect(moduleById("pos")?.optional).toEqual(["tables"]);
    expect(dependentsOf("pos").map((m) => m.id)).toEqual(["tables"]);
    expect(moduleById("turnos")).toBeNull();
    expect(moduleById(42)).toBeNull();
  });

  /** Spec 0220 / ADR 0141 §5 y §9: `requires` y `optional` solo nombran ids del registro, ningun
   * modulo se nombra a si mismo y un id no esta en las dos listas. */
  it("requires/optional: ids del registro, sin nombrarse a si mismo ni repetirse entre listas", () => {
    for (const m of MODULES) {
      const named = [...m.requires, ...(m.optional ?? [])];
      for (const id of named) {
        expect(moduleById(id), `${m.id} → ${id}`).not.toBeNull();
        expect(id, `${m.id} se nombra a si mismo`).not.toBe(m.id);
      }
      expect(new Set(named).size, `${m.id}: id repetido`).toBe(named.length);
    }
  });

  /** ADR 0141 §2 y §3: el permiso de `startPage` y de `locationAction` es del core o lo declara el
   * mismo modulo (si no, nadie salvo el owner llegaria nunca); `startPage` apunta a una entrada del
   * menu del modulo. */
  it("startPage y locationAction piden un permiso del core o del propio modulo", () => {
    const own = (m: (typeof MODULES)[number], permission: string) =>
      (PERMISSIONS as readonly string[]).includes(permission) ||
      m.permissions.some((p) => p.id === permission);
    for (const m of MODULES) {
      if (m.startPage) {
        expect(own(m, m.startPage.permission), m.id).toBe(true);
        expect(
          m.navigation.some((e) => e.path === m.startPage?.path),
          `${m.id}: startPage sin entrada de menu`,
        ).toBe(true);
      }
      if (m.locationAction) {
        expect(own(m, m.locationAction.permission), m.id).toBe(true);
      }
    }
    expect(MODULES.filter((m) => m.startPage).length).toBeGreaterThan(0);
  });

  /** Spec 0216 / ADR 0139 §5: la base solo valida la forma; que no choquen lo valida esto. */
  it("los permisos de modulo cumplen la forma de la base y no chocan con el core ni entre si", () => {
    const shape = new RegExp(PERMISSION_SHAPE);
    const ids = MODULES.flatMap((m) => m.permissions.map((p) => p.id));
    for (const id of ids) expect(shape.test(id), id).toBe(true);
    const all = [...PERMISSIONS, ...ids];
    expect(new Set(all).size).toBe(all.length);
    expect(ids).toEqual(["stock", "recipes", "pos", "expenses"]);
  });
});
