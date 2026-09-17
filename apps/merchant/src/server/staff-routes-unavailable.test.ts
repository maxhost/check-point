import { describe, expect, it, vi } from "vitest";

/**
 * Spec 0067 — **el 503 `staff_unavailable` que el contrato declara para TODAS las rutas
 * tiene que salir de verdad** (`docs/specs/0067-contratos-de-api.md`, «Convenciones»).
 *
 * Existe porque un revisor independiente cazó exactamente esto: el login del staff y el
 * cambio de PIN tenían su único `try` alrededor de `request.json()`, así que un fallo de
 * base escapaba y Next contestaba **500 sin `code`** — un código declarado en el contrato
 * y no emitido por la ruta, que el DoD de la spec cuenta como FAIL.
 *
 * La sonda no dobla la ruta: hace fallar la BASE (que es el modo de fallo real) y mira el
 * status y el `code` de la respuesta.
 */

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({
    api: { getSession: async () => ({ user: { id: "u1" } }) },
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
    "innerJoin",
    "insert",
    "values",
    "update",
    "set",
    "delete",
  ]) {
    chain[m] = () => chain;
  }
  const boom = () => Promise.reject(new Error("la base se cayó"));
  chain.limit = boom;
  chain.returning = boom;
  chain.then = (_: unknown, reject: (e: unknown) => unknown) =>
    reject(new Error("la base se cayó"));
  return { getDb: () => chain };
});

import { POST as LOGIN } from "../app/api/merchant/auth/staff/route";
import { POST as CHANGE } from "../app/api/staff/[userId]/pin/route";

const post = (path: string, body: unknown) =>
  new Request(`http://localhost:3001${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("un fallo de base sale como 503 `staff_unavailable`, no como 500", () => {
  it("POST /api/merchant/auth/staff", async () => {
    const response = await LOGIN(
      post("/api/merchant/auth/staff", {
        identifier: "ana@la-farmacia",
        pin: "123456",
      }),
    );
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("staff_unavailable");
  });

  it("POST /api/staff/[userId]/pin", async () => {
    const response = await CHANGE(
      post("/api/staff/u1/pin", {
        currentPin: "123456",
        newPin: "654321",
      }),
      { params: Promise.resolve({ userId: "u1" }) },
    );
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("staff_unavailable");
  });
});
