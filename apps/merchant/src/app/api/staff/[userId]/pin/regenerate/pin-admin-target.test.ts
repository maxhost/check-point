import { describe, expect, it, vi } from "vitest";

/**
 * EL CABLEADO DE R5 EN EL PIN (`POST /api/staff/:userId/pin/regenerate`).
 *
 * La regla pura ya tiene su bateria en `server/staff-admin-target.test.ts`; esto prueba que la
 * RUTA la llama. Se escribe porque en esta misma sesion se midio que una regla igual de
 * correcta, sin este test, se podia sacar del writer con 1.293 tests en verde.
 *
 * Y cubre el invariante que hace segura la consulta nueva: **si el `select` previo no trae
 * fila, la ruta NO rechaza** — sigue hasta el `UPDATE`, cuyo `WHERE` conserva `business_id` y
 * `role='staff'`, y sale por el `404` de siempre. Sin eso, un target de otro negocio pasaria de
 * «no existe» a «existe y no puedo», que es la filtracion que el 404 evita.
 */
type FilaDelTarget = { permissions: string[] } | null;
const estado: { fila: FilaDelTarget; actualizado: boolean } = {
  fila: { permissions: [] },
  actualizado: false,
};

vi.mock("../../../_auth", () => ({
  requireStaffAccess: vi.fn(async () => ({
    business: { id: "b-1", slug: "bar" },
    userId: "u-caller",
    role: rolDelCaller.valor,
  })),
  staffError: (error: unknown) => ({ __error: error }),
}));

/** El hash del PIN pasa por better-auth, que sin `BETTER_AUTH_SECRET` tira. Se dobla porque
 * este test es del GUARD, no de la criptografia del PIN —que tiene la suya en
 * `staff-pin.test.ts`—; sin el doble, el camino feliz moriria por una env faltante y el rojo
 * hablaria del setup y no de la propiedad. */
vi.mock("../../../../../../server/staff-pin", () => ({
  generatePin: () => "123456",
  hashPin: async () => "hash-de-prueba",
}));

vi.mock("../../../../../../server/db", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "where", "update", "set", "delete"]) {
    chain[m] = () => chain;
  }
  chain.limit = () => Promise.resolve(estado.fila ? [estado.fila] : []);
  chain.returning = () => {
    estado.actualizado = true;
    return Promise.resolve([]);
  };
  return { getDb: () => chain };
});

const rolDelCaller = { valor: "staff" };

const { POST } = await import("./route");

const pedido = (targetId: string) =>
  POST(
    new Request("http://local/api/staff/x/pin/regenerate", {
      method: "POST",
    }),
    { params: Promise.resolve({ userId: targetId }) },
  );

describe("R5 cableada en la regeneracion de PIN", () => {
  it("un administrador NO le regenera el PIN a otro administrador", async () => {
    rolDelCaller.valor = "staff";
    estado.fila = { permissions: ["staff"] };
    estado.actualizado = false;
    const respuesta = (await pedido("u-otro-admin")) as unknown as {
      __error: { status: number; code: string };
    };
    expect(respuesta.__error).toMatchObject({
      status: 403,
      code: "target_is_administrator",
    });
    // Lo importante: rechazo ANTES de escribir. Un PIN rotado y despues rechazado dejaria al
    // integrante sin poder entrar.
    expect(estado.actualizado).toBe(false);
  });

  it("un administrador SÍ le regenera el PIN a un integrante común", async () => {
    rolDelCaller.valor = "staff";
    estado.fila = { permissions: ["counter"] };
    estado.actualizado = false;
    await pedido("u-comun");
    expect(estado.actualizado).toBe(true);
  });

  it("el OWNER puede sobre un administrador", async () => {
    rolDelCaller.valor = "owner";
    estado.fila = { permissions: ["staff"] };
    estado.actualizado = false;
    await pedido("u-otro-admin");
    expect(estado.actualizado).toBe(true);
  });

  /** El aislamiento: sin fila en el `select`, la ruta NO rechaza — deja que el `UPDATE`
   * scopeado conteste, que es lo que produce el 404 y no filtra existencia. */
  it("sin fila previa sigue hasta el UPDATE, que es quien contesta", async () => {
    rolDelCaller.valor = "staff";
    estado.fila = null;
    estado.actualizado = false;
    await pedido("u-de-otro-negocio");
    expect(estado.actualizado).toBe(true);
  });
});
