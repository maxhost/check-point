import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 0087 — **el cuerpo del renombre y la DERIVACION del handle, sin base.**
 *
 * Lo que este archivo SI puede ver: que `permissions` se rechaza por PRESENCIA DE LA CLAVE
 * (ORACULO DE M1 y M2), que los tres `code` del nombre son los del alta, y que la derivacion
 * excluye el handle del propio target (ORACULO DE M3) y sigue pasando por `nextSuggestion`
 * (ORACULO DE M4).
 *
 * Lo que NO puede ver, y por eso vive en `staff-rename.neon.integration.test.ts`: que lo
 * GUARDADO sea el nombre y el handle nuevos, y que el `business_id` del `UPDATE` aisle de
 * verdad. Acá la base es un doble: un `WHERE` sin `business_id` pasaria igual.
 */

/** Las filas que devuelve el `select` de handles del negocio. */
let takenRows: Array<{ handle: string | null; userId: string }> = [];
/** Lo que devuelve el `returning` del `UPDATE` de la membresia. `[]` = no matcheo nada. */
let updatedRows: Array<Record<string, unknown>> = [];
/** Lo que devuelve la lectura de desempate (`rejectionFor`). */
let targetRows: Array<{ role: string }> = [];
/** Lo que se le pidio escribir a cada `.set(...)`, en orden. */
let sets: Array<Record<string, unknown>> = [];
/** Lo que el `returning` del `UPDATE` TIRA en vez de resolver: la carrera del unico. */
let updateError: unknown = null;

vi.mock("./db", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where", "insert", "update", "delete"]) {
    chain[m] = () => chain;
  }
  chain.set = (value: Record<string, unknown>) => {
    sets.push(value);
    return chain;
  };
  chain.limit = () => Promise.resolve(targetRows);
  chain.returning = () =>
    updateError ? Promise.reject(updateError) : Promise.resolve(updatedRows);
  // El `select` de `freeHandle` se `await`ea sobre el `.where(...)`.
  chain.then = (resolve: (v: unknown[]) => unknown) => resolve(takenRows);
  return { getDb: () => chain };
});

import { parseRenameInput, renameStaff } from "./staff-rename";

const business = { id: "b1", slug: "la-farmacia" };
const CARLA = "carla-user";

const fila = (overrides: Record<string, unknown> = {}) => ({
  role: "staff",
  status: "active",
  permissions: ["counter"],
  handle: "el-que-se-guardo",
  createdAt: new Date(0),
  ...overrides,
});

afterEach(() => {
  takenRows = [];
  updatedRows = [];
  targetRows = [];
  sets = [];
  updateError = null;
});

describe("el cuerpo del renombre (spec 0087 §3)", () => {
  it.each([
    ["null", null],
    ["un string", "Carla"],
    ["un array", ["Carla"]],
    ["un numero", 7],
  ])("%s no es un objeto → `invalid_body`", (_label, value) => {
    expect(() => parseRenameInput(value)).toThrowError(
      expect.objectContaining({ status: 400, code: "invalid_body" }),
    );
  });

  it.each([
    ["ausente", {}],
    ["vacio", { name: "" }],
    ["solo espacios", { name: "   " }],
    ["no es string", { name: 42 }],
  ])("`name` %s → `name_required`", (_label, value) => {
    expect(() => parseRenameInput(value)).toThrowError(
      expect.objectContaining({ status: 400, code: "name_required" }),
    );
  });

  it("81 caracteres → `name_too_long`, 80 pasa", () => {
    expect(() => parseRenameInput({ name: "a".repeat(81) })).toThrowError(
      expect.objectContaining({ status: 400, code: "name_too_long" }),
    );
    expect(parseRenameInput({ name: "a".repeat(80) }).name).toHaveLength(80);
  });

  it("`name` se `trim`ea", () => {
    expect(parseRenameInput({ name: "  Carla Gómez  " }).name).toBe(
      "Carla Gómez",
    );
  });

  /**
   * ORACULO DE M1 y M2 — el punto de la spec. Se mira **si la clave esta**, no que valor
   * trae: `null`, `[]` y los permisos que el integrante ya tiene entran por la misma puerta.
   * Un chequeo por valor («es distinto del actual») dejaria pasar el tercero, y con el la
   * politica de autorizacion de los permisos al camino de codigo del nombre (ADR 0080 §2).
   */
  it.each([
    ["una lista", ["staff"]],
    ["los permisos ACTUALES", ["counter"]],
    ["null", null],
    ["lista vacia", []],
    ["un string", "counter"],
    ["undefined explicito", undefined],
  ])(
    "`permissions` presente como %s → 400 `permissions_not_here`",
    (_label, permissions) => {
      expect(() =>
        parseRenameInput({ name: "Carla", permissions }),
      ).toThrowError(
        expect.objectContaining({
          status: 400,
          code: "permissions_not_here",
        }),
      );
    },
  );

  it("sin la clave `permissions` el cuerpo pasa", () => {
    expect(parseRenameInput({ name: "Carla" })).toEqual({ name: "Carla" });
  });

  it("el rechazo de `permissions` NO escribe nada", async () => {
    updatedRows = [fila()];
    await expect(
      renameStaff(business, CARLA, { name: "Carla", permissions: ["staff"] }),
    ).rejects.toMatchObject({ code: "permissions_not_here" });
    expect(sets).toEqual([]);
  });
});

