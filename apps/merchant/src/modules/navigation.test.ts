import { describe, expect, it } from "vitest";
import { MODULES } from "./registry";
import { moduleHref, moduleNavigation } from "./navigation";

/** Spec 0216 / ADR 0139 §6 — las entradas de menu de los modulos, desde los manifiestos. */

const withState = (enabled: Record<string, boolean>) =>
  MODULES.map((m) => ({
    id: m.id,
    enabled: enabled[m.id] ?? false,
    navigation: m.navigation,
  }));

describe("moduleNavigation (spec 0216)", () => {
  it("el owner ve las entradas de los modulos ENCENDIDOS, en el orden del registro", () => {
    expect(
      moduleNavigation(withState({ stock: true, recipes: true }), {
        isOwner: true,
        permissions: [],
      }),
    ).toEqual([
      {
        moduleId: "stock",
        href: "/backoffice/stock",
        label: "Stock",
        icon: "Package",
        permission: "stock",
      },
      {
        moduleId: "recipes",
        href: "/backoffice/recipes",
        label: "Recetas",
        icon: "Book",
        permission: "recipes",
      },
    ]);
  });

  it("un modulo apagado no aparece, ni para el owner", () => {
    const entries = moduleNavigation(withState({ stock: true }), {
      isOwner: true,
      permissions: [],
    });
    expect(entries.map((e) => e.moduleId)).toEqual(["stock"]);
  });

  it("un integrante ve solo las entradas cuyo permiso tiene (catalog ya no abre Stock)", () => {
    const state = withState({ stock: true, recipes: true });
    const ids = (permissions: string[]) =>
      moduleNavigation(state, { isOwner: false, permissions }).map(
        (e) => e.moduleId,
      );
    expect(ids(["recipes"])).toEqual(["recipes"]);
    expect(ids(["catalog", "counter"])).toEqual([]);
    expect(ids(["stock", "recipes"])).toEqual(["stock", "recipes"]);
  });

  it('href: la base del modulo para `""` y la sub-ruta si no', () => {
    expect(moduleHref("stock", "")).toBe("/backoffice/stock");
    expect(moduleHref("stock", "items/x")).toBe("/backoffice/stock/items/x");
  });
});
