import type { PosWorld } from "../../pos/server/pos-integration-support";
import { callModuleRoute } from "../../modules-integration-support";

/** Spec 0182 / 0220 — las rutas de mesas con la cookie del caller (el `Response` crudo), ahora bajo
 * el despachador (`/api/modules/tables/locations/:locationId/…` y `/api/modules/pos/tables`). Sin
 * `expect`: los oraculos viven en `tables.neon.integration.test.ts`. */

const base = (locationId: string) =>
  `/api/modules/tables/locations/${locationId}`;

export const tables = {
  list: (cookie: string, locationId: string) =>
    callModuleRoute("GET", base(locationId), cookie),
  create: (cookie: string, locationId: string, body: unknown) =>
    callModuleRoute("POST", base(locationId), cookie, body),
  update: (cookie: string, locationId: string, id: string, body: unknown) =>
    callModuleRoute("PATCH", `${base(locationId)}/${id}`, cookie, body),
  status: (cookie: string, locationId: string, id: string, status: string) =>
    callModuleRoute("POST", `${base(locationId)}/${id}/status`, cookie, {
      status,
    }),
  pos: (cookie: string, locationId: string) =>
    callModuleRoute(
      "GET",
      `/api/modules/pos/tables?locationId=${locationId}`,
      cookie,
    ),
};

export async function newTable(w: PosWorld, name: string, seats?: number) {
  const response = await tables.create(w.ownerCookie, w.seed.locationId, {
    name,
    seats,
  });
  if (response.status !== 201)
    throw new Error(`newTable: ${response.status} ${await response.text()}`);
  return (await response.json()).table as { id: string; name: string };
}
