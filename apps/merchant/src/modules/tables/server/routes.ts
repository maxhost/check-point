import { NextResponse } from "next/server";
import { LocationError } from "../../../server/locations";
import type { ModuleRoute, ModuleServer } from "../../route-table";
import { createTable, listTables, setTableStatus, updateTable } from "./manage";
import { tablesBeforeDisable } from "./module";

/**
 * Spec 0182 / 0220 — LA API DE MESAS, bajo `/api/modules/tables/…` (ADR 0141). Los mismos handlers
 * que vivian en `app/api/locations/[locationId]/tables/**`, con los mismos cuerpos y respuestas. El
 * despachador aplica antes el permiso `locations` (el de Locales, ADR 0131) y Mesas encendido. El
 * negocio sale del contexto (la sesion), nunca del cuerpo ni de la query.
 */

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new LocationError(400, "invalid_body", "El cuerpo no es válido.");
  }
}

/** Un `LocationError` sale como `{ error, code }` con su status; otro error sigue al despachador
 * (503 con el `failure` de la ruta). */
function tablesRoute(route: ModuleRoute): ModuleRoute {
  return {
    ...route,
    permission: "locations",
    handler: async (context) => {
      try {
        return await route.handler(context);
      } catch (error) {
        if (!(error instanceof LocationError)) throw error;
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status },
        );
      }
    },
  };
}

const routes: readonly ModuleRoute[] = [
  /** Las mesas del local, activas y archivadas → `{ tables }`. */
  tablesRoute({
    method: "GET",
    path: "locations/:locationId",
    failure: "No pudimos leer las mesas.",
    handler: async ({ business, params }) =>
      NextResponse.json({
        tables: await listTables(business, params.locationId),
      }),
  }),
  /** `{ name, seats? }` → `201 { table }`. */
  tablesRoute({
    method: "POST",
    path: "locations/:locationId",
    failure: "No pudimos crear la mesa.",
    handler: async ({ request, business, params }) =>
      NextResponse.json(
        {
          table: await createTable(
            business,
            params.locationId,
            await readJson(request),
          ),
        },
        { status: 201 },
      ),
  }),
  /** `{ name?, seats?, sortOrder? }` (`seats: null` la borra). Una mesa no se borra: se archiva. */
  tablesRoute({
    method: "PATCH",
    path: "locations/:locationId/:tableId",
    failure: "No pudimos actualizar la mesa.",
    handler: async ({ request, business, params }) =>
      NextResponse.json({
        table: await updateTable(
          business,
          params.locationId,
          params.tableId,
          await readJson(request),
        ),
      }),
  }),
  /** `{ status: "archived" | "active" }`. Con una orden del POS abierta en la mesa no se archiva
   * (409 `table_has_open_order`). */
  tablesRoute({
    method: "POST",
    path: "locations/:locationId/:tableId/status",
    failure: "No pudimos actualizar la mesa.",
    handler: async ({ request, business, params }) =>
      NextResponse.json({
        table: await setTableStatus(
          business,
          params.locationId,
          params.tableId,
          await readJson(request),
        ),
      }),
  }),
];

export const server: ModuleServer = {
  routes,
  beforeDisable: tablesBeforeDisable,
};
