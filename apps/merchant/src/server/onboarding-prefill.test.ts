import { describe, expect, it, vi } from "vitest";

/**
 * Spec 0155 (contrato P3) — `GET /api/onboarding/prefill` pasa a ser PUBLICA y solo trae
 * las categorias: el paso 1 del alta va antes que el email, sin sesion (ADR 0121 §1).
 *
 * La sesion se dobla para que LANCE si alguien la vuelve a pedir: un `getSession` agregado
 * a la ruta cerraria el paso 1 a todo visitante, y este test lo pondria en rojo.
 */
const getSession = vi.fn(async () => {
  throw new Error("prefill no debe leer la sesión");
});
vi.mock("./auth", () => ({
  getMerchantAuth: () => ({ api: { getSession } }),
}));

const { GET } = await import("../app/api/onboarding/prefill/route");

describe("GET /api/onboarding/prefill (spec 0155, P3)", () => {
  it("sin sesion responde 200 con las 15 categorias, sin leer la sesion", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.categories).toHaveLength(15);
    expect(body.categories[0]).toEqual({
      gcid: "gcid:restaurant",
      displayName: "Restaurante",
    });
    expect(getSession).not.toHaveBeenCalled();
  });

  it("ya no trae countries, suggestedCountryCode ni bias", async () => {
    const body = await (await GET()).json();
    expect(Object.keys(body)).toEqual(["categories"]);
  });
});
