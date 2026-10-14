import { expect, test, type Page } from "@playwright/test";
import {
  businessModules as modules,
  extraModule,
  operationModules,
} from "./support/modules-fixture";
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
      json: {
        membership: { role },
        business: { enabledModules: ["pos", "tables"] },
      },
    }),
  );
  await page.route("**/api/modules/pos/ticket-settings", (route) =>
    route.fulfill({
      json: { printingEnabled: false, showBusinessName: true, showTable: true },
    }),
  );
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
  // Falla hasta que el test la apaga: el menu del panel TAMBIEN lee `/api/modules` (d1a213b), asi
  // que «solo la primera lectura falla» dependia de quien pedia primero.
  let failing = true;
  await page.route("**/api/modules", (route) =>
    failing
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
  ).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText(
    "No pudimos cargar los módulos.",
  );
  failing = false;
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

test("staff consulta módulos para el menú, sin controles de activación", async ({
  page,
}) => {
  await setup(page, "staff");
  let reads = 0;
  await page.route("**/api/modules", (route) => {
    reads++;
    return route.fulfill({ json: { modules: modules() } });
  });
  await page.goto(`${harness.url}?mode=settings&role=staff`);
  await expect(
    page.getByText("Solo la persona propietaria puede cambiar los módulos."),
  ).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "Stock", exact: true }),
  ).toHaveCount(0);
  await expect.poll(() => reads).toBeGreaterThan(0);
});

