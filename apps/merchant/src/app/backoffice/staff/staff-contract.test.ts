import { describe, expect, it } from "vitest";
import { PERMISSIONS as CATALOGO } from "../../../server/permissions-catalog";
import { PERMISSIONS, errorCopy } from "./staff-contract";

/**
 * ORACULO DEL HALLAZGO H4 DE LA REVISION DE LA 0088: la pantalla no puede tener su propia
 * lista de permisos. El `Record<PermissionScope, …>` de `staff-contract.ts` ya hace que un
 * permiso nuevo no compile; esto cubre la otra mitad —que el ORDEN de la pantalla no se olvide
 * ninguno—, porque un arreglo incompleto SI compila. Se comparan ordenados a proposito: el
 * orden de la pantalla es de producto y no tiene por que ser el del catalogo.
 */
describe("los permisos de la pantalla salen del catalogo cerrado", () => {
  it("ofrece exactamente los siete permisos del catalogo", () => {
    expect([...PERMISSIONS.map((permission) => permission.id)].sort()).toEqual(
      [...CATALOGO].sort(),
    );
  });

  it("abre con el recomendado y cierra con el peligroso", () => {
    expect(PERMISSIONS[0]?.id).toBe("counter");
    expect(PERMISSIONS[PERMISSIONS.length - 1]?.id).toBe("staff");
  });

  it("le escribe copy accionable a cada uno", () => {
    for (const permission of PERMISSIONS) {
      expect(permission.label.length).toBeGreaterThan(2);
      expect(permission.detail.length).toBeGreaterThan(20);
    }
  });
});

describe("staff error copy", () => {
  it.each([
    "permissions_required",
    "unknown_permission",
    "permission_not_grantable",
    "self_permission_edit",
    "target_is_owner",
    "staff_not_found",
    "unauthorized",
    "not_member",
    "missing_permission",
    "email_not_verified",
    "business_suspended",
    "business_closed",
    "invalid_body",
    "name_required",
    "name_too_long",
    "permissions_not_here",
    "handle_taken",
    "target_disabled",
  ])("has actionable Spanish copy for %s", (code) => {
    const copy = errorCopy({ code, error: "server copy" }, "fallback");
    expect(copy).not.toBe("server copy");
    expect(copy).not.toBe("fallback");
    expect(copy.length).toBeGreaterThan(20);
  });

  it("uses server copy for an unknown future code", () => {
    expect(
      errorCopy({ code: "future", error: "Detalle útil" }, "fallback"),
    ).toBe("Detalle útil");
  });
});
