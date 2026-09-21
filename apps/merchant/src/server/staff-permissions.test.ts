import { describe, expect, it } from "vitest";

/**
 * Spec 0086 §1/§4/§5 — **EL CATALOGO PURO Y LAS REGLAS ANTI-ESCALADA**, sin base y sin HTTP.
 *
 * Acá viven las decisiones que son funciones puras: el conjunto cerrado de los siete, la
 * normalizacion, quien pasa el paso 3, que permisos ve la API para cada rol, y R1/R3. Lo que
 * necesita una fila —R4, `staff_not_found`, el aislamiento por negocio— vive en
 * `staff-permissions.neon.integration.test.ts`, porque un doble de `getDb` probaria el doble.
 */
import {
  PERMISSIONS,
  allPermissions,
  hasScope,
  isPermission,
  normalizePermissions,
  permissionsForRole,
} from "./permissions-catalog";
import {
  assertGrantable,
  assertNotSelf,
  parsePermissions,
} from "./staff-permissions";

describe("el catálogo de los siete permisos (spec 0086 §1)", () => {
  /** EL CONJUNTO EXACTO, no «al menos». Un octavo valor que entrara sin discutirlo
   * rompería acá **y** el `CHECK` de contención de la migración 0041, que lee esta misma
   * lista: son la misma fuente de verdad a propósito. */
  it("son EXACTAMENTE siete y en el orden del catálogo", () => {
    expect([...PERMISSIONS]).toEqual([
      "brand",
      "catalog",
      "counter",
      "locations",
      "loyalty",
      "marketing",
      "staff",
    ]);
  });

  it("`allPermissions` devuelve una copia: mutarla no toca el catálogo", () => {
    const copia = allPermissions();
    copia.push("billing");
    expect(allPermissions()).toEqual([...PERMISSIONS]);
  });

  it.each(["billing", "onboarding", "catalog.read", "CATALOG", "", "counter "])(
    "`%s` NO es un permiso",
    (valor) => {
      expect(isPermission(valor)).toBe(false);
    },
  );

  it.each([null, undefined, 7, {}, ["catalog"]])(
    "un no-string (%s) tampoco lo es",
    (valor) => {
      expect(isPermission(valor)).toBe(false);
    },
  );

  /** La normalización es del WRITER y no del `CHECK`: `<@` es contención de conjuntos y
   * `{catalog,catalog}` la satisface (medido contra Neon). Por eso tiene caso propio. */
  it("normaliza: deduplica y ordena por el catálogo, no por el alfabeto del input", () => {
    expect(
      normalizePermissions(["counter", "catalog", "counter", "brand"]),
    ).toEqual(["brand", "catalog", "counter"]);
    expect(normalizePermissions([])).toEqual([]);
    // Un valor desconocido no sobrevive a la normalización: la lista filtra POR el catálogo.
    expect(normalizePermissions(["catalog", "billing"])).toEqual(["catalog"]);
  });
});

describe("el paso 3 de la escalera, puro (spec 0086 §2)", () => {
  /** ADR 0079 §4: **el owner pasa sin mirar la columna**, que es lo que permite que su fila
   * quede en `'{}'` y que el `CHECK 2` la obligue a estarlo. */
  it.each([...PERMISSIONS])("un OWNER con la columna vacía abre `%s`", (s) => {
    expect(hasScope("owner", [], s)).toBe(true);
  });

  it("un STAFF abre sólo lo que tiene en su lista", () => {
    expect(hasScope("staff", ["catalog"], "catalog")).toBe(true);
    expect(hasScope("staff", ["catalog"], "brand")).toBe(false);
    expect(hasScope("staff", [], "catalog")).toBe(false);
  });

  /** FAIL-CLOSED sobre un rol que nadie le enseñó al guard: `role <> 'owner'` en los CHECK
   * de la base tiene la misma polaridad, y por el mismo motivo. */
  it("un rol desconocido NO pasa por ser desconocido", () => {
    expect(hasScope("admin", [], "catalog")).toBe(false);
    expect(hasScope("admin", ["catalog"], "catalog")).toBe(true);
  });

  it("una columna `null` o ausente cierra, no abre", () => {
    expect(hasScope("staff", null, "catalog")).toBe(false);
    expect(hasScope("staff", undefined, "catalog")).toBe(false);
  });
});

