import { beforeEach, describe, expect, it, vi } from "vitest";
import { matchRoute } from "../../route-table";

/**
 * Spec 0182 → 0220 — LAS RUTAS DE MESAS toman el negocio del CONTEXTO (la sesion que resolvio el
 * despachador), nunca del cuerpo ni de la query, y piden el permiso `locations`. Mudado de las
 * cuatro filas de mesas de `server/locations-routes-support.ts` (las rutas `api/locations/:id/tables`
 * se borraron): cada llamada lleva un `businessId` AJENO en el cuerpo o en la query y el dominio
 * tiene que recibir el del contexto. El dominio va doblado; la escalera la prueba `dispatch.test.ts`
 * y el aislamiento contra Neon, `tables.neon.integration.test.ts`.
 */

const h = vi.hoisted(() => ({
  listTables: vi.fn(),
  createTable: vi.fn(),
  updateTable: vi.fn(),
  setTableStatus: vi.fn(),
}));
vi.mock("./manage", () => h);

const { server } = await import("./routes");

const CALLER = {
  id: "11111111-1111-4111-8111-111111111111",
  currencyCode: "ARS",
  status: "active",
};
const FOREIGN_BUSINESS = "22222222-2222-4222-8222-222222222222";
const LOCATION = "33333333-3333-4333-8333-333333333333";
const TABLE = "44444444-4444-4444-8444-444444444444";

async function call(method: string, segments: string[], body?: unknown) {
  const match = matchRoute(server.routes, method, segments);
  if (match.kind !== "found") throw new Error(`sin ruta: ${method}`);
  expect(match.route.permission).toBe("locations");
  const url = `https://merchant.test/api/modules/tables/${segments.join("/")}?businessId=${FOREIGN_BUSINESS}`;
  return match.route.handler({
    request: new Request(url, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    business: CALLER,
    userId: "u1",
    params: match.params,
  });
}

beforeEach(() => {
  for (const fn of Object.values(h)) fn.mockReset().mockResolvedValue({});
});

describe("rutas de Mesas (spec 0220)", () => {
  it.each([
    ["GET", ["locations", LOCATION], undefined, h.listTables],
    [
      "POST",
      ["locations", LOCATION],
      { name: "Mesa", businessId: FOREIGN_BUSINESS },
      h.createTable,
    ],
    [
      "PATCH",
      ["locations", LOCATION, TABLE],
      { name: "X", businessId: FOREIGN_BUSINESS },
      h.updateTable,
    ],
    [
      "POST",
      ["locations", LOCATION, TABLE, "status"],
      { status: "archived", businessId: FOREIGN_BUSINESS },
      h.setTableStatus,
    ],
  ] as const)(
    "%s %j → el dominio recibe el negocio del contexto",
    async (method, segments, body, spy) => {
      const response = await call(method, [...segments], body);
      expect(response.status).toBeLessThan(300);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toEqual(CALLER);
      expect(spy.mock.calls[0][1]).toBe(LOCATION);
    },
  );
});
