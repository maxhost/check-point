import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 0068 §1/§3 — **el gate de `requireStaffOwner` es FAIL-CLOSED**, probado sobre el
 * `GET /api/staff` sin base.
 *
 * Por qué no alcanza la integración: en la base `merchant_auth.user.email_verified` es
 * `boolean NOT NULL DEFAULT false` (`schema/auth.ts:10`), así que una sesión real **nunca**
 * trae `undefined` y el caso que distingue `!== true` de `=== false` es inalcanzable desde
 * ahí. Acá la sesión es un doble y el `undefined` se puede producir: es la única forma de
 * ver que un `emailVerified` ausente **cierra** en vez de abrir.
 *
 * El orden de los chequeos también se asevera acá (sesión → owner → email): un caller sin
 * membresía de owner recibe `not_owner` aunque su email no esté verificado.
 */

let sessionUser: Record<string, unknown> | null = null;
/** Filas que devuelve `ownerContext`. Vacío = la sesión no es owner de nada activo. */
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
  // `ownerContext` cierra con `.limit(1)`; `listStaff` se `await`ea sobre el `.orderBy(...)`.
  chain.limit = () => Promise.resolve(ownerRows);
  chain.then = (resolve: (v: unknown[]) => unknown) => resolve([]);
  return { getDb: () => chain };
});

import { GET } from "../app/api/staff/route";

const get = () =>
  GET(new Request("http://localhost:3001/api/staff", { method: "GET" }));

const owner = [{ id: "b1", slug: "la-farmacia", currencyCode: "USD" }];

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

  it("una sesión que no es owner → `not_owner`, NUNCA `email_not_verified`", async () => {
    // El orden es la regla, no una optimización: el email de un integrante es sintético y
    // nunca se verifica, así que con el gate adelantado recibiría un código que le pide
    // hacer algo que no puede hacer.
    sessionUser = { id: "u2" };
    ownerRows = [];
    const response = await get();
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("not_owner");
  });
});
