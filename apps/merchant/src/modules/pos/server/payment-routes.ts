import { NextResponse } from "next/server";
import type { ModuleRoute } from "../../route-table";
import { listPaymentMethods } from "./payment-methods";
import { posRoute } from "./http";
/** POS consumes active public metadata; administration belongs to core Negocio. */
export const paymentRoutes: readonly ModuleRoute[] = [
  posRoute({
    method: "GET",
    path: "payment-methods",
    failure: "No pudimos leer los medios de pago.",
    handler: async ({ business }) =>
      NextResponse.json(await listPaymentMethods(business.id)),
  }),
];
