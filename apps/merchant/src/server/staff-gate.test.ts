import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 0068 §1/§3 — **el gate de `requireStaffAccess` es FAIL-CLOSED**, probado sobre el
 * `GET /api/staff` sin base.
 *
 * Por qué no alcanza la integración: en la base `merchant_auth.user.email_verified` es
 * `boolean NOT NULL DEFAULT false` (`schema/auth.ts:10`), así que una sesión real **nunca**
 * trae `undefined` y el caso que distingue `!== true` de `=== false` es inalcanzable desde
 * ahí. Acá la sesión es un doble y el `undefined` se puede producir: es la única forma de
 * ver que un `emailVerified` ausente **cierra** en vez de abrir.
 *
 * El orden de los chequeos también se asevera acá (sesión → membresía → alcance → email): un
 * caller sin membresía activa recibe `not_member` aunque su email no esté verificado.
 */

let sessionUser: Record<string, unknown> | null = null;
/** Filas que devuelve `membershipContext`. Vacío = la sesión no tiene membresía activa. */
let ownerRows: Array<Record<string, unknown>> = [];

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({
    api: {
      getSession: async () => (sessionUser ? { user: sessionUser } : null),
    },
  }),
}));

vi.mock("./db", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "innerJoin", "where", "orderBy"]) {
    chain[m] = () => chain;
  }
  // `membershipContext` cierra con `.limit(1)`; `listStaff` se `await`ea sobre el `.orderBy(...)`.
  chain.limit = () => Promise.resolve(ownerRows);
  chain.then = (resolve: (v: unknown[]) => unknown) => resolve([]);
  return { getDb: () => chain };
});

import { GET } from "../app/api/staff/route";

const get = () =>
  GET(new Request("http://localhost:3001/api/staff", { method: "GET" }));

// Spec 0072: el resolvedor selecciona ademas el eje `status`, y el guard es fail-closed —
// una fila sin `status` NO opera.
//
// Spec 0086: la fila es ahora la de `membershipContext` y trae `role` y `permissions`. Para
// un OWNER, `permissions` es `'{}'` por el `CHECK 2` y el paso 3 lo deja pasar sin mirarla
// (`hasScope`). Edicion del FIXTURE: las aserciones de este archivo no cambian.
const owner = [
  {
    id: "b1",
    slug: "la-farmacia",
    countryCode: "EC",
    currencyCode: "USD",
    status: "active",
    suspensionReason: null,
    role: "owner",
    permissions: [],
  },
];

beforeEach(() => {
  sessionUser = null;
  ownerRows = [];
});

describe("GET /api/staff — el gate (spec 0068 §1)", () => {
  it("sin sesión → 401 `unauthorized`", async () => {
    const response = await get();
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("unauthorized");
  });

  it("owner verificado → 200 con la lista", async () => {
    sessionUser = { id: "u1", emailVerified: true };
    ownerRows = owner;
    const response = await get();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ staff: [] });
  });

  it("owner con `emailVerified: false` → 403 `email_not_verified`", async () => {
    sessionUser = { id: "u1", emailVerified: false };
    ownerRows = owner;
    const response = await get();
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("email_not_verified");
  });

  it("owner SIN la clave `emailVerified` → 403 igual: el gate es fail-closed", async () => {
    // El caso que la integración no puede dar. `!== true` cierra con `undefined`;
    // `=== false` lo dejaría pasar y este integrante entraría al listado.
    sessionUser = { id: "u1" };
    ownerRows = owner;
    const response = await get();
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("email_not_verified");
  });

  /** **CAMBIO DE CONTRATO de la spec 0086**: esta superficie ya no contesta `not_owner`.
   * Sin membresía activa es `not_member` (paso 2); con membresía y sin el toggle es
   * `missing_permission` (paso 3). `not_owner` sobrevive **solo** en las cuatro superficies
   * de la CUENTA (ADR 0079 §8). */
  it("una sesión sin membresía activa → `not_member`, NUNCA `email_not_verified`", async () => {
    // El orden es la regla, no una optimización: el email de un integrante es sintético y
    // nunca se verifica, así que con el gate adelantado recibiría un código que le pide
    // hacer algo que no puede hacer.
    sessionUser = { id: "u2" };
    ownerRows = [];
    const response = await get();
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("not_member");
  });

  /** El paso 3, con su control positivo en el mismo archivo: el integrante SIN el toggle
   * `staff` no entra, y el que lo tiene sí — aunque su email nunca esté verificado, porque
   * el paso 4 no lo alcanza (es la mutación M3). */
  it("un INTEGRANTE sin el permiso `staff` → `missing_permission`", async () => {
    sessionUser = { id: "u3", emailVerified: false };
    ownerRows = [{ ...owner[0], role: "staff", permissions: ["counter"] }];
    const response = await get();
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("missing_permission");
  });

  it("un INTEGRANTE CON el permiso `staff` y sin email verificado → 200", async () => {
    sessionUser = { id: "u4", emailVerified: false };
    ownerRows = [{ ...owner[0], role: "staff", permissions: ["staff"] }];
    const response = await get();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ staff: [] });
  });
});
