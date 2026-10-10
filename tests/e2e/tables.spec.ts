import { expect, test, type Page } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
import type { PosOrder } from "../../apps/merchant/src/app/backoffice/pos/pos-types";

const localId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const northId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const tableId = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const secondId = "cccccccc-cccc-4ccc-8ccc-ccccccccccc2";
const orderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const productId = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1";
let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/tables-harness.tsx",
    "pos",
  );
});
test.afterAll(async () => harness.close());

async function setup(page: Page, posEnabled = true) {
  const state = {
    tables: [
      {
        id: tableId,
        locationId: localId,
        name: "Mesa 1",
        status: "active",
        seats: null,
        sortOrder: 0,
        openOrderId: null as string | null,
      },
      {
        id: secondId,
        locationId: localId,
        name: "Mesa 2",
        status: "active",
        seats: null,
        sortOrder: 1,
        openOrderId: "another-order" as string | null,
      },
      {
        id: "archived",
        locationId: localId,
        name: "Mesa archivada",
        status: "archived",
        seats: null,
        sortOrder: 2,
        openOrderId: null as string | null,
      },
    ],
    order: null as PosOrder | null,
    writes: [] as {
      url: string;
      method: string;
      body: Record<string, unknown>;
    }[],
    reads: 0,
    failure: null as { code: string; error: string; status: number } | null,
  };
  await page.route("**/api/merchant/session", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        user: { id: "owner" },
        business: {
          id: "business",
          status: "active",
          posEnabled,
          timezone: "UTC",
          currencyCode: "USD",
        },
        membership: {
          role: "owner",
          status: "active",
          permissions: ["pos", "locations"],
        },
      },
    }),
  );
  await page.route("**/api/pos/ticket", (route) =>
    route.fulfill({ json: { showBusinessName: true, showTable: true } }),
  );
  await page.route("**/api/pos/catalog**", (route) =>
    route.fulfill({
      json: {
        products: [
          {
            id: productId,
            name: "Café",
            unitPrice: 10,
            categoryId: null,
            imagePath: null,
          },
        ],
        categories: [],
        bestSellingProductIds: [],
      },
    }),
  );
  await page.route("**/api/locations/**/tables**", (route) => {
    const request = route.request();
    if (request.method() === "GET")
      return route.fulfill({ json: { tables: state.tables } });
    const body = request.postDataJSON();
    state.writes.push({
      url: new URL(request.url()).pathname,
      method: request.method(),
      body,
    });
    if (state.failure)
      return route.fulfill({
        status: state.failure.status,
        json: state.failure,
      });
    if (request.method() === "POST" && !request.url().endsWith("/status")) {
      const table = {
        ...state.tables[0],
        id: "new-table",
        name: body.name,
        sortOrder: 3,
      };
      state.tables.push(table);
      return route.fulfill({ status: 201, json: { table } });
    }
    const id = new URL(request.url()).pathname.split("/")[5];
    const table = state.tables.find((item) => item.id === id)!;
    Object.assign(table, body);
    return route.fulfill({ json: { table } });
  });
  await page.route("**/api/pos/tables**", (route) => {
    state.reads += 1;
    const location = new URL(route.request().url()).searchParams.get(
      "locationId",
    );
    return route.fulfill({
      json: {
        tables: state.tables.filter(
          (item) => item.status === "active" && item.locationId === location,
        ),
      },
    });
  });
  await page.route("**/api/pos/orders**", (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "GET")
      return route.fulfill({
        json:
          path === "/api/pos/orders"
            ? {
                open: state.order
                  ? [{ ...state.order, itemCount: 1, saleTotal: null }]
                  : [],
                closedToday: [],
              }
            : state.order,
      });
    const body = request.postDataJSON();
    state.writes.push({ url: path, method: request.method(), body });
    if (state.failure)
      return route.fulfill({
        status: state.failure.status,
        json: state.failure,
      });
    const selected = state.tables.find((item) => item.id === body.tableId);
    if (state.order?.tableId)
      state.tables.find(
        (item) => item.id === state.order!.tableId,
      )!.openOrderId = null;
    if (selected) selected.openOrderId = orderId;
    state.order = {
      id: orderId,
      status: "open",
      version: (state.order?.version ?? 0) + 1,
      tableId: body.tableId ?? null,
      tableLabel: selected?.name ?? body.tableLabel,
      location: {
        id: body.locationId,
        name: body.locationId === localId ? "Centro" : "Norte",
      },
      business: { name: "Café", currencyCode: "USD" },
      items: [
        {
          lineId: "line-1",
          productId,
          name: "Café",
          quantity: 1,
          unitPrice: "10.00",
          lineTotal: "10.00",
        },
      ],
      total: "10.00",
      createdAt: "2026-10-09T12:00:00Z",
      createdBy: "Ana",
      closedAt: null,
      closedBy: null,
      sale: null,
    };
    return route.fulfill({ json: state.order });
  });
  return state;
}
const modal = (page: Page) =>
  page.getByRole("dialog", { name: "Mesas · Centro" });
