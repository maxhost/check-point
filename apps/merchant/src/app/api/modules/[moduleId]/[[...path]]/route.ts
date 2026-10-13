import {
  type DispatchParams,
  dispatchModuleRequest,
} from "../../../../../modules/dispatch";

export const dynamic = "force-dynamic";

type Context = { params: Promise<DispatchParams> };

/**
 * Spec 0216 / ADR 0139 §4 — `/api/modules/<id>/…`: UN archivo de ruta para todos los modulos. El
 * toggle (`PUT` sin `path`) y la tabla de rutas de cada modulo los resuelve `modules/dispatch.ts`.
 */
export async function GET(request: Request, { params }: Context) {
  return dispatchModuleRequest("GET", request, await params);
}

export async function POST(request: Request, { params }: Context) {
  return dispatchModuleRequest("POST", request, await params);
}

export async function PUT(request: Request, { params }: Context) {
  return dispatchModuleRequest("PUT", request, await params);
}

export async function PATCH(request: Request, { params }: Context) {
  return dispatchModuleRequest("PATCH", request, await params);
}

export async function DELETE(request: Request, { params }: Context) {
  return dispatchModuleRequest("DELETE", request, await params);
}
