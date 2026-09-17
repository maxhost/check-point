import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
 *
 * **Spec 0068 §3** lo extiende a las 4 rutas de staff de OWNER + el `PATCH` del slug, donde
 * `requireStaffOwner` quedaba FUERA del `try`: resolver la sesión también consulta la base,
 * así que ese fallo salía como **500 sin `code`**. Para que el caso sea el correcto, el mock
 * de sesión devuelve **`emailVerified: true`**: con el email sin verificar el gate contestaría
 * 403 antes de tocar la base y este archivo pasaría por el motivo equivocado.
 */

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({
    api: {
      getSession: async () => ({
        // `emailVerified: true` A PROPÓSITO — ver el docblock: sin esto el gate de email
        // cortaría con 403 y el 503 de abajo nunca se ejercitaría.
        user: { id: "u1", emailVerified: true },
      }),
    },
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
    // `orderBy` es parte del camino de `ownerContext` (spec 0068 §3). Sin él la cadena
    // devolvía `undefined` y la ruta moría con un **TypeError del doble**, no con el fallo
    // de base: el 503 salía igual y el test habría pasado por el motivo equivocado.
    "orderBy",
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
import { GET as LIST, POST as CREATE } from "../app/api/staff/route";
import { POST as REGENERATE } from "../app/api/staff/[userId]/pin/regenerate/route";
import { POST as STATUS } from "../app/api/staff/[userId]/status/route";
import { PATCH as SLUG } from "../app/api/merchant/business/slug/route";

const post = (path: string, body: unknown) =>
  new Request(`http://localhost:3001${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const params = { params: Promise.resolve({ userId: "u2" }) };

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

/**
 * Spec 0068 §3 — las rutas de OWNER. El fallo de base ocurre **en la resolución de la
 * sesión** (`ownerContext` consulta `memberships`), que es exactamente el tramo que antes
 * quedaba fuera del `try`. Si el guard vuelve a salir del `try`, Next contesta 500 y no
 * hay `code`: estos casos se ponen rojos.
 */
describe("un fallo de base EN LA SESIÓN sale 503 con `code`, no 500 pelado", () => {
  /**
   * El 503 tiene que venir del RECHAZO DE LA BASE, no de un `TypeError` del doble: las
   * rutas loguean el `name` de lo que cazaron, así que se lee de ahí. Sin este control, un
   * doble incompleto (le faltaba `orderBy`) daba 503 igual y el caso pasaba por el motivo
   * equivocado.
   */
  const expectDbFailure = () => {
    expect(errors.at(-1)).toMatchObject({ name: "Error" });
  };
  let errors: Array<{ name: string }> = [];

  beforeEach(() => {
    errors = [];
    vi.spyOn(console, "error").mockImplementation(
      (_message?: unknown, payload?: unknown) => {
        errors.push(payload as { name: string });
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POST /api/staff", async () => {
    const response = await CREATE(post("/api/staff", { name: "Ana" }));
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("staff_unavailable");
    expectDbFailure();
  });

  it("GET /api/staff", async () => {
    const response = await LIST(
      new Request("http://localhost:3001/api/staff", { method: "GET" }),
    );
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("staff_unavailable");
    expectDbFailure();
  });

  it("POST /api/staff/[userId]/pin/regenerate", async () => {
    const response = await REGENERATE(
      post("/api/staff/u2/pin/regenerate", {}),
      params,
    );
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("staff_unavailable");
    expectDbFailure();
  });

  it("POST /api/staff/[userId]/status", async () => {
    const response = await STATUS(
      post("/api/staff/u2/status", { status: "disabled" }),
      params,
    );
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("staff_unavailable");
    expectDbFailure();
  });

  it("PATCH /api/merchant/business/slug", async () => {
    const response = await SLUG(
      new Request("http://localhost:3001/api/merchant/business/slug", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: "lo-que-sea" }),
      }),
    );
    expect(response.status).toBe(503);
    // El slug traduce con su propio `catch`, así que su `code` es el suyo — lo que el
    // contrato prohíbe es el 500 SIN `code`.
    expect((await response.json()).code).toBe("slug_unavailable");
    expectDbFailure();
  });
});
