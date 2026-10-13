import { NextResponse } from "next/server";
import { readModuleBody } from "../../errors";
import type { ModuleRoute } from "../../route-table";
import { createItem, listItems, updateItem } from "../items";
import { listMovements, recordAdjustment, recordPurchase } from "../movements";
import { listLog, recordEntry } from "../entries";
import { buildDraft } from "../draft";

/**
 * Spec 0210 / 0212 / 0216 — LA API DE STOCK, bajo `/api/modules/stock/…`. Los mismos handlers que
 * vivian en `app/api/modules/stock/**`, con las mismas URLs, cuerpos y status. El despachador
 * (`modules/dispatch.ts`) aplica antes el permiso `stock` y el modulo encendido, y convierte un
 * `ModuleError` (o el 503 con `failure`) en la respuesta.
 */

const query = (request: Request, name: string) =>
  new URL(request.url).searchParams.get(name);

export const routes: readonly ModuleRoute[] = [
  /** `?status=active|archived|all` → `200 { items }`. */
  {
    method: "GET",
    path: "items",
    failure: "No pudimos leer los insumos.",
    handler: async ({ request, business }) =>
      NextResponse.json({
        items: await listItems(business.id, query(request, "status")),
      }),
  },
  /** `{ name, unit }` → `201 { item }`. */
  {
    method: "POST",
    path: "items",
    failure: "No pudimos crear el insumo.",
    handler: async ({ request, business }) =>
      NextResponse.json(
        { item: await createItem(business.id, await readModuleBody(request)) },
        { status: 201 },
      ),
  },
  /** `{ name?, status? }` → `200 { item }`. */
  {
    method: "PATCH",
    path: "items/:itemId",
    failure: "No pudimos guardar el insumo.",
    handler: async ({ request, business, params }) =>
      NextResponse.json({
        item: await updateItem(
          business.id,
          params.itemId,
          await readModuleBody(request),
        ),
      }),
  },
  /** `{ quantity, totalCost, occurredAt?, note? }` → `201`. */
  {
    method: "POST",
    path: "items/:itemId/purchases",
    failure: "No pudimos registrar la compra.",
    handler: async ({ request, business, userId, params }) =>
      NextResponse.json(
        await recordPurchase(
          business.id,
          userId,
          params.itemId,
          await readModuleBody(request),
        ),
        { status: 201 },
      ),
  },
  /** `{ countedQuantity, note? }` → `201`. */
  {
    method: "POST",
    path: "items/:itemId/adjustments",
    failure: "No pudimos registrar el ajuste.",
    handler: async ({ request, business, userId, params }) =>
      NextResponse.json(
        await recordAdjustment(
          business.id,
          userId,
          params.itemId,
          await readModuleBody(request),
        ),
        { status: 201 },
      ),
  },
  /** `?limit=50` (tope 200), del mas reciente al mas viejo → `200 { movements }`. */
  {
    method: "GET",
    path: "items/:itemId/movements",
    failure: "No pudimos leer los movimientos.",
    handler: async ({ request, business, params }) =>
      NextResponse.json({
        movements: await listMovements(
          business.id,
          params.itemId,
          query(request, "limit"),
        ),
      }),
  },
  /** Spec 0210 §Entradas: varias compras en una entrada → `201`. */
  {
    method: "POST",
    path: "entries",
    failure: "No pudimos registrar la entrada.",
    handler: async ({ request, business, userId }) =>
      NextResponse.json(
        await recordEntry(business.id, userId, await readModuleBody(request)),
        { status: 201 },
      ),
  },
  /** Spec 0212: el texto dictado → borrador de lineas. No guarda stock. */
  {
    method: "POST",
    path: "entries/draft",
    failure: "No pudimos analizar el texto.",
    handler: async ({ request, business, userId }) =>
      NextResponse.json(
        await buildDraft(business.id, userId, await readModuleBody(request)),
      ),
  },
  /** El registro de todos los insumos, `?limit=50` → `200 { movements }`. */
  {
    method: "GET",
    path: "movements",
    failure: "No pudimos leer el registro de stock.",
    handler: async ({ request, business }) =>
      NextResponse.json({
        movements: await listLog(business.id, query(request, "limit")),
      }),
  },
];
