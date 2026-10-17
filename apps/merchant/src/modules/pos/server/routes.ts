import { paymentRoutes } from "./payment-routes";
import { paymentResourceProviders } from "./payment-resources";
import { NextResponse } from "next/server";
import {
  CounterError,
  assertLocationInBusiness,
  parseUuid,
} from "@mi-pasaporte/domain/server/counter/core";
import {
  getCouponState,
  removeCoupon,
  resolveScan,
} from "../../../server/counter";
import { businessCatalog } from "../../../server/counter/resolve-catalog";
import type { ModuleRoute, ModuleServer } from "../../route-table";
import { bestSellingProductIds } from "./best-sellers";
import { closePosOrder } from "./close";
import { posOrderId } from "./errors";
import { posRoute, readPosBody } from "./http";
import { listPosOrders } from "./list";
import { posBeforeDisable } from "./module";
import { createPosOrder, updatePosOrder, voidPosOrder } from "./orders";
import { getPosOrder } from "./read";
import { listPosTables } from "./tables";
import {
  parseTicketSettings,
  readTicketSettings,
  saveTicketSettings,
} from "./ticket-settings";

/**
 * Spec 0169 / 0182 / 0184 / 0220 — LA API DEL POS, bajo `/api/modules/pos/…` (ADR 0141). Los mismos
 * handlers que vivian en `app/api/pos/**` y `app/api/merchant/business/ticket`, con los mismos
 * cuerpos y respuestas. El despachador (`modules/dispatch.ts`) aplica antes el permiso `pos` (o el
 * owner, en `ticket-settings`) y el modulo encendido; `posRoute` traduce el `CounterError` del dominio.
 * El toggle es el generico del core (`PUT /api/modules/pos`) con `beforeDisable`.
 */

const query = (request: Request, name: string) =>
  new URL(request.url).searchParams.get(name);

function optionalLocationId(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string")
    throw new CounterError(422, "invalid_input", "El local no es válido.");
  return parseUuid(value, "locationId");
}

