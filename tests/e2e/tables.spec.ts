import { operationModules } from "./support/modules-fixture";
import { expect, test, type Page } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
import type { PosOrder } from "../../apps/merchant/src/modules/pos/ui/pos-types";
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
async function setup(page: Page, posEnabled = true, tablesEnabled = true) {
  await page.route("**/api/modules", (route) =>
    route.fulfill({
      json: { modules: operationModules(posEnabled, tablesEnabled) },
    }),
  );
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
          enabledModules: posEnabled
            ? ["pos", ...(tablesEnabled ? ["tables"] : [])]
            : [],
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
  await page.route("**/api/modules/pos/ticket", (route) =>
    route.fulfill({
      json: { printingEnabled: true, showBusinessName: true, showTable: true },
    }),
  );
  await page.route("**/api/modules/pos/catalog**", (route) =>
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
  await page.route("**/api/modules/tables/locations/**", (route) => {
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
    const id = new URL(request.url()).pathname.split("/")[6];
    const table = state.tables.find((item) => item.id === id)!;
    Object.assign(table, body);
    return route.fulfill({ json: { table } });
  });
  await page.route("**/api/modules/pos/tables**", (route) => {
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
  await page.route("**/api/modules/pos/orders**", (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "GET")
      return route.fulfill({
        json:
          path === "/api/modules/pos/orders"
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
async function locationsServer(page: Page) {
  await setup(page);
  const server = [
    {
      id: localId,
      name: "Centro",
      addressLabel: "Av. Central",
      status: "active",
    },
    { id: northId, name: "Norte", addressLabel: "Av. Norte", status: "active" },
  ];
  await page.route("**/api/locations", async (route) => {
    const request = route.request();
    if (request.method() === "GET")
      return route.fulfill({ json: { locations: server } });
    const body = request.postDataJSON();
    const location = {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3",
      name: body.name,
      addressLabel: body.address.label,
      status: "active",
    };
    server.push(location);
    return route.fulfill({ status: 201, json: { location } });
  });
  await page.route("**/api/locations/*", async (route) => {
    const id = new URL(route.request().url()).pathname.split("/")[3];
    const location = server.find((item) => item.id === id)!;
    location.name = route.request().postDataJSON().name;
    return route.fulfill({ json: { location } });
  });
  await page.goto(`${harness.url}?mode=locations`);
  const mesas = page.getByRole("button", { name: "Mesas", exact: true });
  await expect(mesas).toHaveCount(2);
  return mesas;
}
test("Locales: un local recién creado abre su Mesas sin recargar", async ({
  page,
}) => {
  const mesas = await locationsServer(page);
  await page.getByRole("button", { name: "Añadir local" }).click();
  await page.getByRole("textbox", { name: "Nombre del local" }).fill("Sur");
  await page
    .getByRole("textbox", { name: "Dirección escrita" })
    .fill("Av. Sur 1");
  await page.getByRole("button", { name: "Crear local", exact: true }).click();
  await expect(page.getByText("Local añadido.", { exact: true })).toBeVisible();
  await mesas.nth(2).click();
  await expect(page.getByRole("dialog", { name: "Mesas · Sur" })).toBeVisible();
});
test("Locales: un local renombrado abre Mesas con el nombre nuevo sin recargar", async ({
  page,
}) => {
  const mesas = await locationsServer(page);
  await page
    .getByRole("button", { name: "Editar", exact: true })
    .nth(1)
    .click();
  await page
    .getByRole("textbox", { name: "Nombre del local" })
    .fill("Norte Plaza");
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(
    page.getByText("Local actualizado.", { exact: true }),
  ).toBeVisible();
  await mesas.nth(1).click();
  await expect(
    page.getByRole("dialog", { name: "Mesas · Norte Plaza" }),
  ).toBeVisible();
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
test("Locales: carga fallida reintenta; guardado bloquea Confirmar/Cerrar", async ({
  page,
}) => {
  const state = await setup(page);
  let fail = true;
  let release: (() => void) | undefined;
  await page.route("**/api/modules/tables/locations/**", async (route) => {
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
  await page.route(
    `**/api/modules/tables/locations/${localId}`,
    async (route) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      await route.fulfill({
        json: {
          tables: [{ id: "late", name: "Mesa tardía", status: "active" }],
        },
      });
    },
  );
  await page.route(`**/api/modules/tables/locations/${northId}`, (route) =>
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
});
test("0222 Locales relee sesión al cambiar módulos y respeta permiso de la acción", async ({
  page,
}) => {
  await setup(page);
  await manage(page);
  await page.route("**/api/merchant/session", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        business: { enabledModules: ["pos", "tables"] },
        membership: { role: "staff", permissions: ["pos"] },
      },
    }),
  );
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("checkpass:modules-changed")),
  );
  await expect(modal(page)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Mesas", exact: true }),
  ).toHaveCount(0);
});

// 0242: current table-sale editor replaces the retired POS wizard. Keep both
// server-rejection negatives: a refreshed table choice must preserve cart lines.
for (const code of ["table_occupied", "unknown_table"] as const) {
  test(`V2 ${code} refreshes tables, preserves lines and permits another table`, async ({
    page,
  }) => {
    const current = await startCatalogHarness(
      "tests/e2e/support/pos-measured-editor-harness.tsx",
    );
    try {
      const { editorCatalog, editorOrder } =
        await import("./support/pos-measured-editor-fixture");
      let tableReads = 0;
      const bodies: Record<string, unknown>[] = [];
      const message =
        code === "table_occupied"
          ? "Esta mesa ya tiene una orden abierta."
          : "La mesa no existe o está archivada.";
      await page.route("**/api/modules/pos/**", (route) => {
        const request = route.request(),
          path = new URL(request.url()).pathname;
        expect(request.headers()["x-pos-contract"]).toBe("2");
        if (path.endsWith("catalog"))
          return route.fulfill({ json: editorCatalog });
        if (path.endsWith("tables")) {
          tableReads++;
          return route.fulfill({
            json: {
              tables: [
                ...(bodies.length && code === "unknown_table"
                  ? []
                  : [
                      {
                        id: "first",
                        name: "Mesa 1",
                        openOrderId: bodies.length ? "other-order" : null,
                      },
                    ]),
                { id: "second", name: "Mesa 2", openOrderId: null },
              ],
            },
          });
        }
        const body = request.postDataJSON();
        bodies.push(body);
        if (bodies.length === 1)
          return route.fulfill({
            status: code === "table_occupied" ? 409 : 422,
            json: { code, error: message },
          });
        return route.fulfill({
          json: {
            ...editorOrder,
            saleType: "table",
            tableId: body.tableId,
            orderLabel: body.orderLabel,
            location: { id: body.locationId, name: "Local Norte" },
            items: body.items.map(
              (item: Record<string, unknown>, index: number) => ({
                ...editorOrder.items[0],
                ...item,
                lineId: `line-${index}`,
              }),
            ),
          },
        });
      });
      await page.goto(current.url + "?tables");
      await page.getByRole("button", { name: /^Editar local:/ }).click();
      await page.getByRole("button", { name: /Local$/ }).click();
      await page
        .getByRole("option", { name: "Local Norte", exact: true })
        .click();
      await page.getByRole("button", { name: /^Editar mesa u orden:/ }).click();
      await page.getByRole("button", { name: /Tipo de venta$/ }).click();
      await page.getByRole("option", { name: "Mesa", exact: true }).click();
      await page
        .getByRole("button", { name: "Mesa 1 · Libre", exact: true })
        .click();
      await page.getByRole("button", { name: "Listo", exact: true }).click();
      await page
        .getByRole("button", { name: "Añadir Café", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Confirmar orden", exact: true })
        .click();
      await expect(
        page.getByRole("alert").filter({ hasText: message }),
      ).toBeVisible();
      await expect.poll(() => tableReads).toBeGreaterThan(1);
      await page.getByRole("button", { name: /^Editar mesa u orden:/ }).click();
      await expect(
        page.getByRole("button", { name: "Mesa 1 · Libre", exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Mesa 2 · Libre", exact: true })
        .click();
      await page.getByRole("button", { name: "Listo", exact: true }).click();
      await expect(
        page.getByRole("group", { name: "Café, línea 1", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Confirmar orden", exact: true })
        .click();
      await expect.poll(() => bodies.length).toBe(2);
      expect(bodies[1]).toMatchObject({
        tableId: "second",
        items: [{ productId: "coffee", quantity: "1" }],
      });
    } finally {
      await current.close();
    }
  });
}

for (const tableState of ["occupied", "empty", "disabled"] as const) {
  test(`V2 table choice ${tableState} never assumes an occupied table`, async ({
    page,
  }) => {
    const current = await startCatalogHarness(
      "tests/e2e/support/pos-measured-editor-harness.tsx",
    );
    try {
      const { editorCatalog, editorOrder } =
        await import("./support/pos-measured-editor-fixture");
      const writes: Record<string, unknown>[] = [];
      await page.route("**/api/modules/pos/**", (route) => {
        const request = route.request(),
          path = new URL(request.url()).pathname;
        if (path.endsWith("catalog"))
          return route.fulfill({ json: editorCatalog });
        if (path.endsWith("tables"))
          return route.fulfill({
            json: {
              tables:
                tableState === "occupied"
                  ? [
                      {
                        id: "busy",
                        name: "Mesa ocupada",
                        openOrderId: "other-order",
                      },
                    ]
                  : [],
            },
          });
        const body = request.postDataJSON();
        writes.push(body);
        return route.fulfill({
          json: {
            ...editorOrder,
            saleType: "table",
            tableId: null,
            orderLabel: body.orderLabel,
          },
        });
      });
      await page.goto(
        current.url + (tableState === "disabled" ? "" : "?tables"),
      );
      await page.getByRole("button", { name: /^Editar local:/ }).click();
      await page.getByRole("button", { name: /Local$/ }).click();
      await page
        .getByRole("option", { name: "Local Norte", exact: true })
        .click();
      await page.getByRole("button", { name: /^Editar mesa u orden:/ }).click();
      await page.getByRole("button", { name: /Tipo de venta$/ }).click();
      await page.getByRole("option", { name: "Mesa", exact: true }).click();
      if (tableState === "occupied") {
        await expect(
          page.getByRole("button", {
            name: "Mesa ocupada · Ocupada",
            exact: true,
          }),
        ).toBeDisabled();
        await expect(
          page.getByRole("textbox", { name: "Nombre de mesa", exact: true }),
        ).toHaveCount(0);
      } else
        await page
          .getByRole("textbox", { name: "Nombre de mesa", exact: true })
          .fill("Mesa libre");
      await page.getByRole("button", { name: "Listo", exact: true }).click();
      await page
        .getByRole("button", { name: "Añadir Café", exact: true })
        .click();
      const save = page.getByRole("button", {
        name: "Confirmar orden",
        exact: true,
      });
      if (tableState === "occupied") {
        await expect(save).toBeDisabled();
        expect(writes).toHaveLength(0);
      } else {
        await save.click();
        await expect.poll(() => writes.length).toBe(1);
        expect(writes[0]).toMatchObject({
          tableId: null,
          orderLabel: "Mesa libre",
          saleType: "table",
        });
      }
    } finally {
      await current.close();
    }
  });
}
