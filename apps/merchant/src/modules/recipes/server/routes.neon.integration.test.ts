import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type ModuleWorld,
  callModuleRoute,
  dropModuleWorld,
  enableModules,
  modulesIntegrationEnabled,
  newItem,
  seedModuleWorld,
  seedProduct,
} from "../../modules-integration-support";

let world: ModuleWorld;
let other: ModuleWorld;
const call = (
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  cookie = world.cookie,
) => callModuleRoute(method, `/api/modules/recipes${path}`, cookie, body);

beforeAll(async () => {
  world = await seedModuleWorld("R1 HTTP");
  other = await seedModuleWorld("R1 HTTP ajeno");
  await enableModules(world, ["stock", "recipes"]);
  await enableModules(other, ["stock", "recipes"]);
}, 240_000);

afterAll(async () => {
  await dropModuleWorld(world);
  await dropModuleWorld(other);
}, 240_000);

describe.skipIf(!modulesIntegrationEnabled)("R1 guarded HTTP contract", () => {
  it("library, composition preview/history and protected archive work without a location", async () => {
    const item = await newItem(world, "Carne");
    const productId = await seedProduct(world, "Docena", "12.00");
    const created = await call("POST", "/library", {
      name: "Empanada",
      lines: [{ itemId: item.id, quantity: "100" }],
    });
    expect(created.status).toBe(201);
    let recipe = (await created.json()).recipe;
    expect(recipe).toMatchObject({
      name: "Empanada",
      status: "active",
      lines: [{ itemId: item.id, quantity: "100.000" }],
    });
    expect(recipe.productId).toBeUndefined();
    const body = {
      isCombo: false,
      recipes: [{ recipeId: recipe.id, quantity: "12.000" }],
      expectedRevisionId: null,
    };
    const previewResponse = await call(
      "POST",
      `/products/${productId}/composition/preview`,
      body,
    );
    expect(previewResponse.status).toBe(200);
    const preview = (await previewResponse.json()).preview;
    expect(preview).toMatchObject({
      productId,
      resolutionId: null,
      ingredients: [
        { itemId: item.id, exactQuantity: "1200.000000", quantity: "1200.000" },
      ],
    });
    const saved = await call("PUT", `/products/${productId}/composition`, body);
    expect(saved.status).toBe(200);
    const composition = (await saved.json()).composition;
    expect(composition).toMatchObject({
      productId,
      isCombo: false,
      recipes: [{ recipeId: recipe.id, quantity: "12.000" }],
    });
    expect(typeof composition.revisionId).toBe("string");
    expect(typeof composition.resolutionId).toBe("string");
    const inUse = await call("POST", `/library/${recipe.id}/archive`, {
      expectedRevisionId: recipe.revisionId,
    });
    expect(inUse.status).toBe(409);
    expect(await inUse.json()).toMatchObject({
      code: "recipe_in_use",
      products: [
        {
          productId,
          productName: "Docena",
          compositionRevisionId: composition.revisionId,
        },
      ],
    });
    const edited = await call("PUT", `/library/${recipe.id}`, {
      name: "Empanada de carne",
      lines: [{ itemId: item.id, quantity: "90" }],
      expectedRevisionId: recipe.revisionId,
    });
    expect(edited.status).toBe(200);
    recipe = (await edited.json()).recipe;
    const reread = await call("GET", `/products/${productId}/composition`);
    const current = (await reread.json()).composition;
    expect(current.revisionId).toBe(composition.revisionId);
    expect(current.resolutionId).not.toBe(composition.resolutionId);
    expect(current.recipes[0].recipeRevisionId).toBe(recipe.revisionId);
    for (const path of [
      `/library/${recipe.id}/revisions`,
      `/products/${productId}/composition/revisions`,
    ]) {
      const response = await call("GET", path + "?limit=1");
      expect(response.status).toBe(200);
      expect((await response.json()).revisions).toHaveLength(1);
    }
    const detached = await call("PUT", `/products/${productId}/composition`, {
      isCombo: false,
      recipes: [],
      expectedRevisionId: composition.revisionId,
    });
    expect(detached.status).toBe(200);
    const archived = await call("POST", `/library/${recipe.id}/archive`, {
      expectedRevisionId: recipe.revisionId,
    });
    expect(archived.status).toBe(200);
    expect((await archived.json()).recipe.status).toBe("archived");
    const historical = await call("GET", `/library/${recipe.id}`);
    expect((await historical.json()).recipe.name).toBe("Empanada de carne");
  }, 240_000);

  it("IDs from another business return404 without exposing names", async () => {
    const created = await call(
      "POST",
      "/library",
      { name: "Secreto ajeno", lines: [] },
      other.cookie,
    );
    expect(created.status).toBe(201);
    const recipe = (await created.json()).recipe;
    const foreignProduct = await seedProduct(other, "Producto secreto", "3.00");
    for (const [method, path, body] of [
      ["GET", `/library/${recipe.id}`, undefined],
      ["GET", `/library/${recipe.id}/revisions`, undefined],
      [
        "PUT",
        `/library/${recipe.id}`,
        { name: "Cambio", lines: [], expectedRevisionId: recipe.revisionId },
      ],
      [
        "POST",
        `/library/${recipe.id}/archive`,
        { expectedRevisionId: recipe.revisionId },
      ],
      ["GET", `/products/${foreignProduct}/composition`, undefined],
    ] as const) {
      const response = await call(method, path, body);
      expect(response.status).toBe(404);
      expect(JSON.stringify(await response.json())).not.toContain("Secreto");
    }
    const productId = await seedProduct(world, "Combo propio", "3.00");
    const foreignComponent = await call(
      "PUT",
      `/products/${productId}/composition`,
      {
        isCombo: false,
        recipes: [{ recipeId: recipe.id, quantity: "1" }],
        expectedRevisionId: null,
      },
    );
    expect(foreignComponent.status).toBe(404);
    const library = await call("GET", "/library?status=all&q=Secreto");
    expect((await library.json()).recipes).toEqual([]);
    const mappings = await call("GET", "/migration-renames");
    expect(mappings.status).toBe(200);
    expect(await mappings.json()).toMatchObject({
      renames: [],
      nextCursor: null,
    });
  }, 240_000);

  it("retired root/product/text/photo/delete endpoints are404, and body validation stays active", async () => {
    const productId = await seedProduct(world, "Legado", "1.00");
    for (const [method, path, body] of [
      ["GET", "", undefined],
      ["GET", `/${productId}`, undefined],
      ["PUT", `/${productId}`, { lines: [] }],
      ["DELETE", `/${productId}`, undefined],
      ["POST", `/${productId}/draft`, { text: "Harina" }],
      ["POST", `/${productId}/draft-photo`, {}],
    ] as const) {
      const response = await call(method, path, body);
      expect(response.status).toBe(404);
      expect((await response.json()).code).toBe("route_not_found");
    }
    const invalid = await call("POST", "/library", []);
    expect(invalid.status).toBe(422);
    expect((await invalid.json()).code).toBe("invalid_body");
    const locations = await call("GET", "/locations");
    expect(locations.status).toBe(200);
    expect((await locations.json()).locations.length).toBeGreaterThan(0);
  }, 240_000);
});