describe("la derivacion del handle al renombrar (spec 0087 §1)", () => {
  /** ORACULO DE M3 — el handle que el target tiene HOY no cuenta como ocupado. Sin la
   * exclusion, «Carla» → «Carla» devolveria `carla-2` y el sufijo se bumpearia en CADA
   * renombre. */
  it("renombrar a un nombre que slugifica IGUAL no bumpea el sufijo", async () => {
    takenRows = [{ handle: "carla", userId: CARLA }];
    updatedRows = [fila({ handle: "carla" })];
    const staff = await renameStaff(business, CARLA, { name: "Carla" });
    expect(sets[0]).toEqual({ handle: "carla" });
    expect(staff.identifier).toBe("carla@la-farmacia");
  });

  /** ORACULO DE M4 — el handle de OTRO integrante sigue ocupado: la exclusion es del target,
   * no de la lista entera. */
  it("el handle de OTRO integrante sufija", async () => {
    takenRows = [
      { handle: "carla", userId: CARLA },
      { handle: "marcos", userId: "otro-user" },
    ];
    updatedRows = [fila({ handle: "marcos-2" })];
    await renameStaff(business, CARLA, { name: "Marcos" });
    expect(sets[0]).toEqual({ handle: "marcos-2" });
  });

  /** ORACULO DE M4 — las reservadas siguen cubiertas **gratis** porque la derivacion pasa por
   * `nextSuggestion`. Con `slugify` pelado, «Admin» se quedaria con `admin`. */
  it("un nombre que slugifica a una RESERVADA no la toma", async () => {
    takenRows = [{ handle: "carla", userId: CARLA }];
    updatedRows = [fila({ handle: "admin-2" })];
    await renameStaff(business, CARLA, { name: "Admin" });
    expect(sets[0]).toEqual({ handle: "admin-2" });
  });

  it("escribe el nombre en `user` DESPUES del handle, y devuelve el DTO sin secretos", async () => {
    takenRows = [{ handle: "carla", userId: CARLA }];
    updatedRows = [fila({ handle: "carla-gomez" })];
    const staff = await renameStaff(business, CARLA, { name: "Carla Gómez" });
    expect(sets).toEqual([{ handle: "carla-gomez" }, { name: "Carla Gómez" }]);
    expect(staff).toEqual({
      userId: CARLA,
      name: "Carla Gómez",
      identifier: "carla-gomez@la-farmacia",
      role: "staff",
      status: "active",
      permissions: ["counter"],
      createdAt: new Date(0).toISOString(),
    });
  });
});

describe("los rechazos que se deciden sobre la fila (spec 0087 §2)", () => {
  /** El `UPDATE` no matcheo y la lectura de desempate dice `owner`: R4, el mismo `code` y el
   * mismo status que `setStaffStatus`. Y **no se escribio el nombre**. */
  it("apuntar al OWNER → 409 `target_is_owner`, sin escribir el nombre", async () => {
    updatedRows = [];
    targetRows = [{ role: "owner" }];
    await expect(
      renameStaff(business, "owner-user", { name: "Otro" }),
    ).rejects.toMatchObject({ status: 409, code: "target_is_owner" });
    expect(sets).toEqual([{ handle: "otro" }]);
  });

  it("un id que no matchea nada → 404 `staff_not_found`", async () => {
    updatedRows = [];
    targetRows = [];
    await expect(
      renameStaff(business, "fantasma", { name: "Otro" }),
    ).rejects.toMatchObject({ status: 404, code: "staff_not_found" });
  });

  /** La carrera que el TOCTOU de `freeHandle` deja abierta, igual que en el alta: quien
   * decide es el indice unico, no la lectura previa, y el `23505` sale como 409 `handle_taken`
   * —el `code` del contrato— y no como el 503 de una base caida. */
  it("el choque del unico del handle es 409 `handle_taken`", async () => {
    updateError = { code: "23505" };
    await expect(
      renameStaff(business, CARLA, { name: "Carla" }),
    ).rejects.toMatchObject({ status: 409, code: "handle_taken" });
  });

  it("un fallo cualquiera del `UPDATE` se re-lanza (la ruta lo vuelve 503)", async () => {
    updateError = new Error("boom");
    await expect(
      renameStaff(business, CARLA, { name: "Carla" }),
    ).rejects.toThrowError("boom");
  });
});