const routes: readonly ModuleRoute[] = [
  ...paymentRoutes,
  /** `?locationId=` → el catalogo del mostrador SIN los productos sin precio (el POS cobra a precio
   * de catalogo; precio 0 si) + `bestSellingProductIds`. Un local ajeno o archivado → 422. */
  posRoute({
    method: "GET",
    path: "catalog",
    failure: "No pudimos leer el catálogo.",
    handler: async ({ request, business }) => {
      const raw = query(request, "locationId");
      const locationId = raw
        ? await assertLocationInBusiness(
            business.id,
            parseUuid(raw, "locationId"),
          )
        : null;
      const catalog = await businessCatalog(business.id, locationId);
      const products = catalog.products.filter((p) => p.unitPrice !== null);
      return NextResponse.json({
        ...catalog,
        products,
        bestSellingProductIds: await bestSellingProductIds(
          business.id,
          locationId,
          products.map((product) => product.id),
        ),
      });
    },
  }),
  /** → `{ open, closedToday }`. */
  posRoute({
    method: "GET",
    path: "orders",
    failure: "No pudimos leer las órdenes.",
    handler: async ({ business }) =>
      NextResponse.json(await listPosOrders(business.id)),
  }),
  /** `{ tableLabel | tableId, locationId?, items, note? }` → `201 PosOrder`. */
  posRoute({
    method: "POST",
    path: "orders",
    failure: "No pudimos guardar la orden.",
    handler: async ({ request, business, userId }) =>
      NextResponse.json(
        await createPosOrder(business, userId, await readPosBody(request)),
        { status: 201 },
      ),
  }),
  /** → `PosOrder`; de otro negocio → 404 `unknown_pos_order`. */
  posRoute({
    method: "GET",
    path: "orders/:id",
    failure: "No pudimos leer la orden.",
    handler: async ({ business, params }) =>
      NextResponse.json(await getPosOrder(business.id, posOrderId(params.id))),
  }),
  /** La lista COMPLETA de lineas + `version`. */
  posRoute({
    method: "PUT",
    path: "orders/:id",
    failure: "No pudimos guardar la orden.",
    handler: async ({ request, business, params }) => {
      const id = posOrderId(params.id);
      return NextResponse.json(
        await updatePosOrder(business, id, await readPosBody(request)),
      );
    },
  }),
  /** `{ clientRequestId, version, membershipId?, coupon? }`: sin pase cierra sin acreditar; con
   * pase, la acreditacion del mostrador. */
  posRoute({
    method: "POST",
    path: "orders/:id/close",
    failure: "No pudimos cerrar la venta.",
    handler: async ({ request, business, userId, params }) => {
      const id = posOrderId(params.id);
      return NextResponse.json(
        await closePosOrder(business, userId, id, await readPosBody(request)),
      );
    },
  }),
  /** Anular una orden abierta (idempotente). */
  posRoute({
    method: "POST",
    path: "orders/:id/void",
    failure: "No pudimos anular la orden.",
    handler: async ({ business, userId, params }) =>
      NextResponse.json(
        await voidPosOrder(business, userId, posOrderId(params.id)),
      ),
  }),
  /** El escaneo del pase al cobrar: la MISMA resolucion que `POST /api/counter/resolve`. */
  posRoute({
    method: "POST",
    path: "resolve",
    failure: "No pudimos resolver el código.",
    handler: async ({ request, business }) => {
      const body = await readPosBody(request);
      return NextResponse.json(
        await resolveScan(
          business,
          body.qrToken as string,
          optionalLocationId(body.locationId),
        ),
      );
    },
  }),
  /** `?membershipId=`: igual que el mostrador. */
  posRoute({
    method: "GET",
    path: "coupon-state",
    failure: "No pudimos leer el cupón.",
    handler: async ({ request, business }) =>
      NextResponse.json(
        await getCouponState(business, query(request, "membershipId")),
      ),
  }),
  /** Igual que el mostrador: el cupon vuelve al cliente. */
  posRoute({
    method: "POST",
    path: "coupon-remove",
    failure: "No pudimos quitar el cupón.",
    handler: async ({ request, business }) =>
      NextResponse.json(
        await removeCoupon(business, await readPosBody(request)),
      ),
  }),
  /** `?locationId=` → `{ tables: [{ id, name, seats, openOrderId }] }`; Mesas apagado → `[]`. */
  posRoute({
    method: "GET",
    path: "tables",
    failure: "No pudimos leer las mesas.",
    handler: async ({ request, business }) =>
      NextResponse.json({
        tables: await listPosTables(business.id, query(request, "locationId")),
      }),
  }),
  /** → `{ printingEnabled, showBusinessName, showTable }`: lo que el POS lee al abrir. */
  posRoute({
    method: "GET",
    path: "ticket",
    failure: "No pudimos leer el ajuste del ticket.",
    handler: async ({ business }) =>
      NextResponse.json(await readTicketSettings(business.id)),
  }),
  /** Ajustes del ticket (owner): sin fila, los defaults (impresion apagada). */
  posRoute({
    method: "GET",
    path: "ticket-settings",
    owner: true,
    failure: "No pudimos leer el ajuste del ticket.",
    handler: async ({ business }) =>
      NextResponse.json(await readTicketSettings(business.id)),
  }),
  /** `{ printingEnabled, showBusinessName, showTable }`, los tres booleanos y obligatorios (ninguno
   * obligatorio en `true`) → lo guardado. */
  posRoute({
    method: "PUT",
    path: "ticket-settings",
    owner: true,
    failure: "No pudimos guardar el ajuste del ticket.",
    handler: async ({ request, business }) => {
      const settings = parseTicketSettings(await readPosBody(request));
      if (!settings) {
        return NextResponse.json(
          {
            error:
              "Indica si el negocio imprime tickets y qué bloques muestra.",
            code: "invalid_input",
          },
          { status: 422 },
        );
      }
      return NextResponse.json(await saveTicketSettings(business.id, settings));
    },
  }),
];

export const server: ModuleServer = {
  routes,
  beforeDisable: posBeforeDisable,
  resourceProviders: paymentResourceProviders,
};
