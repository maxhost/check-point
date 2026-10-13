import { describe, expect, it } from "vitest";
import { type ModuleRoute, matchRoute } from "./route-table";

/** Spec 0216 — como el despachador busca una ruta en la tabla de un modulo. */

const route = (method: ModuleRoute["method"], path: string): ModuleRoute => ({
  method,
  path,
  failure: "x",
  handler: async () => new Response(null),
});

const TABLE = [
  route("GET", ""),
  route("GET", "items"),
  route("POST", "items"),
  route("PATCH", "items/:itemId"),
  route("POST", "items/:itemId/purchases"),
];

describe("matchRoute (spec 0216)", () => {
  it("literales y :param, con los params capturados", () => {
    const found = matchRoute(TABLE, "POST", ["items", "abc", "purchases"]);
    expect(found).toMatchObject({
      kind: "found",
      route: { method: "POST", path: "items/:itemId/purchases" },
      params: { itemId: "abc" },
    });
    expect(matchRoute(TABLE, "GET", [])).toMatchObject({
      kind: "found",
      route: { path: "" },
      params: {},
    });
  });

  it("el metodo decide entre dos rutas con el mismo patron", () => {
    expect(matchRoute(TABLE, "POST", ["items"])).toMatchObject({
      kind: "found",
      route: { method: "POST", path: "items" },
    });
  });

  it("patron que existe con otro metodo → method_not_allowed con los permitidos", () => {
    expect(matchRoute(TABLE, "DELETE", ["items"])).toEqual({
      kind: "method_not_allowed",
      allow: ["GET", "POST"],
    });
  });

  it("sin patron que coincida → not_found (largo distinto, literal distinto, param vacio)", () => {
    for (const segments of [
      ["items", "a", "b"],
      ["stock"],
      ["items", "", "purchases"],
      ["items", "abc", "purchase"],
    ]) {
      expect(matchRoute(TABLE, "POST", segments), segments.join("/")).toEqual({
        kind: "not_found",
      });
    }
  });
});