test("un módulo adicional muestra copy, sugerido y dependencias del manifiesto", async ({
  page,
}) => {
  await setup(page);
  let saved = [...modules(), extraModule()];
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
  await page.goto(`${harness.url}?mode=settings`);
  await expect(
    page.getByRole("heading", { name: "Turnos de prueba" }),
  ).toBeVisible();
  await expect(page.getByText("Organiza reservas de prueba")).toBeVisible();
  await expect(page.getByText("Sugerido para tu negocio")).toHaveCount(2);
  await expect(
    page.getByText("Activa Stock para usar Turnos de prueba."),
  ).toBeVisible();
  const extra = page.getByRole("switch", {
    name: "Turnos de prueba",
    exact: true,
  });
  await expect(extra).toBeDisabled();
  await page
    .getByRole("switch", { name: "Stock", exact: true })
    .locator("xpath=ancestor::label")
    .click();
  await expect(extra).toBeEnabled();
  await extra.locator("xpath=ancestor::label").click();
  await expect(extra).toBeChecked();
  await expect(
    page.getByRole("switch", { name: "Stock", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Desactiva Turnos de prueba antes de desactivar Stock."),
  ).toBeVisible();
  expect(writes).toEqual([
    { id: "stock", enabled: true },
    { id: "appointments", enabled: true },
  ]);
});

for (const code of ["module_requires", "module_required_by"] as const) {
  test(`409 ${code} usa los nombres de missing/dependents y recarga`, async ({
    page,
  }) => {
    await setup(page);
    let saved = [...modules(true), extraModule(code === "module_required_by")];
    let reads = 0;
    await page.route("**/api/modules", (route) => {
      reads++;
      return route.fulfill({ json: { modules: saved } });
    });
    await page.route("**/api/modules/appointments", (route) => {
      saved = [...modules(false), extraModule(code === "module_required_by")];
      return route.fulfill({
        status: 409,
        json: {
          code,
          ...(code === "module_requires"
            ? { missing: ["stock"] }
            : { dependents: ["recipes"] }),
        },
      });
    });
    await page.goto(`${harness.url}?mode=settings`);
    await page
      .getByRole("switch", { name: "Turnos de prueba", exact: true })
      .locator("xpath=ancestor::label")
      .click();
    await expect(page.getByRole("alert")).toContainText(
      code === "module_requires"
        ? "Activa Stock para usar Turnos de prueba."
        : "Desactiva Recetas antes de desactivar Turnos de prueba.",
    );
    await expect(
      page.getByRole("switch", { name: "Stock", exact: true }),
    ).not.toBeChecked();
    expect(reads).toBeGreaterThanOrEqual(3);
  });
}

test("0222 apagar Mesas con una orden en mesa muestra 409 y conserva estado", async ({
  page,
}, testInfo) => {
  await setup(page);
  const saved = operationModules();
  const writes: unknown[] = [];
  const events: number[] = [];
  await page.exposeFunction("recordModuleChange", () => events.push(1));
  await page.addInitScript(() =>
    window.addEventListener("checkpass:modules-changed", () => {
      void (
        window as unknown as { recordModuleChange: () => Promise<void> }
      ).recordModuleChange();
    }),
  );
  await page.route("**/api/modules", (route) =>
    route.fulfill({ json: { modules: saved } }),
  );
  await page.route("**/api/modules/tables", (route) => {
    writes.push(route.request().postDataJSON());
    return route.fulfill({
      status: 409,
      json: {
        error:
          "No puedes desactivar las mesas con órdenes abiertas en una mesa. Ciérralas o anúlalas primero.",
        code: "tables_has_open_orders",
        openCount: 2,
      },
    });
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`${harness.url}?mode=settings`);
  const toggle = page.getByRole("switch", { name: "Mesas", exact: true });
  await expect(toggle).toBeChecked();
  await toggle.locator("xpath=ancestor::label").click();
  const dialog = page.getByRole("alertdialog", {
    name: "No puedes desactivar las mesas",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(
    "Hay 2 órdenes abiertas. Cierra o anula esas órdenes antes de desactivar el módulo.",
  );
  await page.screenshot({
    path: testInfo.outputPath("mesas-409-mobile.png"),
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Entendido" }).click();
  await expect(toggle).toBeChecked();
  await expect(toggle).toBeEnabled();
  expect(writes).toEqual([{ enabled: false }]);
  expect(events).toEqual([]);
});

test("0222 panel registrado se monta solo encendido y toggle emite evento confirmado", async ({
  page,
}) => {
  await setup(page);
  let saved = operationModules(false, false);
  let ticketReads = 0;
  await page.route("**/api/modules", (route) =>
    route.fulfill({ json: { modules: saved } }),
  );
  await page.route("**/api/merchant/session", (route) =>
    route.fulfill({
      json: {
        business: {
          enabledModules: saved
            .filter((module) => module.enabled)
            .map((module) => module.id),
        },
        membership: { role: "owner" },
      },
    }),
  );
  await page.route("**/api/modules/pos/ticket-settings", (route) => {
    ticketReads++;
    return route.fulfill({
      json: { printingEnabled: false, showBusinessName: true, showTable: true },
    });
  });
  await page.route("**/api/modules/pos", (route) => {
    const body = route.request().postDataJSON();
    saved = operationModules(body.enabled, false);
    return route.fulfill({ json: { module: saved[0] } });
  });
  await page.goto(`${harness.url}?mode=settings`);
  const toggle = page.getByRole("switch", { name: "POS", exact: true });
  await expect(toggle).toBeEnabled();
  await expect(
    page.getByRole("switch", { name: "Imprimir tickets" }),
  ).toHaveCount(0);
  expect(ticketReads).toBe(0);
  await page.evaluate(() => {
    (window as unknown as { moduleChanges: number }).moduleChanges = 0;
    window.addEventListener("checkpass:modules-changed", () => {
      (window as unknown as { moduleChanges: number }).moduleChanges++;
    });
  });
  await toggle.locator("xpath=ancestor::label").click();
  await expect(
    page.getByRole("switch", { name: "Imprimir tickets" }),
  ).toBeVisible();
  await expect.poll(() => ticketReads).toBe(1);
  await expect(
    page
      .locator(".backoffice-sidebar")
      .getByRole("link", { name: "POS", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { moduleChanges: number }).moduleChanges,
    ),
  ).toBe(1);
  await toggle.locator("xpath=ancestor::label").click();
  await expect(
    page.getByRole("switch", { name: "Imprimir tickets" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "POS", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as unknown as { moduleChanges: number }).moduleChanges,
    ),
  ).toBe(2);
  expect(ticketReads).toBe(1);
});
