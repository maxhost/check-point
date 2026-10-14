import { expect, test, type Page } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
import { businessModules, extraModule } from "./support/modules-fixture";

let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/modules-ui-harness.tsx",
    "stock",
  );
});
test.afterAll(async () => harness.close());
const item = { id: "flour", name: "Harina", unit: "g", status: "active" };
const product = { productId: "pizza", productName: "Pizza", lineCount: 0 };

async function setup(page: Page) {
  await page.route("**/api/merchant/session", (route) =>
    route.fulfill({
      json: {
        membership: { role: "owner" },
        business: {
          enabledModules: ["stock", "recipes", "appointments"],
          timezone: "America/Guayaquil",
          currencyCode: "USD",
        },
      },
    }),
  );
  await page.route("**/api/modules", (route) =>
    route.fulfill({
      json: { modules: [...businessModules(true, true), extraModule(true)] },
    }),
  );
}

for (const width of [390, 1280]) {
  test(`menú delega por permisos propios, estado y manifiestos (${width})`, async ({
    page,
  }) => {
    await setup(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(
      `${harness.url}?role=staff&permissions=stock,appointments_manage`,
    );
    if (width === 390)
      await page
        .getByRole("button", { name: "Administración", exact: true })
        .click();
    const nav =
      width === 390
        ? page.getByRole("dialog", { name: "Menú", exact: true })
        : page.locator(".backoffice-sidebar");
    await expect(
      nav.getByRole("link", { name: "Stock", exact: true }),
    ).toHaveAttribute("href", "/backoffice/stock");
    await expect(
      nav.getByRole("link", { name: "Stock", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      nav.getByRole("link", { name: "Recetas", exact: true }),
    ).toHaveCount(0);
    await expect(
      nav.getByRole("link", { name: "Catálogo", exact: true }),
    ).toHaveCount(0);
    await expect(
      nav.getByRole("link", { name: "Turnos de prueba", exact: true }),
    ).toHaveAttribute("href", "/backoffice/appointments");
    // Planet no está importado ni registrado en el core. Su círculo distingue el SVG de Package.
    await expect(
      nav
        .getByRole("link", { name: "Turnos de prueba", exact: true })
        .locator("svg circle"),
    ).toHaveAttribute("r", "8");
    await expect(
      nav.getByRole("link", { name: "Historial de turnos", exact: true }),
    ).toHaveCount(0);
    await page.evaluate(
      (modules) =>
        window.dispatchEvent(
          new CustomEvent("business-modules-changed", { detail: modules }),
        ),
      businessModules(false, false),
    );
    await expect(
      nav.getByRole("link", { name: "Stock", exact: true }),
    ).toHaveCount(0);
    await expect(
      nav.getByRole("link", { name: "Turnos de prueba", exact: true }),
    ).toHaveCount(0);
  });

  test(`Stock trasladado conserva log, decimales y guardado (${width})`, async ({
    page,
  }, testInfo) => {
    await setup(page);
    const writes: unknown[] = [];
    const movements = [
      {
        id: "purchase",
        itemId: item.id,
        itemName: item.name,
        unit: "g",
        kind: "purchase",
        quantity: "7.5",
        countedQuantity: null,
        totalCost: "15",
        createdAt: "2026-10-13T12:00:00Z",
        occurredAt: "2026-10-13T12:00:00Z",
      },
    ];
    await page.route("**/api/modules/stock/movements?*", (route) =>
      route.fulfill({ json: { movements } }),
    );
    await page.route(/\/api\/modules\/stock\/items(?:\?|$)/, (route) =>
      route.fulfill({ json: { items: [item] } }),
    );
    await page.route("**/api/modules/stock/entries", (route) => {
      writes.push(route.request().postDataJSON());
      return route.fulfill({ json: { ok: true } });
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${harness.url}/backoffice/stock?surface=stock`);
    await expect(
      page.getByRole("table", { name: "Registros de stock" }),
    ).toContainText("7,5 g · Total: 15 USD");
    await page
      .getByRole("button", { name: "Registrar stock", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Nuevo stock", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Nuevo stock",
      exact: true,
    });
    await dialog.getByRole("button", { name: "Manual", exact: true }).click();
    await dialog.getByRole("button", { name: /Insumo/ }).click();
    await page.getByRole("option", { name: "Harina", exact: true }).click();
    await dialog
      .getByRole("textbox", { name: "Cantidad", exact: true })
      .fill("7,5");
    await dialog
      .getByRole("textbox", { name: "Precio total (opcional)", exact: true })
      .fill("15");
    await page.screenshot({
      path: testInfo.outputPath(`stock-${width}.png`),
      fullPage: true,
    });
    await dialog
      .getByRole("button", { name: "Guardar compra", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    expect(writes).toEqual([
      {
        lines: [
          { itemId: item.id, quantity: "7.5", unit: "g", totalCost: "15" },
        ],
      },
    ]);
    await expect(
      page.getByRole("table", { name: "Registros de stock" }),
    ).toContainText("Compra · Harina");
  });

  test(`Recetas trasladadas conservan dictado, revisión y payload (${width})`, async ({
    page,
  }, testInfo) => {
    await setup(page);
    let saved = false;
    const drafts: unknown[] = [];
    const writes: unknown[] = [];
    await page.route("**/api/modules/recipes", (route) =>
      route.fulfill({
        json: { recipes: [{ ...product, lineCount: saved ? 1 : 0 }] },
      }),
    );
    await page.route(/\/api\/modules\/stock\/items(?:\?|$)/, (route) =>
      route.fulfill({ json: { items: [item] } }),
    );
    await page.route("**/api/modules/recipes/pizza", (route) => {
      if (route.request().method() === "PUT") {
        writes.push(route.request().postDataJSON());
        saved = true;
      }
      return route.fulfill({ json: { recipe: { ...product, lines: [] } } });
    });
    await page.route("**/api/modules/recipes/pizza/draft", (route) => {
      drafts.push(route.request().postDataJSON());
      return route.fulfill({
        json: {
          draft: {
            yield: 10,
            lines: [
              {
                itemId: item.id,
                name: item.name,
                isNew: false,
                quantity: "7.5",
                unit: "g",
                sourceText: "75 g de harina",
              },
            ],
            unparsed: [],
          },
        },
      });
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${harness.url}/backoffice/recipes?surface=recipes`);
    await page
      .getByRole("button", { name: "Nueva receta", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Buscar producto", exact: true })
      .fill("Pizza");
    await page.getByRole("button", { name: "Pizza", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Pizza", exact: true });
    await dialog
      .getByRole("textbox", { name: "Describe tu receta", exact: true })
      .fill("Para 10 pizzas uso 75 g de harina");
    await dialog.getByRole("button", { name: "Analizar", exact: true }).click();
    const quantity = dialog.getByRole("textbox", {
      name: "Cantidad por unidad del producto",
      exact: true,
    });
    await expect(quantity).toHaveValue("7,5");
    await quantity.fill("0,1");
    await page.screenshot({
      path: testInfo.outputPath(`recipes-${width}.png`),
      fullPage: true,
    });
    await dialog
      .getByRole("button", { name: "Guardar receta", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Editar receta de Pizza", exact: true }),
    ).toBeVisible();
    expect(drafts).toEqual([{ text: "Para 10 pizzas uso 75 g de harina" }]);
    expect(writes).toEqual([
      { lines: [{ itemId: item.id, quantity: "0.1", unit: "g" }] },
    ]);
  });
}

test("GET iniciado antes de un evento no pisa el estado confirmado", async ({
  page,
}) => {
  await setup(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reading = false;
  await page.route("**/api/modules", async (route) => {
    reading = true;
    await pending;
    await route.fulfill({ json: { modules: businessModules(true, true) } });
  });
  await page.goto(harness.url);
  await expect.poll(() => reading).toBe(true);
  await page.evaluate(
    (modules) =>
      window.dispatchEvent(
        new CustomEvent("business-modules-changed", { detail: modules }),
      ),
    businessModules(false, false),
  );
  const response = page.waitForResponse("**/api/modules");
  release();
  await response;
  await expect(
    page
      .locator(".backoffice-sidebar")
      .getByRole("link", { name: "Stock", exact: true }),
  ).toHaveCount(0);
});
