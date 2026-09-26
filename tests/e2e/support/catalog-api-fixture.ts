import type { Page } from "@playwright/test";

export async function catalogApiFixture(page: Page, empty = false) {
  const categories = empty
    ? []
    : [
        { id: "category-first", name: "Bebidas" },
        { id: "category-second", name: "Postres" },
      ];
  const product = (id: string, name: string, categoryId: string | null) => ({
    id,
    name,
    categoryId,
    unitPrice: 3,
    unitCost: null,
    imagePath: null,
    imageVersion: 0,
    imageSource: null,
    imageAuthor: null,
    imageAuthorUrl: null,
    imageSourceUrl: null,
    availableAllLocations: true,
    locationIds: [],
  });
  const products = empty
    ? []
    : [
        product("product-first", "Café", "category-first"),
        product("product-second", "Torta", "category-second"),
      ];
  const state = {
    categories,
    products,
    locations: [{ id: "location-one", name: "Centro" }],
    writes: [] as Array<{
      method: string;
      path: string;
      body: Record<string, unknown>;
    }>,
    progress: [] as string[],
    failWrite: false,
    failRead: false,
    importing: false,
    failProgress: false,
    importStatus: "analyzing",
    importId: "import-one",
    cancellations: 0,
  };
  const result = {
    categoriesCreated: 1,
    categoriesReused: 0,
    productsCreated: 1,
    productsSkipped: 0,
    productsWithoutPrice: 1,
    discardedCount: 0,
    discarded: [],
  };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const body =
      request.headers()["content-type"]?.includes("application/json") &&
      request.postData()
        ? request.postDataJSON()
        : {};
    const json = (payload: unknown, status = 200) =>
      route.fulfill({ status, json: payload });
    if (url.pathname === "/api/onboarding/checklist")
      return json({
        locale: "es",
        items: [
          {
            id: "verify-email",
            anchor: "verify-email",
            position: 1,
            required: true,
            done: true,
            title: "Email",
            body: "",
          },
          {
            id: "catalog",
            anchor: "catalog",
            position: 2,
            required: false,
            done: Boolean(state.progress.length),
            title: "Catálogo",
            body: "Aprendé a usar tu catálogo",
          },
        ],
      });
    if (url.pathname === "/api/onboarding/tours/catalog") {
      if (state.failProgress) return json({ error: "Prueba de error" }, 503);
      state.progress.push(body.status);
      return json({ ok: true });
    }
    if (url.pathname === "/api/catalog") {
      if (state.failRead) return json({ error: "No se pudo actualizar" }, 503);
      return json({
        products: state.products,
        categories: state.categories,
        locations: state.locations,
        currencyCode: "USD",
        importInProgress: state.importing,
      });
    }
    if (url.pathname.startsWith("/api/catalog/imports")) {
      const imported = {
        id: state.importId,
        status: state.importStatus,
        expiresAt: "2030-01-01T00:00:00Z",
        result: state.importStatus === "accepted" ? result : null,
      };
      if (method === "DELETE") {
        state.cancellations++;
        state.importing = false;
        return json({ ok: true });
      }
      if (method === "POST" && !url.pathname.endsWith("analyze")) {
        state.importing = true;
        state.writes.push({ method, path: url.pathname, body });
        return json(
          {
            import: { ...imported, status: "pending_upload" },
            uploads: body.files.map(
              (file: { contentType: string }, index: number) => ({
                fileId: String(index),
                url: `${url.origin}/api/qa-upload/${index}`,
                method: "PUT",
                headers: { "content-type": file.contentType },
              }),
            ),
          },
          201,
        );
      }
      if (method === "POST") return json({ import: imported }, 202);
      return json({
        import:
          url.pathname === "/api/catalog/imports" && !state.importing
            ? null
            : imported,
      });
    }
    if (url.pathname.startsWith("/api/qa-upload"))
      return route.fulfill({ status: 200 });
    if (
      url.pathname.startsWith("/api/catalog/") &&
      ["POST", "PUT", "DELETE"].includes(method)
    ) {
      state.writes.push({ method, path: url.pathname, body });
      if (state.failWrite)
        return json({ error: "No pudimos guardar el producto." }, 503);
      const kind = url.pathname.split("/")[3];
      const id = url.pathname.split("/")[4];
      if (kind === "category") {
        if (method === "DELETE") {
          state.categories = state.categories.filter((item) => item.id !== id);
          state.products.forEach((item) => {
            if (item.categoryId === id) item.categoryId = null;
          });
          return json({ ok: true });
        }
        if (method === "POST") {
          const created = { id: "category-new", name: body.name };
          state.categories.push(created);
          return json(created, 201);
        }
        const item = state.categories.find((item) => item.id === id)!;
        item.name = body.name;
        return json(item);
      }
      if (method === "DELETE") {
        state.products = state.products.filter((item) => item.id !== id);
        return json({ ok: true });
      }
      if (method === "POST") {
        const created = {
          ...product("product-new", body.name, body.categoryId),
          ...body,
        };
        state.products.push(created);
        return json(created, 201);
      }
      const item = state.products.find((item) => item.id === id)!;
      Object.assign(item, body);
      return json(item);
    }
    return json({ ok: true });
  });
  return state;
}
