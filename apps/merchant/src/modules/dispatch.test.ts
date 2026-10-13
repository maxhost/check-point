import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModuleError } from "./errors";
import type { ModuleRoute } from "./route-table";

/**
 * Spec 0216 §Plan 2 — EL ORDEN DEL DESPACHADOR de `/api/modules/<id>/…`, sin base: los 404/405 se
 * deciden ANTES de la escalera de acceso (no la llaman), la escalera recibe el permiso de la ruta
 * (por defecto el del modulo), el handler recibe `params` y un error se traduce con `failure`. El
 * mismo orden contra Neon y con sesiones reales: `modules-dispatch.neon.integration.test.ts`.
 *
 * Dobles: `./guard` (la escalera), `../server/api-owner` (el toggle), `./activation` y la tabla de
 * rutas (`./server-registry`) con handlers falsos. El registro de manifiestos es el real.
 */

const h = vi.hoisted(() => ({
  access: vi.fn(),
  ownerAccess: vi.fn(),
  owner: vi.fn(),
  setEnabled: vi.fn(),
  handler: vi.fn(),
}));

vi.mock("./guard", () => ({
  requireModuleAccess: h.access,
  requireModuleOwnerAccess: h.ownerAccess,
}));
vi.mock("../server/api-owner", () => ({
  requireApiOwner: h.owner,
  apiOwnerFailureResponse: () => new Response(null, { status: 401 }),
}));
vi.mock("./activation", () => ({ setModuleEnabled: h.setEnabled }));
vi.mock("./server-registry", () => {
  const route = (
    method: ModuleRoute["method"],
    path: string,
    permission?: string,
    owner?: true,
  ): ModuleRoute => ({
    method,
    path,
    permission,
    owner,
    failure: "No pudimos.",
    handler: (ctx) => h.handler(method, path, ctx),
  });
  return {
    // Spec 0220: el registro de servidor pasa a `{ routes, beforeDisable? }` por modulo.
    SERVER_MODULES: {
      stock: {
        routes: [
          route("GET", "items"),
          route("PATCH", "items/:itemId"),
          route("GET", "report", "catalog"),
          route("PUT", "settings", undefined, true),
        ],
      },
      recipes: { routes: [route("GET", "")] },
    },
  };
});

const { dispatchModuleRequest } = await import("./dispatch");

const request = (method = "GET") =>
  new Request("http://localhost/api/modules/x", { method });

const BUSINESS = { id: "b1", currencyCode: "ARS", status: "active" };

beforeEach(() => {
  for (const fn of Object.values(h)) fn.mockReset();
  h.access.mockResolvedValue({ business: BUSINESS, userId: "u1" });
  h.ownerAccess.mockResolvedValue({ business: BUSINESS, userId: "owner-1" });
  h.handler.mockResolvedValue(NextResponse.json({ ok: true }));
});