async function manage(page: Page) {
  await page.goto(`${harness.url}?mode=locations`);
  await page
    .getByRole("button", { name: "Mesas", exact: true })
    .first()
    .click();
  await expect(modal(page)).toBeVisible();
  await expect(modal(page).getByText("Mesa 1", { exact: true })).toBeVisible();
}
async function newOrder(page: Page) {
  await page.goto(harness.url);
  await page.getByRole("button", { name: "Nueva orden", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Mesa 1 · Libre", exact: true }),
  ).toBeVisible();
}
async function review(page: Page) {
  await page.getByRole("button", { name: "Tomar pedido", exact: true }).click();
  await page.getByRole("button", { name: "Agregar Café", exact: true }).click();
  await page
    .getByRole("button", { name: "Revisar pedido", exact: true })
    .click();
}

test("Locales: crear, renombrar y quitar guarda inmediatamente; Editar y cerrar no guardan mesas", async ({
  page,
}) => {
  const state = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await manage(page);
  await expect(
    modal(page).getByText("Mesa archivada", { exact: true }),
  ).toHaveCount(0);
  await modal(page).getByRole("button", { name: "Añadir mesa" }).click();
  await modal(page)
    .getByRole("textbox", { name: "Nombre de mesa" })
    .fill("Barra");
  expect(state.writes).toEqual([]);
  await modal(page)
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(modal(page).getByText("Barra", { exact: true })).toBeVisible();
  await expect(page.getByText("Mesa añadida", { exact: true })).toBeVisible();
  await modal(page)
    .getByRole("button", { name: "Renombrar Barra", exact: true })
    .click();
  await modal(page)
    .getByRole("textbox", { name: "Nuevo nombre de mesa" })
    .fill("Terraza");
  await modal(page)
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(modal(page).getByText("Terraza", { exact: true })).toBeVisible();
  await page.screenshot({ path: "/private/tmp/0187-mesas-local-mobile.png" });
  await modal(page)
    .getByRole("button", { name: "Quitar Terraza", exact: true })
    .click();
  await modal(page)
    .getByRole("button", { name: "Cancelar", exact: true })
    .click();
  expect(state.writes).toHaveLength(2);
  await modal(page)
    .getByRole("button", { name: "Quitar Terraza", exact: true })
    .click();
  await modal(page)
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(modal(page).getByText("Terraza", { exact: true })).toHaveCount(
    0,
  );
  await modal(page)
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  expect(state.writes.map((call) => [call.method, call.body])).toEqual([
    ["POST", { name: "Barra" }],
    ["PATCH", { name: "Terraza" }],
    ["POST", { status: "archived" }],
  ]);
  await page
    .getByRole("button", { name: "Editar", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("textbox", { name: "Nombre del local" }),
  ).toHaveValue("Centro");
  expect(state.writes).toHaveLength(3);
});

test("Locales: duplicado y mesa ocupada muestran error literal y conservan entrada/lista; POSoff oculta Mesas", async ({
  page,
}) => {
  const state = await setup(page);
  await manage(page);
  state.failure = {
    status: 409,
    code: "table_name_taken",
    error: "Ya existe una mesa activa con ese nombre en el local.",
  };
  await modal(page).getByRole("button", { name: "Añadir mesa" }).click();
  await modal(page)
    .getByRole("textbox", { name: "Nombre de mesa" })
    .fill("Mesa 1");
  await modal(page)
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(modal(page).getByRole("alert")).toHaveText(state.failure.error);
  await expect(
    modal(page).getByRole("textbox", { name: "Nombre de mesa" }),
  ).toHaveValue("Mesa 1");
  await modal(page)
    .getByRole("button", { name: "Cancelar", exact: true })
    .click();
  state.failure = {
    status: 409,
    code: "table_has_open_order",
    error:
      "Esta mesa tiene una orden abierta. Ciérrala o anúlala antes de archivarla.",
  };
  await modal(page)
    .getByRole("button", { name: "Quitar Mesa 2", exact: true })
    .click();
  await modal(page)
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(modal(page).getByRole("alert")).toHaveText(state.failure.error);
  await expect(modal(page).getByText("Mesa 2", { exact: true })).toBeVisible();
  await setup(page, false);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Editar", exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mesas", exact: true }),
  ).toHaveCount(0);
});

