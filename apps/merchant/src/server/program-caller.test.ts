import { describe, expect, it } from "vitest";
import {
  type ProgramCaller,
  programEditDenied,
} from "@mi-pasaporte/domain/server/program-caller";

/**
 * `programEditDenied` — EL INVARIANTE CREAR ≠ EDITAR (spec 0077 §5, ADR 0076 §1), sin el
 * permiso de alta (spec 0156). Puro: el cableado contra la base lo miden
 * `onboarding-program-bypass.neon…` (owner recien creado por `signup`) y
 * `permisos-brand-loyalty.neon…` (staff).
 */
describe("programEditDenied — crear ≠ editar (spec 0156)", () => {
  const cases: Array<[string, ProgramCaller & { isEdit: boolean }, boolean]> = [
    ["crear, sin verificar", { isEdit: false, emailVerified: false }, true],
    ["crear, verificado", { isEdit: false, emailVerified: true }, true],
    [
      "crear, staff sin verificar",
      { isEdit: false, emailVerified: false, isStaff: true },
      true,
    ],
    ["editar, verificado", { isEdit: true, emailVerified: true }, true],
    [
      "editar, staff sin verificar",
      { isEdit: true, emailVerified: false, isStaff: true },
      true,
    ],
    [
      "editar, no verificado, isStaff false",
      { isEdit: true, emailVerified: false, isStaff: false },
      false,
    ],
    [
      "editar, no verificado, isStaff undefined (fail-closed)",
      { isEdit: true, emailVerified: false },
      false,
    ],
  ];

  it.each(cases)("%s", (_name, input, allowed) => {
    const denied = programEditDenied(input);
    if (allowed) {
      expect(denied).toBeNull();
    } else {
      expect(denied).toEqual({
        status: 403,
        code: "email_not_verified",
        message: "Verificá tu email para editar el programa.",
      });
    }
  });
});
