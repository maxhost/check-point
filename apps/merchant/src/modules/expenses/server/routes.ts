import { metricTranslators } from "./metrics";
import { NextResponse } from "next/server";
import type { ModuleRoute, ModuleServer } from "../../route-table";
import { ModuleError } from "../../errors";
import { buildDraft, buildPhotoDraft } from "../draft";
import { getContext, listConcepts, listExpenses } from "./queries";
import { createExpenses, mutateExpense } from "./writers";
import { scheduleExpenseDelivery } from "./delivery";
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
    path: "context",
    failure: "No pudimos leer los datos del negocio.",
    handler: async ({ business, request }) =>
      NextResponse.json(
        await getContext(
          business.id,
          new URL(request.url).searchParams.get("locationId"),
        ),
      ),
  },
  {
    method: "GET",
    path: "concepts",
    failure: "No pudimos leer los conceptos.",
    handler: async ({ business }) =>
      NextResponse.json({ concepts: await listConcepts(business.id) }),
  },
  {
    method: "POST",
    path: "entries/draft",
    failure: "No pudimos analizar el gasto.",
    handler: async ({ business, userId, request }) =>
      NextResponse.json(
        await buildDraft(business.id, userId, await body(request)),
      ),
  },
  {
    method: "POST",
    path: "entries/draft-photo",
    failure: "No pudimos analizar las fotos.",
    handler: async ({ business, userId, request }) =>
      NextResponse.json(await buildPhotoDraft(business.id, userId, request)),
  },
  {
    method: "POST",
    path: "entries",
    failure: "No pudimos guardar los gastos.",
    handler: async ({ business, userId, request }) => {
      const result = await createExpenses(
        business.id,
        userId,
        await body(request),
      );
      scheduleExpenseDelivery(business.id);
      return NextResponse.json(result, { status: 201 });
    },
  },
  {
    method: "GET",
    path: "entries",
    failure: "No pudimos leer los gastos.",
    handler: async ({ business, request }) =>
      NextResponse.json({
        expenses: await listExpenses(
          business.id,
          new URL(request.url).searchParams,
        ),
      }),
  },
  {
    method: "PUT",
    path: "entries/:id",
    failure: "No pudimos guardar el gasto.",
    handler: async ({ business, userId, request, params }) => {
      const result = await mutateExpense(
        business.id,
        userId,
        params.id,
        "updated",
        await body(request),
      );
      scheduleExpenseDelivery(business.id);
      return NextResponse.json(result);
    },
  },
  {
    method: "DELETE",
    path: "entries/:id",
    failure: "No pudimos borrar el gasto.",
    handler: async ({ business, userId, request, params }) => {
      const result = await mutateExpense(
        business.id,
        userId,
        params.id,
        "deleted",
        await body(request),
      );
      scheduleExpenseDelivery(business.id);
      return NextResponse.json(result);
    },
  },
];
export const routes: readonly ModuleRoute[] = handlers.map((route) => ({
  ...route,
  permission: "expenses",
  handler: async (context) => {
    try {
      return await route.handler(context);
    } catch (error) {
      if (error instanceof ModuleError) throw error;
      throw new ModuleError(
        503,
        route.path.includes("draft")
          ? "draft_unavailable"
          : "expenses_unavailable",
        route.failure,
      );
    }
  },
}));
export const server: ModuleServer = { metricTranslators, routes };