test("POS: mesa libre viaja como tableId; orden ocupa mesa; cambiar conserva id", async ({
  page,
}) => {
  const state = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await newOrder(page);
  await expect(
    page.getByRole("button", { name: "Mesa 2 · Ocupada", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Mesa 1 · Libre", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Tomar pedido", exact: true }),
  ).toBeEnabled();
  await page.screenshot({ path: "/private/tmp/0187-mesas-pos-mobile.png" });
  await review(page);
  await page
    .getByRole("button", { name: "Guardar pedido", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Volver al listado de órdenes", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Nueva orden", exact: true }),
  ).toBeVisible();
  expect(state.writes[0].body.tableId).toBe(tableId);
  expect(state.tables[0].openOrderId).toBe(orderId);
  await page.getByRole("button", { name: "Nueva orden", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Mesa 1 · Ocupada", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Volver al listado de órdenes", exact: true })
    .click();
  state.tables[1].openOrderId = null;
  state.tables[2].status = "active";
  state.tables[2].openOrderId = "another-order";
  await page.getByRole("button", { name: "Abrir Mesa 1", exact: true }).click();
  await page
    .getByRole("button", { name: "Cambiar mesa: Mesa 1", exact: true })
    .click();
  const change = page.getByRole("dialog", {
    name: "Cambiar mesa",
    exact: true,
  });
  await expect(
    change.getByRole("button", { name: "Mesa 1 · En esta orden", exact: true }),
  ).toBeEnabled();
  await expect(
    change.getByRole("button", { name: /Mesa archivada/ }),
  ).toHaveCount(0);
  await expect(
    change.getByRole("button", { name: "Guardar", exact: true }),
  ).toBeDisabled();
  await expect(change.getByText(/Mesa seleccionada:/)).toHaveCount(0);
  await expect(
    change.getByRole("button", { name: "Usar nombre de mesa", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({ path: "/private/tmp/0187-mesas-chips-mobile.png" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: "/private/tmp/0187-mesas-chips-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await change
    .getByRole("button", { name: "Mesa 2 · Libre", exact: true })
    .click();
  await change.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(state.writes).toHaveLength(1);
  await page
    .getByRole("button", { name: "Cambiar mesa: Mesa 1", exact: true })
    .click();
  await change
    .getByRole("button", { name: "Mesa 2 · Libre", exact: true })
    .click();
  await change.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByText("Pedido actualizado", { exact: true }),
  ).toBeVisible();
  expect(state.writes.at(-1)?.body).toMatchObject({
    tableId: secondId,
    version: 1,
  });
  await page
    .getByRole("button", { name: "Cambiar mesa: Mesa 2", exact: true })
    .click();
  await expect(
    change.getByRole("button", { name: /Mesa archivada/ }),
  ).toHaveCount(0);
  await expect(
    change.getByRole("button", { name: "Guardar", exact: true }),
  ).toBeDisabled();
  await expect(change.getByText(/Mesa seleccionada:/)).toHaveCount(0);
  await expect(
    change.getByRole("button", { name: "Usar nombre de mesa", exact: true }),
  ).toHaveCount(0);
  await change.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(state.writes).toHaveLength(2);
  expect(state.tables[0].openOrderId).toBeNull();
});

test("POS: una orden con nombre libre conserva el input al cambiar mesa y guarda null", async ({
  page,
}) => {
  const state = await setup(page);
  await newOrder(page);
  await page.getByRole("textbox", { name: "Nombre de mesa" }).fill("Barra");
  await review(page);
  await page
    .getByRole("button", { name: "Guardar pedido", exact: true })
    .click();
  await page.getByRole("radio", { name: "Editar", exact: true }).click();
  await page.getByRole("button", { name: "Agregar Café", exact: true }).click();
  await page
    .getByRole("button", { name: "Cambiar mesa: Barra", exact: true })
    .click();
  const change = page.getByRole("dialog", {
    name: "Cambiar mesa",
    exact: true,
  });
  await change
    .getByRole("textbox", { name: "Nombre de mesa" })
    .fill("Barra norte");
  state.failure = {
    status: 503,
    code: "unavailable",
    error: "No pudimos guardar la mesa. Inténtalo de nuevo.",
  };
  await change.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(change.getByRole("alert")).toHaveText(state.failure.error);
  await expect(
    change.getByRole("textbox", { name: "Nombre de mesa" }),
  ).toHaveValue("Barra norte");
  expect(state.order?.tableLabel).toBe("Barra");
  state.failure = null;
  await change.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(
    page.getByText("Pedido actualizado", { exact: true }),
  ).toBeVisible();
  expect(state.writes.at(-1)?.body).toMatchObject({
    tableId: null,
    tableLabel: "Barra norte",
    version: 1,
  });
  expect(state.writes.at(-1)?.body.items).toEqual([
    { lineId: "line-1", productId, quantity: 1 },
  ]);
  await expect(
    page.getByRole("button", { name: "Guardar cambios", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect.poll(() => state.writes.length).toBe(4);
  expect(state.writes.at(-1)?.body).toMatchObject({ version: 2 });
  expect(state.writes.at(-1)?.body.items).toEqual([
    { lineId: "line-1", productId, quantity: 2 },
  ]);
});

for (const code of ["table_occupied", "unknown_table"]) {
  test(`POS: ${code} refresca mesas y conserva productos y error literal`, async ({
    page,
  }) => {
    const state = await setup(page);
    await newOrder(page);
    await page
      .getByRole("button", { name: "Mesa 1 · Libre", exact: true })
      .click();
    await review(page);
    state.failure = {
      status: code === "table_occupied" ? 409 : 422,
      code,
      error:
        code === "table_occupied"
          ? "Esta mesa ya tiene una orden abierta."
          : "La mesa no existe o está archivada.",
    };
    if (code === "table_occupied") state.tables[0].openOrderId = "other";
    else state.tables[0].status = "archived";
    const reads = state.reads;
    await page
      .getByRole("button", { name: "Guardar pedido", exact: true })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: state.failure.error }),
    ).toBeVisible();
    await expect.poll(() => state.reads).toBeGreaterThan(reads);
    await expect(
      page.getByRole("button", { name: "Guardar pedido", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Volver a tomar pedido", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Volver a mesa", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Usar nombre de mesa", exact: true })
      .click();
    await page.getByRole("textbox", { name: "Nombre de mesa" }).fill("Barra");
    state.failure = null;
    await page
      .getByRole("button", { name: "Tomar pedido", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Revisar pedido", exact: true })
      .click();
    await expect(
      page
        .getByRole("region", { name: "Productos del pedido" })
        .getByText("Café", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Guardar pedido", exact: true })
      .click();
    await expect.poll(() => state.writes.length).toBe(2);
    expect(state.writes[1].body).not.toHaveProperty("tableId");
    expect(state.writes[1].body).toMatchObject({
      tableLabel: "Barra",
      items: [{ productId, quantity: 1 }],
    });
  });
}

test("Locales: carga fallida reintenta; guardado bloquea Confirmar/Cerrar", async ({
  page,
}) => {
  const state = await setup(page);
  let fail = true;
  let release: (() => void) | undefined;
  await page.route("**/api/locations/**/tables", async (route) => {
    if (route.request().method() === "GET")
      return fail
        ? route.fulfill({
            status: 503,
            json: { error: "No pudimos leer las mesas." },
          })
        : route.fulfill({ json: { tables: state.tables } });
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    return route.fulfill({
      json: { table: { id: "added", name: "Barra", status: "active" } },
    });
  });
  await page.goto(`${harness.url}?mode=locations`);
  await page
    .getByRole("button", { name: "Mesas", exact: true })
    .first()
    .click();
  await expect(modal(page).getByRole("alert")).toHaveText(
    "No pudimos leer las mesas.",
  );
  fail = false;
  await modal(page)
    .getByRole("button", { name: "Reintentar mesas", exact: true })
    .click();
  await expect(modal(page).getByText("Mesa 1", { exact: true })).toBeVisible();
  await modal(page).getByRole("button", { name: "Añadir mesa" }).click();
  await modal(page)
    .getByRole("textbox", { name: "Nombre de mesa" })
    .fill("Barra");
  await modal(page)
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(
    modal(page).getByRole("button", { name: "Confirmar", exact: true }),
  ).toBeDisabled();
  await expect(
    modal(page).getByRole("button", { name: "Cerrar", exact: true }),
  ).toBeDisabled();
  await expect.poll(() => !!release).toBe(true);
  release!();
  await expect(modal(page).getByText("Barra", { exact: true })).toBeVisible();
});

test("Locales: respuesta tardía de Centro no cambia el modal de Norte", async ({
  page,
}) => {
  await setup(page);
  let release: (() => void) | undefined;
  await page.route(`**/api/locations/${localId}/tables`, async (route) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fulfill({
      json: { tables: [{ id: "late", name: "Mesa tardía", status: "active" }] },
    });
  });
  await page.route(`**/api/locations/${northId}/tables`, (route) =>
    route.fulfill({
      json: {
        tables: [{ id: "north", name: "Terraza norte", status: "active" }],
      },
    }),
  );
  await page.goto(`${harness.url}?mode=locations`);
  await page
    .getByRole("button", { name: "Mesas", exact: true })
    .first()
    .click();
  await expect.poll(() => !!release).toBe(true);
  await modal(page)
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  await page.getByRole("button", { name: "Mesas", exact: true }).nth(1).click();
  const north = page.getByRole("dialog", {
    name: "Mesas · Norte",
    exact: true,
  });
  await expect(north.getByText("Terraza norte", { exact: true })).toBeVisible();
  release!();
  await expect(north.getByText("Mesa tardía", { exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: "/private/tmp/0187-mesas-local-desktop.png" });
});

test("POS: mesas pertenecen al local elegido; error de lectura permite texto libre", async ({
  page,
}) => {
  const state = await setup(page);
  await page.route("**/api/pos/tables**", (route) => {
    const location = new URL(route.request().url()).searchParams.get(
      "locationId",
    );
    expect(location).toBe(northId);
    return route.fulfill({
      status: 503,
      json: { error: "No pudimos cargar las mesas del local." },
    });
  });
  await page.goto(harness.url);
  await page
    .getByRole("button", { name: "Seleccionar local: Centro", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Seleccionar local" })
    .getByRole("button")
    .click();
  await page.getByRole("option", { name: "Norte", exact: true }).click();
  await page.getByRole("button", { name: "Nueva orden", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "No pudimos cargar las mesas del local.",
  );
  await page
    .getByRole("textbox", { name: "Nombre de mesa" })
    .fill("Barra norte");
  await review(page);
  await page
    .getByRole("button", { name: "Guardar pedido", exact: true })
    .click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0].body).toMatchObject({
    locationId: northId,
    tableLabel: "Barra norte",
  });
  expect(state.writes[0].body).not.toHaveProperty("tableId");
});
