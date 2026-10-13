import { expect, test, type Page } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";

let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/pos-counter-harness.tsx",
    "settings",
  );
});
test.afterAll(async () => harness.close());

async function setup(page: Page, role = "owner") {
  await page.route("**/api/merchant/session", (route) =>
    route.fulfill({
      json: { membership: { role }, business: { posEnabled: true } },
    }),
  );
  await page.route("**/api/merchant/business/ticket", (route) =>
    route.fulfill({
      json: { printingEnabled: false, showBusinessName: true, showTable: true },
    }),
  );
}

function modules(stock = false, recipes = false) {
  return [
    {
      id: "stock",
      name: "Stock",
      description: "",
      requires: [],
      enabled: stock,
      suggested: false,
    },
    {
      id: "recipes",
      name: "Recetas",
      description: "",
      requires: ["stock"],
      enabled: recipes,
      suggested: false,
    },
  ];
}

test("cards, activación persistida y dependencias en móvil y escritorio", async ({
  page,
}, testInfo) => {
  await setup(page);
  let saved = modules();
  const writes: unknown[] = [];
  await page.route("**/api/modules", (route) =>
    route.fulfill({ json: { modules: saved } }),
  );
  await page.route("**/api/modules/*", (route) => {
    const id = route.request().url().split("/").at(-1);
    const body = route.request().postDataJSON();
    writes.push({ id, ...body });
    saved = saved.map((module) =>
      module.id === id ? { ...module, ...body } : module,
    );
    return route.fulfill({
      json: { module: saved.find((module) => module.id === id) },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${harness.url}?mode=settings`);
  await expect(
    page.getByRole("heading", { name: "Stock", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Recetas", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "Recetas", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("switch", { name: "Stock", exact: true })
    .locator("xpath=ancestor::label")
    .click();
  await page
    .getByRole("switch", { name: "Recetas", exact: true })
    .locator("xpath=ancestor::label")
    .click();
  await expect(
    page.getByRole("switch", { name: "Stock", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole("switch", { name: "Recetas", exact: true }),
  ).toBeEnabled();
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`settings-${width}.png`),
      fullPage: true,
    });
  }
  await page
    .getByRole("switch", { name: "Recetas", exact: true })
    .locator("xpath=ancestor::label")
    .click();
  await page
    .getByRole("switch", { name: "Stock", exact: true })
    .locator("xpath=ancestor::label")
    .click();
  expect(writes).toEqual([
    { id: "stock", enabled: true },
    { id: "recipes", enabled: true },
    { id: "recipes", enabled: false },
    { id: "stock", enabled: false },
  ]);
});

test("fallo de carga permite reintentar; fallo de escritura conserva estado", async ({
  page,
}) => {
  await setup(page);
  let reads = 0;
  await page.route("**/api/modules", (route) =>
    ++reads === 1
      ? route.fulfill({
          status: 503,
          json: { error: "No pudimos cargar los módulos." },
        })
      : route.fulfill({ json: { modules: modules() } }),
  );
  await page.route("**/api/modules/stock", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "No pudimos guardar Stock." },
    }),
  );
  await page.goto(`${harness.url}?mode=settings`);
  await expect(
    page.getByRole("switch", { name: "Stock", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Reintentar módulos" }).click();
  await page
    .getByRole("switch", { name: "Stock", exact: true })
    .locator("xpath=ancestor::label")
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "No pudimos guardar Stock.",
  );
  await expect(
    page.getByRole("switch", { name: "Stock", exact: true }),
  ).toBeEnabled();
});

test("staff no consulta módulos ni muestra controles", async ({ page }) => {
  await setup(page, "staff");
  let reads = 0;
  await page.route("**/api/modules", (route) => {
    reads++;
    return route.fulfill({ json: { modules: modules() } });
  });
  await page.goto(`${harness.url}?mode=settings`);
  await expect(
    page.getByText("Solo la persona propietaria puede cambiar los módulos."),
  ).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "Stock", exact: true }),
  ).toHaveCount(0);
  expect(reads).toBe(0);
});
