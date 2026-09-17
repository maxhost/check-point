import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spec 0069 §D3 — `GET /api/onboarding/prefill`.
 *
 * Los dos invariantes que esta sonda existe para pinnear:
 *
 * 1. **La lista de países va SIEMPRE completa.** Un `x-vercel-ip-country` de un país no
 *    soportado devuelve `suggestedCountryCode: null` y la lista **intacta**: la
 *    detección es una sugerencia, jamás un filtro (ADR 0070 §14, el caso de la VPN).
 * 2. **El endpoint NO exige email verificado** (ADR 0070 §11). Agregarle ese gate
 *    dejaría el alta cerrada con llave, porque el email se verifica DESPUÉS del wizard.
 */
let session: { user: { id: string; emailVerified: boolean } } | null = null;

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({ api: { getSession: async () => session } }),
}));

const { GET } = await import("../app/api/onboarding/prefill/route");

const get = (headers: Record<string, string> = {}) =>
  GET(new Request("http://localhost:3001/api/onboarding/prefill", { headers }));

beforeEach(() => {
  session = { user: { id: "owner-1", emailVerified: true } };
});

describe("GET /api/onboarding/prefill (spec 0069 §D3)", () => {
  it("sin sesión responde 401 con code", async () => {
    session = null;
    const response = await get();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "No autorizado.",
      code: "unauthorized",
    });
  });

  it("con sesión devuelve los 9 países con su moneda y las 15 categorías", async () => {
    const body = await (await get()).json();
    expect(body.countries).toHaveLength(9);
    expect(body.countries).toContainEqual({
      code: "MX",
      name: "México",
      currencyCode: "MXN",
    });
    expect(body.categories).toHaveLength(15);
    expect(body.categories[0]).toEqual({
      gcid: "gcid:restaurant",
      displayName: "Restaurante",
    });
  });

  it("NO exige email verificado: un owner sin verificar recibe 200", async () => {
    session = { user: { id: "owner-1", emailVerified: false } };
    expect((await get()).status).toBe(200);
  });

  it("respeta x-vercel-ip-country cuando el país está soportado", async () => {
    const body = await (await get({ "x-vercel-ip-country": "MX" })).json();
    expect(body.suggestedCountryCode).toBe("MX");
    expect(body.countries).toHaveLength(9);
  });

  it("acepta el header en minúsculas", async () => {
    const body = await (await get({ "x-vercel-ip-country": "ar" })).json();
    expect(body.suggestedCountryCode).toBe("AR");
  });

  it("un país NO soportado da null y la lista sigue COMPLETA (no se recorta)", async () => {
    const body = await (await get({ "x-vercel-ip-country": "ES" })).json();
    expect(body.suggestedCountryCode).toBeNull();
    expect(body.countries).toHaveLength(9);
    expect(body.countries.map((c: { code: string }) => c.code)).toContain("AR");
  });

  it("sin header de país, la sugerencia es null y la lista sigue completa", async () => {
    const body = await (await get()).json();
    expect(body.suggestedCountryCode).toBeNull();
    expect(body.countries).toHaveLength(9);
  });

  it("arma el bias sólo con las DOS coordenadas", async () => {
    const both = await (
      await get({
        "x-vercel-ip-latitude": "-2.9001",
        "x-vercel-ip-longitude": "-79.0059",
      })
    ).json();
    expect(both.bias).toEqual({ latitude: -2.9001, longitude: -79.0059 });

    const half = await (
      await get({ "x-vercel-ip-latitude": "-2.9001" })
    ).json();
    expect(half.bias).toBeNull();

    const garbage = await (
      await get({
        "x-vercel-ip-latitude": "no-es-un-numero",
        "x-vercel-ip-longitude": "-79.0059",
      })
    ).json();
    expect(garbage.bias).toBeNull();
  });

  it("NO devuelve timezone: lo resuelve el cliente (§D3, escrito en el contrato)", async () => {
    const body = await (await get()).json();
    expect(Object.keys(body).sort()).toEqual([
      "bias",
      "categories",
      "countries",
      "suggestedCountryCode",
    ]);
  });
});
