import { NextResponse } from "next/server";
import type { ModuleRoute, ModuleServer } from "../../route-table";
import { ModuleError } from "../../errors";
import { createCost, editCost, stopCost } from "./writers";
import { getCost, listCosts, listLocations, listPeople } from "./queries";
import { totals } from "./totals";
import { staffLocationsChanged } from "./salary";
import { commissionSubscriptions } from "./commissions/apply";

const query = (request: Request, name: string) =>
  new URL(request.url).searchParams.get(name);
async function body(request: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new ModuleError(400, "invalid_body", "El cuerpo no es válido.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ModuleError(400, "invalid_body", "El cuerpo no es válido.");
  return value as Record<string, unknown>;
}

const handlers: readonly ModuleRoute[] = [
  {
    method: "GET",
    path: "locations",
    failure: "No pudimos leer los locales.",
    handler: async ({ business }) =>
      NextResponse.json({ locations: await listLocations(business.id) }),
  },
  {
    method: "GET",
    path: "people",
    failure: "No pudimos leer el personal.",
    handler: async ({ business, request }) =>
      NextResponse.json({
        people: await listPeople(business.id, query(request, "month")),
      }),
  },
  {
    method: "POST",
    path: "costs",
    failure: "No pudimos crear el costo.",
    handler: async ({ business, request }) =>
      NextResponse.json(
        { cost: await createCost(business.id, await body(request)) },
        { status: 201 },
      ),
  },
  {
    method: "PUT",
    path: "costs/:costId/period",
    failure: "No pudimos guardar el costo.",
    handler: async ({ business, request, params }) =>
      NextResponse.json({
        cost: await editCost(business.id, params.costId, await body(request)),
      }),
  },
  {
    method: "POST",
    path: "costs/:costId/stop",
    failure: "No pudimos dar de baja el costo.",
    handler: async ({ business, request, params }) =>
      NextResponse.json({
        cost: await stopCost(business.id, params.costId, await body(request)),
      }),
  },
  {
    method: "GET",
    path: "costs",
    failure: "No pudimos leer los costos.",
    handler: async ({ business, request }) =>
      NextResponse.json(
        await listCosts(
          business.id,
          query(request, "locationId"),
          query(request, "month"),
        ),
      ),
  },
  {
    method: "GET",
    path: "costs/:costId",
    failure: "No pudimos leer el costo.",
    handler: async ({ business, request, params }) =>
      NextResponse.json({
        cost: await getCost(
          business.id,
          params.costId,
          query(request, "month"),
        ),
      }),
  },
  {
    method: "GET",
    path: "totals",
    failure: "No pudimos leer los totales.",
    handler: async ({ business, request }) =>
      NextResponse.json(
        await totals(
          business.id,
          query(request, "month"),
          query(request, "locationId"),
        ),
      ),
  },
];

export const routes: readonly ModuleRoute[] = handlers.map((route) => ({
  ...route,
  handler: async (context) => {
    try {
      return await route.handler(context);
    } catch (error) {
      if (error instanceof ModuleError) throw error;
      throw new ModuleError(
        503,
        "costs_unavailable",
        "No pudimos acceder a los costos. Intenta de nuevo.",
      );
    }
  },
}));

export const server: ModuleServer = {
  routes,
  staffLocationsChanged,
  eventSubscriptions: commissionSubscriptions,
};