describe("despachador de /api/modules (spec 0216)", () => {
  it.each([
    ["GET", "nope", ["items"], 404, "module_not_found"],
    ["GET", "stock", ["nope"], 404, "route_not_found"],
    ["DELETE", "stock", ["items"], 405, "method_not_allowed"],
    ["GET", "stock", [], 405, "method_not_allowed"],
    ["POST", "recipes", [], 405, "method_not_allowed"],
  ])(
    "%s %s/%s → %i %s, sin llamar a la escalera",
    async (method, moduleId, path, status, code) => {
      const r = await dispatchModuleRequest(method, request(method), {
        moduleId,
        path: path.length > 0 ? path : undefined,
      });
      expect(r.status).toBe(status);
      expect((await r.json()).code).toBe(code);
      expect(h.access).not.toHaveBeenCalled();
      expect(h.ownerAccess).not.toHaveBeenCalled();
      expect(h.handler).not.toHaveBeenCalled();
    },
  );

  it("una ruta encontrada pasa por la escalera con el permiso del modulo y el handler recibe params", async () => {
    const r = await dispatchModuleRequest("PATCH", request("PATCH"), {
      moduleId: "stock",
      path: ["items", "i-9"],
    });
    expect(r.status).toBe(200);
    expect(h.access).toHaveBeenCalledWith(
      expect.any(Request),
      "stock",
      "stock",
    );
    expect(h.handler).toHaveBeenCalledWith(
      "PATCH",
      "items/:itemId",
      expect.objectContaining({
        // ADR 0141 §8: el contexto lleva lo que ya trajo la escalera (moneda y estado).
        business: { id: "b1", currencyCode: "ARS", status: "active" },
        userId: "u1",
        params: { itemId: "i-9" },
      }),
    );
    expect(h.ownerAccess).not.toHaveBeenCalled();
  });

  it("ADR 0141 §7 — una ruta `owner: true` va por la escalera del owner, no por la del permiso", async () => {
    const r = await dispatchModuleRequest("PUT", request("PUT"), {
      moduleId: "stock",
      path: ["settings"],
    });
    expect(r.status).toBe(200);
    expect(h.ownerAccess).toHaveBeenCalledWith(expect.any(Request), "stock");
    expect(h.access).not.toHaveBeenCalled();
    expect(h.handler).toHaveBeenCalledWith(
      "PUT",
      "settings",
      expect.objectContaining({ business: BUSINESS, userId: "owner-1" }),
    );
  });

  it("si la escalera del owner corta (p. ej. un integrante → not_owner), el handler no corre", async () => {
    h.ownerAccess.mockResolvedValue({
      response: NextResponse.json({ code: "not_owner" }, { status: 403 }),
    });
    const r = await dispatchModuleRequest("PUT", request("PUT"), {
      moduleId: "stock",
      path: ["settings"],
    });
    expect(r.status).toBe(403);
    expect((await r.json()).code).toBe("not_owner");
    expect(h.handler).not.toHaveBeenCalled();
  });

  it("la ruta puede pedir otro permiso; la base de un modulo con ruta base despacha", async () => {
    await dispatchModuleRequest("GET", request(), {
      moduleId: "stock",
      path: ["report"],
    });
    expect(h.access).toHaveBeenLastCalledWith(
      expect.any(Request),
      "stock",
      "catalog",
    );
    await dispatchModuleRequest("GET", request(), { moduleId: "recipes" });
    expect(h.access).toHaveBeenLastCalledWith(
      expect.any(Request),
      "recipes",
      "recipes",
    );
    expect(h.handler).toHaveBeenLastCalledWith("GET", "", expect.anything());
  });

  it("si la escalera corta, su respuesta sale tal cual y el handler no corre", async () => {
    h.access.mockResolvedValue({
      response: NextResponse.json(
        { code: "missing_permission" },
        { status: 403 },
      ),
    });
    const r = await dispatchModuleRequest("GET", request(), {
      moduleId: "stock",
      path: ["items"],
    });
    expect(r.status).toBe(403);
    expect((await r.json()).code).toBe("missing_permission");
    expect(h.handler).not.toHaveBeenCalled();
  });

  it("un ModuleError del handler sale con su status y code; otro error, 503 con `failure`", async () => {
    h.handler.mockRejectedValueOnce(
      new ModuleError(404, "item_not_found", "Ese insumo no existe."),
    );
    const notFound = await dispatchModuleRequest("PATCH", request("PATCH"), {
      moduleId: "stock",
      path: ["items", "ajeno"],
    });
    expect(notFound.status).toBe(404);
    expect((await notFound.json()).code).toBe("item_not_found");

    vi.spyOn(console, "error").mockImplementation(() => {});
    h.handler.mockRejectedValueOnce(new Error("boom"));
    const failed = await dispatchModuleRequest("GET", request(), {
      moduleId: "stock",
      path: ["items"],
    });
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ error: "No pudimos." });
  });

  it("PUT sin path es el toggle del core (owner), no la escalera del modulo", async () => {
    h.owner.mockResolvedValue({ business: { id: "b1" } });
    h.setEnabled.mockResolvedValue({ id: "recipes", enabled: true });
    const r = await dispatchModuleRequest(
      "PUT",
      new Request("http://localhost/api/modules/recipes", {
        method: "PUT",
        body: JSON.stringify({ enabled: true }),
      }),
      { moduleId: "recipes" },
    );
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      module: { id: "recipes", enabled: true },
    });
    expect(h.setEnabled).toHaveBeenCalledWith("b1", "recipes", {
      enabled: true,
    });
    expect(h.access).not.toHaveBeenCalled();
  });
});
