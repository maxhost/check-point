import { beforeEach, describe, expect, it, vi } from "vitest";
import { matchRoute } from "../../route-table";
import type { ModuleRouteContext } from "../../route-table";

const h = vi.hoisted(() => ({
  listLibrary: vi.fn(),
  createRecipe: vi.fn(),
  readLibraryRecipe: vi.fn(),
  updateRecipe: vi.fn(),
  archiveRecipe: vi.fn(),
  listRecipeRevisions: vi.fn(),
  listMigrationRenames: vi.fn(),
  listProducts: vi.fn(),
  readComposition: vi.fn(),
  saveComposition: vi.fn(),
  previewComposition: vi.fn(),
  listCompositionRevisions: vi.fn(),
  buildRecipeDraft: vi.fn(),
  buildRecipePhotoDraft: vi.fn(),
  listLocations: vi.fn(),
}));
vi.mock("./library", () => h);
vi.mock("./compositions", () => h);
vi.mock("../draft", () => h);
vi.mock("../../stock/local", () => h);
vi.mock("./consumption", () => ({ eventSubscriptions: [] }));
import { routes } from "./routes";
import { manifest } from "../manifest";

const business = {
  id: "authenticated-business",
  currencyCode: "USD",
  status: "active",
};
const recipeId = "11111111-1111-4111-8111-111111111111";
const productId = "22222222-2222-4222-8222-222222222222";
async function request(method: string, path: string, body?: unknown) {
  const url = new URL(`http://localhost/api/modules/recipes/${path}`);
  const segments = url.pathname
    .replace("/api/modules/recipes/", "")
    .split("/")
    .filter(Boolean);
  const found = matchRoute(routes, method, segments);
  expect(found.kind).toBe("found");
  if (found.kind !== "found") throw new Error("Missing route");
  const req = new Request(url, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const context: ModuleRouteContext = {
    request: req,
    business,
    userId: "operator",
    params: found.params,
  };
  return { response: await found.route.handler(context), request: req };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("R1 HTTP adapters and legacy removal", () => {
  it("the old product listing is explicitly404 without querying the library", async () => {
    const { response } = await request("GET", "");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "route_not_found" });
    expect(h.listLibrary).not.toHaveBeenCalled();
  });

  it.each(["GET", "PUT", "DELETE"])(
    "retired /productId has no %s handler",
    (method) => {
      expect(matchRoute(routes, method, [productId])).toEqual({
        kind: "not_found",
      });
    },
  );

  it.each(["draft", "draft-photo"])(
    "retired product %s route has no alias",
    (suffix) => {
      expect(matchRoute(routes, "POST", [productId, suffix])).toEqual({
        kind: "not_found",
      });
    },
  );

  it("lists the library with the authenticated business and unchanged pagination/filter input", async () => {
    const page = { recipes: [{ id: recipeId }], nextCursor: "opaque-next" };
    h.listLibrary.mockResolvedValue(page);
    const { response } = await request(
      "GET",
      "library?status=all&q=sopa&limit=7&cursor=opaque",
    );
    expect(await response.json()).toEqual(page);
    expect(h.listLibrary.mock.calls[0][0]).toBe(business.id);
    expect(h.listLibrary.mock.calls[0][1].toString()).toBe(
      "status=all&q=sopa&limit=7&cursor=opaque",
    );
  });

  it("creates an independent recipe without a product or location", async () => {
    const body = { name: "Sopa", lines: [] };
    h.createRecipe.mockResolvedValue({ id: recipeId, ...body });
    const { response } = await request("POST", "library", body);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      recipe: { id: recipeId, ...body },
    });
    expect(h.createRecipe).toHaveBeenCalledWith(business.id, body);
  });

  it.each([
    ["GET", `library/${recipeId}`, "readLibraryRecipe", "recipe", undefined],
    [
      "PUT",
      `library/${recipeId}`,
      "updateRecipe",
      "recipe",
      { name: "Sopa", lines: [], expectedRevisionId: "r" },
    ],
    [
      "POST",
      `library/${recipeId}/archive`,
      "archiveRecipe",
      "recipe",
      { expectedRevisionId: "r" },
    ],
    [
      "GET",
      `products/${productId}/composition`,
      "readComposition",
      "composition",
      undefined,
    ],
    [
      "PUT",
      `products/${productId}/composition`,
      "saveComposition",
      "composition",
      { isCombo: true, recipes: [], expectedRevisionId: null },
    ],
    [
      "POST",
      `products/${productId}/composition/preview`,
      "previewComposition",
      "preview",
      { isCombo: true, recipes: [], expectedRevisionId: null },
    ],
  ] as const)(
    "%s %s forwards the entity ID and preserves the DTO envelope",
    async (method, path, service, envelope, body) => {
      const result = { id: "service-result" };
      h[service].mockResolvedValue(result);
      const { response } = await request(method, path, body);
      expect(await response.json()).toEqual({ [envelope]: result });
      const args =
        body === undefined
          ? [business.id, path.startsWith("library") ? recipeId : productId]
          : [
              business.id,
              path.startsWith("library") ? recipeId : productId,
              body,
            ];
      expect(h[service]).toHaveBeenCalledWith(...args);
    },
  );

  it.each([
    ["products", "listProducts", "products"],
    ["migration-renames", "listMigrationRenames", "renames"],
    [`library/${recipeId}/revisions`, "listRecipeRevisions", "revisions"],
    [
      `products/${productId}/composition/revisions`,
      "listCompositionRevisions",
      "revisions",
    ],
  ] as const)(
    "GET %s keeps paginated history/list envelopes",
    async (path, service, key) => {
      const result = { [key]: [{ id: "historic" }], nextCursor: null };
      h[service].mockResolvedValue(result);
      const { response } = await request("GET", `${path}?limit=5&cursor=old`);
      expect(await response.json()).toEqual(result);
      const args = h[service].mock.calls[0];
      expect(args[0]).toBe(business.id);
      expect(args.at(-1).toString()).toBe("limit=5&cursor=old");
      if (path.includes("/revisions"))
        expect(args[1]).toBe(path.startsWith("library") ? recipeId : productId);
    },
  );

  it("rejects non-object JSON before domain mutation", async () => {
    await expect(request("POST", "library", [])).rejects.toMatchObject({
      status: 422,
      code: "invalid_body",
    });
    expect(h.createRecipe).not.toHaveBeenCalled();
  });

  it("dictation passes a recipe name and authenticated operator, without product identity", async () => {
    const body = { name: "Empanada", text: "para doce uso un kilo" };
    const result = { draft: { yield: 12, lines: [], unparsed: [] } };
    h.buildRecipeDraft.mockResolvedValue(result);
    const { response } = await request("POST", "draft", body);
    expect(await response.json()).toEqual(result);
    expect(h.buildRecipeDraft).toHaveBeenCalledWith(
      business.id,
      "operator",
      body,
    );
  });

  it("photo forwards the original multipart request to the shared validator", async () => {
    h.buildRecipePhotoDraft.mockResolvedValue({ draft: { lines: [] } });
    const { request: req, response } = await request("POST", "draft-photo");
    expect(response.status).toBe(200);
    expect(h.buildRecipePhotoDraft).toHaveBeenCalledWith(
      business.id,
      "operator",
      req,
    );
  });

  it("keeps the localized locations contract while removing old recipe navigation", async () => {
    const locations = { locations: [], defaultLocationId: null };
    h.listLocations.mockResolvedValue(locations);
    expect(await (await request("GET", "locations")).response.json()).toEqual(
      locations,
    );
    expect(h.listLocations).toHaveBeenCalledWith(business.id);
    expect(manifest.navigation).toEqual([]);
    expect(manifest.requires).toEqual(["stock"]);
  });
});
