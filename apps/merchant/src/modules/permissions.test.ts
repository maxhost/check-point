import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@mi-pasaporte/db/permissions-catalog";
import {
  isValidPermission,
  memberPermissions,
  modulePermissionOwner,
  normalizeValidPermissions,
  validPermissions,
} from "./permissions";

/** Spec 0216 / ADR 0139 §5 — el catalogo VALIDO de permisos: core + manifiestos. */

describe("catalogo valido de permisos (spec 0216)", () => {
  it("es el del core seguido de los de cada modulo, en el orden del registro", () => {
    // Spec 0220: `pos` salio del core y lo declara el modulo POS.
    expect(validPermissions()).toEqual([
      ...PERMISSIONS,
      "stock",
      "recipes",
      "pos",
      "expenses",
    ]);
    expect(PERMISSIONS).not.toContain("pos");
  });

  it("acepta los de modulo y rechaza lo desconocido", () => {
    expect(isValidPermission("stock")).toBe(true);
    expect(isValidPermission("recipes")).toBe(true);
    expect(isValidPermission("catalog")).toBe(true);
    for (const value of ["mesas", "Stock", "", null, 7]) {
      expect(isValidPermission(value)).toBe(false);
    }
  });

  it("normaliza: deduplica, descarta lo desconocido y ordena como el catalogo", () => {
    expect(
      normalizeValidPermissions([
        "recipes",
        "counter",
        "stock",
        "mesas",
        "counter",
      ]),
    ).toEqual(["counter", "stock", "recipes"]);
  });

  it("el owner recibe TODO el catalogo valido aunque su fila este vacia; el staff, lo suyo", () => {
    expect(memberPermissions("owner", [])).toEqual(validPermissions());
    expect(memberPermissions("owner", null)).toContain("recipes");
    expect(memberPermissions("staff", ["stock", "catalog"])).toEqual([
      "catalog",
      "stock",
    ]);
    expect(memberPermissions("staff", null)).toEqual([]);
  });

  it("sabe que modulo declara cada permiso", () => {
    expect(modulePermissionOwner("stock")?.id).toBe("stock");
    expect(modulePermissionOwner("recipes")?.id).toBe("recipes");
    expect(modulePermissionOwner("catalog")).toBeNull();
    expect(modulePermissionOwner("pos")?.id).toBe("pos");
    expect(modulePermissionOwner("locations")).toBeNull();
  });
});
