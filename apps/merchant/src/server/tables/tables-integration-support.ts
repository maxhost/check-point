import type { PosWorld } from "../pos/pos-integration-support";
import { conCookie } from "../permissions-integration-support";
import {
  GET as LIST_TABLES,
  POST as CREATE_TABLE,
} from "../../app/api/locations/[locationId]/tables/route";
import { PATCH as UPDATE_TABLE } from "../../app/api/locations/[locationId]/tables/[tableId]/route";
import { POST as TABLE_STATUS } from "../../app/api/locations/[locationId]/tables/[tableId]/status/route";
import { GET as POS_TABLES } from "../../app/api/pos/tables/route";

/** Spec 0182 — las rutas de mesas con la cookie del caller (el `Response` crudo). Sin `expect`:
 * los oraculos viven en `tables.neon.integration.test.ts`. */

const base = (locationId: string) => `/api/locations/${locationId}/tables`;
const loc = (locationId: string) => ({
  params: Promise.resolve({ locationId }),
});
const tbl = (locationId: string, tableId: string) => ({
  params: Promise.resolve({ locationId, tableId }),
});

export const tables = {
  list: (cookie: string, locationId: string) =>
    LIST_TABLES(conCookie(base(locationId), "GET", cookie), loc(locationId)),
  create: (cookie: string, locationId: string, body: unknown) =>
    CREATE_TABLE(
      conCookie(base(locationId), "POST", cookie, body),
      loc(locationId),
    ),
  update: (cookie: string, locationId: string, id: string, body: unknown) =>
    UPDATE_TABLE(
      conCookie(`${base(locationId)}/${id}`, "PATCH", cookie, body),
      tbl(locationId, id),
    ),
  status: (cookie: string, locationId: string, id: string, status: string) =>
    TABLE_STATUS(
      conCookie(`${base(locationId)}/${id}/status`, "POST", cookie, {
        status,
      }),
      tbl(locationId, id),
    ),
  pos: (cookie: string, locationId: string) =>
    POS_TABLES(
      conCookie(`/api/pos/tables?locationId=${locationId}`, "GET", cookie),
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
