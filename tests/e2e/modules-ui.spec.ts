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
const item = {
  id: "flour",
  name: "Harina",
  unit: "g",
  status: "active",
  onHand: "7.500",
  lastUnitCost: "2.000000",
  weightedAverageUnitCost: "2.000000",
};
const local = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Local principal",
  status: "active",
};

async function setup(page: Page) {
  await page.route("**/api/modules/stock/locations", (route) =>
    route.fulfill({
      json: { locations: [local], defaultLocationId: local.id },
    }),
  );
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
      route.fulfill({
        json: {
          locationId: local.id,
          movements,
          pending: { count: 0, failed: 0 },
        },
      }),
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
    await expect(page.getByLabel("Saldos del local")).toHaveCount(0);
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
      .getByRole("textbox", { name: "Precio total", exact: true })
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
        locationId: local.id,
        lines: [
          { itemId: item.id, quantity: "7.5", unit: "g", totalCost: "15" },
        ],
      },
    ]);
    await expect(
      page.getByRole("table", { name: "Registros de stock" }),
    ).toContainText("Compra · Harina");
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
