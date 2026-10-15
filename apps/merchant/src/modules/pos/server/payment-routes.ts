import { NextResponse } from "next/server";
import type { ModuleRoute } from "../../route-table";
import {
  archivePaymentMethod,
  createPaymentMethod,
  listPaymentCatalog,
  listPaymentMethods,
} from "./payment-methods";
import { posRoute, readPosBody } from "./http";
export const paymentRoutes: readonly ModuleRoute[] = [
  posRoute({
    method: "GET",
    path: "payment-methods",
    failure: "No pudimos leer los medios de pago.",
    handler: async ({ business, request }) =>
      NextResponse.json(
        await listPaymentMethods(
          business.id,
          new URL(request.url).searchParams.get("status"),
        ),
      ),
  }),
  posRoute({
    method: "GET",
    path: "payment-method-catalog",
    failure: "No pudimos leer el catálogo de medios de pago.",
    handler: async ({ business }) =>
      NextResponse.json(await listPaymentCatalog(business.id)),
  }),
  posRoute({
    method: "POST",
    path: "payment-methods",
    failure: "No pudimos agregar el medio de pago.",
    handler: async ({ business, request }) =>
      NextResponse.json(
        {
          method: await createPaymentMethod(
            business.id,
            await readPosBody(request),
          ),
        },
        { status: 201 },
      ),
  }),
  posRoute({
    method: "POST",
    path: "payment-methods/:id/archive",
    failure: "No pudimos archivar el medio de pago.",
    handler: async ({ business, params }) =>
      NextResponse.json({
        method: await archivePaymentMethod(business.id, params.id),
      }),
  }),
];
