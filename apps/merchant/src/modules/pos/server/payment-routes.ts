import { NextResponse } from "next/server";
import type { ModuleRoute } from "../../route-table";
import { listPaymentMethods } from "./payment-methods";
import { posRoute, readPosBody } from "./http";
import { withDbTransaction } from "@mi-pasaporte/db";
import { paymentStorageReady } from "../../../server/business/storage";
import * as core from "../../../server/business/payment-methods";
import * as legacy from "./payment-admin-bridge";
// Temporary ADR0150 bridge. Retire these administration routes only after cutover.
const storage = <T>(run: (api: typeof core | typeof legacy) => Promise<T>) =>
  withDbTransaction(async (tx) =>
    run((await paymentStorageReady(tx)) ? core : legacy),
  );
/** POS consumes active public metadata; administration belongs to core Negocio. */
export const paymentRoutes: readonly ModuleRoute[] = [
  posRoute({
    method: "GET",
    path: "payment-method-catalog",
    permission: "business",
    failure: "No pudimos leer el catálogo.",
    handler: async ({ business }) =>
      NextResponse.json(
        await storage((api) => api.listPaymentCatalog(business.id)),
      ),
  }),
  posRoute({
    method: "POST",
    path: "payment-methods",
    permission: "business",
    failure: "No pudimos agregar el medio.",
    handler: async ({ business, request }) => {
      const input = await readPosBody(request);
      return NextResponse.json(
        {
          method: await storage((api) =>
            api.createPaymentMethod(business.id, input),
          ),
        },
        { status: 201 },
      );
    },
  }),
  posRoute({
    method: "POST",
    path: "payment-methods/:id/archive",
    permission: "business",
    failure: "No pudimos archivar el medio.",
    handler: async ({ business, params }) =>
      NextResponse.json({
        method: await storage((api) =>
          api.archivePaymentMethod(business.id, params.id),
        ),
      }),
  }),
  posRoute({
    method: "GET",
    path: "payment-methods",
    failure: "No pudimos leer los medios de pago.",
    handler: async ({ business }) =>
      NextResponse.json(await listPaymentMethods(business.id)),
  }),
];
