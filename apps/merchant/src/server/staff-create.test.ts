import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 0067 §4 — el alta del integrante **sin email ni contraseña**, probada sin base.
 *
 * Lo que este archivo SI puede ver (y por eso no espera a la integración): que el cuerpo
 * solo admite `name`, que el `handle` se deriva del nombre pasando por `nextSuggestion`
 * —o sea que una reservada y un nombre sin caracteres latinos no colisionan—, y que el
 * DTO que vuelve al navegador **no lleva el PIN ni su hash**.
 *
 * Lo que NO puede ver, y por eso vive en `staff-pin.neon.integration.test.ts`: que lo
 * PERSISTIDO sea el hash y no el PIN. Acá la base es un doble, así que un `pin_hash` en
 * claro pasaría igual — es la distinción exacta que la mutación #2 del presupuesto ataca.
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
/** Idem para `insert(users).values(...)`: es donde se PERSISTE el email sintetico, que
 * desde la spec 0068 §2 ya no vuelve en ningun DTO. */
let userValues: Record<string, unknown> | null = null;

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
    if ("email" in value) userValues = value;
    return chain;
  };
  chain.limit = () => Promise.resolve([]);
  chain.returning = () => Promise.resolve(insertRows);
  chain.catch = () => Promise.resolve([]);
  chain.then = (resolve: (v: unknown[]) => unknown) => resolve(takenHandles);
  return { getDb: () => chain };
});

import { StaffError } from "./staff";
import { createStaff } from "./staff-create";

const business = { id: "b1", slug: "la-farmacia" };

afterEach(() => {
  takenHandles = [];
  insertRows = [];
  membershipValues = null;
  userValues = null;
});

describe("createStaff: el identificador y el PIN — spec 0067 §4", () => {
  it("devuelve `handle@slug` con el slug del NEGOCIO, no uno del cuerpo", async () => {
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
      { name: "Lucas Pérez", slug: "otro-negocio", permissions: ["counter"] },
      "owner",
    );
    expect(staff.identifier).toBe("lucas-perez@la-farmacia");
  });

  it("no deja que un nombre reservado derive en un handle reservado", async () => {
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
      { name: "Admin", permissions: ["counter"] },
      "owner",
    );
    // `slugify("Admin")` da `admin`, que está en RESERVED_SLUGS: el alta tiene que
    // sufijarlo en vez de entregarlo tal cual.
    expect(staff.identifier).toBe("admin-2@la-farmacia");
  });

  it("resuelve la colisión de dos nombres que colapsan al mismo slug", async () => {
    // `slugify` colapsa a "000" todo nombre sin caracteres latinos ("日本語", "Мир"): sin
    // `nextSuggestion` los dos integrantes chocarían contra el único (business_id, handle).
    insertRows = [
      {
        role: "staff",
        status: "active",
        permissions: ["counter"],
        createdAt: new Date(0),
      },
    ];
    takenHandles = [{ handle: "000" }];
    const { staff } = await createStaff(
      business,
      { name: "日本語", permissions: ["counter"] },
      "owner",
    );
    expect(staff.identifier).toBe("000-2@la-farmacia");
  });

  it("devuelve un PIN de 6 dígitos que NO aparece en el DTO", async () => {
    insertRows = [
      {
        role: "staff",
        status: "active",
        permissions: ["counter"],
        createdAt: new Date(0),
      },
    ];
    const { staff, pin } = await createStaff(
      business,
      { name: "Ana", permissions: ["counter"] },
      "owner",
    );
    expect(pin).toMatch(/^[0-9]{6}$/);
    const serialized = JSON.stringify(staff);
    expect(serialized).not.toContain(pin);
    expect(serialized.toLowerCase()).not.toContain("hash");
    // Allow-list de claves (spec 0068 §2): son SIETE desde la 0086 —`permissions` entra—, y
    // `email` sigue sin estar. Un DTO que vuelva a llevarlo pone este caso en rojo.
    expect(Object.keys(staff).sort()).toEqual([
      "createdAt",
      "identifier",
      "name",
      "permissions",
      "role",
      "status",
      "userId",
    ]);
  });

  it("persiste el hash del PIN y `pin_must_change`, nunca el PIN", async () => {
    insertRows = [
      {
        role: "staff",
        status: "active",
        permissions: ["counter"],
        createdAt: new Date(0),
      },
    ];
    const { pin } = await createStaff(
      business,
      { name: "Ana", permissions: ["counter"] },
      "owner",
    );
    expect(membershipValues).toMatchObject({
      role: "staff",
      status: "active",
      handle: "ana",
      pinMustChange: true,
    });
    expect(membershipValues?.pinHash).toBe(`hashed:${pin}`);
    expect(membershipValues?.pinHash).not.toBe(pin);
  });

  it("el email sintético se PERSISTE pero no se serializa (spec 0068 §2)", async () => {
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
      { name: "Ana", permissions: ["counter"] },
      "owner",
    );
    // Sigue yendo a la base: `merchant_auth.user.email` es NOT NULL con único, así que el
    // alta no puede dejarlo vacío. Se asevera sobre los valores del insert.
    expect(userValues?.email).toMatch(/^staff-.+@staff\.invalid$/);
    expect(userValues?.emailVerified).toBe(false);
    // Y NO vuelve al navegador: ni la clave ni el dominio sintético.
    expect(staff).not.toHaveProperty("email");
    expect(JSON.stringify(staff)).not.toContain("staff.invalid");
  });

  it("traduce el choque del único de handle a un 409", async () => {
    // La carrera que el TOCTOU de la lectura previa deja abierta: quien decide es el
    // índice único, y `23505` tiene que salir como 409 y no como 503.
    await expect(
      createStaffWithInsertError({ code: "23505" }),
    ).rejects.toMatchObject({ status: 409, code: "handle_taken" });
  });

  it("un fallo cualquiera del insert es 503, no 409", async () => {
    await expect(
      createStaffWithInsertError(new Error("boom")),
    ).rejects.toMatchObject({ status: 503, code: "staff_create_failed" });
  });
});

/** Fuerza el error del `returning` del insert de membresía sin tocar el módulo real. */
async function createStaffWithInsertError(error: unknown) {
  const db = (await import("./db")).getDb() as unknown as Record<
    string,
    unknown
  >;
  const previous = db.returning;
  db.returning = () => Promise.reject(error);
  try {
    return await createStaff(
      business,
      { name: "Ana", permissions: ["counter"] },
      "owner",
    );
  } finally {
    db.returning = previous;
  }
}

it("StaffError lleva un `code` estable", () => {
  expect(new StaffError(409, "x", "handle_taken").code).toBe("handle_taken");
});
