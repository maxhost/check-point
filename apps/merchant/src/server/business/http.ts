import { NextResponse } from "next/server";
import { withDbTransaction } from "@mi-pasaporte/db";
import { CounterError, isUuid } from "@mi-pasaporte/domain/server/counter/core";
import { requireApiPermission } from "../api-permission";
import { apiOwnerFailureResponse } from "../api-owner";
import { businessStorageReady } from "./storage";
import {
  listPaymentMethods,
  createPaymentMethod,
  archivePaymentMethod,
} from "./payment-methods";
import { listPaymentCatalog } from "./payment-catalog";
import { listCommissions, saveCommission } from "./commission-config";
import { readSaleCommissions } from "./commission-read";
import { readConfiguration, saveConfiguration } from "./configuration";
import { BusinessError } from "./error";
async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json();
    if (value && typeof value === "object" && !Array.isArray(value))
      return value;
  } catch {
    // Malformed JSON is reported with the same safe body error.
  }
  throw new BusinessError(400, "invalid_body", "El cuerpo no es válido.");
}
export async function businessHttp(request: Request, paths: string[]) {
  const auth = await requireApiPermission(request, "business");
  if ("failure" in auth) return apiOwnerFailureResponse(auth.failure);
  try {
    return await withDbTransaction(async (tx) => {
      if (!(await businessStorageReady(tx)))
        throw new BusinessError(
          503,
          "business_unavailable",
          "Negocio estará disponible al completar la actualización.",
        );
      const id = auth.business.id,
        url = new URL(request.url),
        method = request.method;
      if (
        paths.length === 1 &&
        (paths[0] === "regional" || paths[0] === "fiscal")
      ) {
        if (method === "GET")
          return NextResponse.json(await readConfiguration(id, paths[0]));
        if (method === "PUT")
          return NextResponse.json(
            await saveConfiguration(id, paths[0], await body(request)),
          );
      }
      if (
        paths.length === 1 &&
        paths[0] === "payment-method-catalog" &&
        method === "GET"
      )
        return NextResponse.json(await listPaymentCatalog(id));
      if (paths[0] === "payment-methods") {
        if (paths.length === 1 && method === "GET") {
          const [methods, commissions] = await Promise.all([
            listPaymentMethods(id, url.searchParams.get("status")),
            listCommissions(id),
          ]);
          return NextResponse.json({
            ...methods,
            methods: methods.methods.map((m) => ({
              ...m,
              commission: commissions.methods.find((c) => c.methodId === m.id)!,
            })),
          });
        }
        if (paths.length === 1 && method === "POST")
          return NextResponse.json(
            { method: await createPaymentMethod(id, await body(request)) },
            { status: 201 },
          );
        if (paths.length === 3 && paths[2] === "archive" && method === "POST")
          return NextResponse.json({
            method: await archivePaymentMethod(id, paths[1]),
          });
        if (
          paths.length === 3 &&
          paths[2] === "commission" &&
          method === "PUT"
        ) {
          const input = await body(request);
          if (
            input.fixed !== undefined &&
            input.fixed !== null &&
            typeof input.expectedCurrencyCode !== "string"
          )
            throw new BusinessError(
              422,
              "expected_currency_required",
              "Confirma la moneda del fijo.",
            );
          return NextResponse.json({
            commission: await saveCommission(id, paths[1], input),
          });
        }
      }
      if (
        paths.length === 3 &&
        paths[0] === "sale-commissions" &&
        method === "GET"
      ) {
        if (!/^[a-z][a-z_]{0,39}$/.test(paths[1]) || !isUuid(paths[2]))
          throw new BusinessError(
            404,
            "sale_not_found",
            "Esa venta no existe.",
          );
        return NextResponse.json(
          await readSaleCommissions(
            id,
            paths[2],
            url.searchParams.get("locationId"),
            paths[1],
          ),
        );
      }
      return NextResponse.json(
        { error: "Esa ruta no existe.", code: "not_found" },
        { status: 404 },
      );
    });
  } catch (error) {
    if (error instanceof CounterError)
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    console.error("business_request_failed", {
      name: error instanceof Error ? error.name : typeof error,
    });
    return NextResponse.json(
      {
        error: "No pudimos acceder a la configuración del negocio.",
        code: "business_unavailable",
      },
      { status: 503 },
    );
  }
}
