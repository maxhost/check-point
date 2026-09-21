import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 0086 §4/§5 — **EL CUERPO DEL ALTA: `name` Y `permissions`**, y R1 aplicada en el
 * WRITER, probado sin base.
 *
 * Archivo propio y no dentro de `staff-create.test.ts` por el hook `file-size` (300
 * líneas): con este bloque adentro ese archivo quedaba en **360**, y la regla del repo es
 * dividir, no extender. **El montaje es el mismo y está duplicado a propósito**: las
 * fábricas de `vi.mock` se hoistean al tope del módulo, así que no se pueden compartir sin
 * un módulo de soporte que los dos importen — y el estado que este archivo necesita
 * (`insertRows`, `membershipValues`) es de tres líneas.
 *
 * Lo que este archivo NO puede ver, y por eso vive en
 * `staff-permissions.neon.integration.test.ts`: que lo ESCRITO en la fila sea la lista
 * normalizada. Acá la base es un doble.
 */

let takenHandles: Array<{ handle: string | null }> = [];
let insertRows: Array<{
  role: string;
  status: string;
  permissions: string[];
  createdAt: Date;
}> = [];
/** Lo que el alta le manda a `insert(memberships).values(...)`, para poder aseverarlo. */
let membershipValues: Record<string, unknown> | null = null;

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({
    $context: Promise.resolve({
      password: {
        hash: async (value: string) => `hashed:${value}`,
        verify: async () => false,
      },
    }),
  }),
}));

vi.mock("./db", () => {
  const chain: Record<string, unknown> = {};
  for (const m of [
    "select",
    "from",
    "where",
    "insert",
    "update",
    "set",
    "delete",
  ]) {
    chain[m] = () => chain;
  }
  chain.values = (value: Record<string, unknown>) => {
    if ("role" in value) membershipValues = value;
    return chain;
  };
  chain.limit = () => Promise.resolve([]);
  chain.returning = () => Promise.resolve(insertRows);
  chain.catch = () => Promise.resolve([]);
  chain.then = (resolve: (v: unknown[]) => unknown) => resolve(takenHandles);
  return { getDb: () => chain };
});

import { createStaff } from "./staff-create";

const business = { id: "b1", slug: "la-farmacia" };

afterEach(() => {
  takenHandles = [];
  insertRows = [];
  membershipValues = null;
});

describe("createStaff: el cuerpo es el nombre Y los permisos — spec 0067 §4 + 0086 §5", () => {
  const cases: Array<[string, unknown, string | undefined]> = [
    ["missing body", null, undefined],
    ["an array", [], undefined],
    ["empty name", { name: "  ", permissions: ["counter"] }, "name_required"],
    [
      "a name over 80 chars",
      { name: "x".repeat(81), permissions: ["counter"] },
      "name_too_long",
    ],
    // Spec 0086 §5: `permissions` es OBLIGATORIO y con al menos un elemento. Dar de alta a
    // alguien que no puede hacer nada no tiene sentido, y para eso existe desactivarlo.
    ["sin `permissions`", { name: "Ana" }, "permissions_required"],
    [
      "`permissions` vacío",
      { name: "Ana", permissions: [] },
      "permissions_required",
    ],
    [
      "`permissions` que no es un arreglo",
      { name: "Ana", permissions: "counter" },
      "permissions_required",
    ],
    [
      "un permiso fuera del catálogo",
      { name: "Ana", permissions: ["counter", "billing"] },
      "unknown_permission",
    ],
  ];
  for (const [label, body, code] of cases) {
    it(`rejects ${label} with 400`, async () => {
      await expect(createStaff(business, body, "owner")).rejects.toMatchObject(
        code ? { status: 400, code } : { status: 400 },
      );
    });
  }

  /** R1 (spec 0086 §4 / ADR 0079 §3.1) — **un administrador no fabrica otro administrador**.
   * Va en el WRITER y no en la ruta, para que cualquier puerta futura la herede. */
  it("un caller no-owner NO puede otorgar `staff` → 403 `permission_not_grantable`", async () => {
    await expect(
      createStaff(business, { name: "Ana", permissions: ["staff"] }, "staff"),
    ).rejects.toMatchObject({
      status: 403,
      code: "permission_not_grantable",
    });
  });

  /** R2 — y SÍ puede otorgar cualquier otro, tenga o no ese permiso él mismo. Es la regla
   * que el owner eligió con su caso textual: *«si creo un admin para staff, y el necesita
   * crear un usuario para marketing, no podria… eso si es ridiculo»*. */
  it("un caller no-owner SÍ otorga un permiso que no es `staff`", async () => {
    insertRows = [
      {
        role: "staff",
        status: "active",
        permissions: ["marketing"],
        createdAt: new Date(0),
      },
    ];
    const { staff } = await createStaff(
      business,
      { name: "Ana", permissions: ["marketing"] },
      "staff",
    );
    expect(staff.permissions).toEqual(["marketing"]);
  });

  it("el alta devuelve los permisos NORMALIZADOS: deduplicados y en el orden del catálogo", async () => {
    insertRows = [
      {
        role: "staff",
        status: "active",
        permissions: ["catalog", "counter"],
        createdAt: new Date(0),
      },
    ];
    const { staff } = await createStaff(
      business,
      { name: "Ana", permissions: ["counter", "catalog", "counter"] },
      "owner",
    );
    expect(staff.permissions).toEqual(["catalog", "counter"]);
    // Y lo que se ESCRIBE en la fila también va normalizado, no como vino.
    expect(membershipValues?.permissions).toEqual(["catalog", "counter"]);
  });

  it("ignora un email y una contraseña en el cuerpo: ya no son parte del alta", async () => {
    insertRows = [
      {
        role: "staff",
        status: "active",
        permissions: ["counter"],
        createdAt: new Date(0),
      },
    ];
    const { staff } = await createStaff(
      business,
      {
        name: "Ana",
        email: "ana@bar.co",
        password: "supersecret",
        permissions: ["counter"],
      },
      "owner",
    );
    expect(staff.identifier).toBe("ana@la-farmacia");
    expect(JSON.stringify(staff)).not.toContain("ana@bar.co");
    expect(JSON.stringify(staff)).not.toContain("supersecret");
  });
});
