import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 0150 — la ruta del login de QA (temporal), sin base: `getDb` y
 * `openMerchantSession` son dobles. La ida y vuelta real de la cookie y el 403 por
 * membresia viven en `server/qa-login.neon.integration.test.ts`.
 *
 * El doble de la base contesta SIEMPRE «es owner activo» (una fila con `userId`, la unica
 * columna que la consulta selecciona): asi un 400/404 de aca no puede venir del paso 3.
 */
const dbRows = vi.hoisted(() => ({
  rows: [{ userId: "row" }] as unknown[],
  fail: false,
}));
const openMerchantSession = vi.hoisted(() =>
  vi.fn(async () => "merchant.session_token=tok.sig; Path=/; HttpOnly"),
);

vi.mock("@mi-pasaporte/db", () => {
  const chain = {
    select: () => chain,
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    limit: async () => {
      if (dbRows.fail) throw new Error("db down");
      return dbRows.rows;
    },
  };
  return { getDb: () => chain };
});
vi.mock("../../../../../server/merchant-session", () => ({
  openMerchantSession,
}));

import { GET, POST } from "./route";

const post = (body: string) =>
  new Request("http://localhost:3001/api/merchant/auth/qa-login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });

beforeEach(() => {
  dbRows.rows = [{ userId: "row" }];
  dbRows.fail = false;
  openMerchantSession.mockClear();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("apagado (spec 0150)", () => {
  it.each([undefined, "1", "TRUE", "true "])(
    "QA_LOGIN_ENABLED=%j → 404 en GET y en POST, sin sesion",
    async (value) => {
      vi.stubEnv("QA_LOGIN_ENABLED", value);
      const get = GET();
      expect(get.status).toBe(404);
      expect(await get.json()).toEqual({
        error: "No encontrado.",
        code: "not_found",
      });
      const res = await POST(post(JSON.stringify({ account: "panaderia" })));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        error: "No encontrado.",
        code: "not_found",
      });
      expect(openMerchantSession).not.toHaveBeenCalled();
    },
  );
});

describe("GET prendida (spec 0150)", () => {
  it("200 con las 3 cuentas, en orden y con claves EXACTAS `account`/`label`", async () => {
    vi.stubEnv("QA_LOGIN_ENABLED", "true");
    const res = GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body)).toEqual(["accounts"]);
    expect(body.accounts).toEqual([
      { account: "panaderia", label: "Panaderia" },
      { account: "barberia", label: "Barberia" },
      { account: "gym", label: "Gym" },
    ]);
    for (const entry of body.accounts) {
      expect(Object.keys(entry).sort()).toEqual(["account", "label"]);
    }
  });
});

describe("POST prendida (spec 0150)", () => {
  beforeEach(() => {
    vi.stubEnv("QA_LOGIN_ENABLED", "true");
  });

  it.each([
    ["no es JSON", "{nope"],
    ["account admin", JSON.stringify({ account: "admin" })],
    [
      "account uuid",
      JSON.stringify({ account: "13b520cd-54a7-4acc-9072-06162a7a1993" }),
    ],
    ["account vacio", JSON.stringify({ account: "" })],
    ["account ausente", JSON.stringify({})],
    ["null", "null"],
  ])("%s → 400 invalid_body, nunca abre sesion", async (_name, body) => {
    const res = await POST(post(body));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("invalid_body");
    expect(openMerchantSession).not.toHaveBeenCalled();
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("cuerpo `{ userId }` → 400, sin sesion (el cliente nunca elige el usuario)", async () => {
    const res = await POST(
      post(JSON.stringify({ userId: "13b520cd-54a7-4acc-9072-06162a7a1993" })),
    );
    expect(res.status).toBe(400);
    expect(openMerchantSession).not.toHaveBeenCalled();
  });

  it("un `userId` junto al `account` se ignora: la sesion es la del `user_id` de la tabla", async () => {
    const res = await POST(
      post(JSON.stringify({ account: "barberia", userId: "otro-usuario" })),
    );
    expect(res.status).toBe(200);
    expect(openMerchantSession).toHaveBeenCalledWith(
      "2857ac6d-2df0-4b25-9e45-77ecadea3a32",
    );
  });

  it("valido → 200 redirectTo /backoffice con Set-Cookie, sin permiso de alta, y lo loguea", async () => {
    const res = await POST(post(JSON.stringify({ account: "gym" })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ redirectTo: "/backoffice" });
    expect(res.headers.get("set-cookie")).toBe(
      "merchant.session_token=tok.sig; Path=/; HttpOnly",
    );
    expect(openMerchantSession).toHaveBeenCalledTimes(1);
    expect(openMerchantSession.mock.calls[0]).toEqual([
      "481c2661-a756-48e9-bb15-3b182cb16e49",
    ]);
    expect(console.info).toHaveBeenCalledWith("[qa-login]", "gym");
  });

  it("la base dice que ya no es owner activo → 403 qa_account_unavailable, sin sesion", async () => {
    dbRows.rows = [];
    const res = await POST(post(JSON.stringify({ account: "panaderia" })));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("qa_account_unavailable");
    expect(openMerchantSession).not.toHaveBeenCalled();
  });

  it("error de base → 503 qa_login_unavailable, sin sesion", async () => {
    dbRows.fail = true;
    const res = await POST(post(JSON.stringify({ account: "panaderia" })));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("qa_login_unavailable");
    expect(openMerchantSession).not.toHaveBeenCalled();
  });
});