describe("lo que la API devuelve como `permissions` (spec 0086 §8)", () => {
  /** **La API no expone la columna, expone la CAPACIDAD**, y acá la diferencia importa: la
   * fila del owner está vacía por `CHECK` y el cuerpo devuelve los siete. */
  it("para un OWNER son los SIETE aunque su fila esté vacía", () => {
    expect(permissionsForRole("owner", [])).toEqual([...PERMISSIONS]);
    expect(permissionsForRole("owner", null)).toEqual([...PERMISSIONS]);
  });

  it("para un STAFF es su conjunto exacto, normalizado", () => {
    expect(permissionsForRole("staff", ["counter", "catalog"])).toEqual([
      "catalog",
      "counter",
    ]);
    expect(permissionsForRole("staff", null)).toEqual([]);
  });
});

describe("el parseo del cuerpo (spec 0086 §5)", () => {
  it.each([
    [undefined, "permissions_required"],
    [null, "permissions_required"],
    ["counter", "permissions_required"],
    [{}, "permissions_required"],
    [[], "permissions_required"],
    [["catalog", "catalog"], null],
    [["billing"], "unknown_permission"],
    [["catalog", 7], "unknown_permission"],
    [["catalog", null], "unknown_permission"],
  ])("%s → %s", (entrada, code) => {
    if (code === null) {
      expect(parsePermissions(entrada)).toEqual(["catalog"]);
      return;
    }
    expect(() => parsePermissions(entrada)).toThrowError(
      expect.objectContaining({ status: 400, code }),
    );
  });

  /** La lista vacía se decide DESPUÉS de normalizar y no antes: `[]` y `["catalog","catalog"]`
   * son casos distintos y sólo el primero es «no eligió nada». */
  it("un duplicado no es una lista vacía", () => {
    expect(parsePermissions(["counter", "counter"])).toEqual(["counter"]);
  });
});

describe("las reglas anti-escalada puras (spec 0086 §4 / ADR 0079 §3)", () => {
  /** R1 — **un administrador no fabrica otro administrador.** Es la regla que le pone techo
   * al perfil: sin ella, `staff` se propaga solo. */
  it("R1: un no-owner que manda `staff` → 403 `permission_not_grantable`", () => {
    expect(() => assertGrantable("staff", ["counter", "staff"])).toThrowError(
      expect.objectContaining({
        status: 403,
        code: "permission_not_grantable",
      }),
    );
  });

  it("R1: el OWNER sí lo otorga", () => {
    expect(() => assertGrantable("owner", ["staff"])).not.toThrow();
  });

  /** R2 — decisión TEXTUAL del owner, con su caso: un admin de staff tiene que poder crear a
   * alguien de marketing **aunque él no tenga `marketing`**. */
  it.each(["brand", "catalog", "counter", "locations", "loyalty", "marketing"])(
    "R2: un no-owner SÍ otorga `%s`, tenga o no ese permiso él mismo",
    (permiso) => {
      expect(() => assertGrantable("staff", [permiso])).not.toThrow();
    },
  );

  /** Fail-closed en el ROL: un rol que no es `owner` cae del lado restrictivo. */
  it("R1: un rol desconocido tampoco otorga `staff`", () => {
    expect(() => assertGrantable("admin", ["staff"])).toThrowError(
      expect.objectContaining({ code: "permission_not_grantable" }),
    );
  });

  /** R3 — **nadie edita sus propios permisos, tampoco el owner.** Sin ella, un administrador
   * se auto-otorga `staff` y R1 deja de significar algo. */
  it("R3: el caller que se apunta a sí mismo → 403 `self_permission_edit`", () => {
    expect(() => assertNotSelf("u-1", "u-1")).toThrowError(
      expect.objectContaining({ status: 403, code: "self_permission_edit" }),
    );
    expect(() => assertNotSelf("u-1", "u-2")).not.toThrow();
  });
});
