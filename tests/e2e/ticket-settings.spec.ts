import { expect, test, type Page } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";

let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/pos-counter-harness.tsx",
    "ticket-settings",
  );
});
test.afterAll(async () => harness.close());

async function setup(page: Page) {
  await page.route("**/api/merchant/session", (route) =>
    route.fulfill({
      json: {
        user: { id: "owner" },
        business: { id: "business", posEnabled: true },
        membership: { role: "owner" },
      },
    }),
  );
}
const expand = (page: Page) =>
  page.getByRole("switch", { name: "Imprimir tickets", exact: true });
const name = (page: Page) =>
  page.getByRole("switch", { name: "Mostrar nombre del comercio" });
const table = (page: Page) =>
  page.getByRole("switch", { name: "Mostrar mesa", exact: true });

test("abrir/cerrar no escribe; cambios persisten al recargar y ambas opciones pueden apagarse", async ({
  page,
}) => {
  await setup(page);
  let saved = { showBusinessName: true, showTable: true };
  const bodies: unknown[] = [];
  await page.route("**/api/merchant/business/ticket", (route) => {
    if (route.request().method() === "PUT") {
      saved = route.request().postDataJSON();
      bodies.push(saved);
    }
    return route.fulfill({ json: saved });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${harness.url}?mode=settings`);
  await expect(name(page)).toHaveCount(0);
  await expand(page).locator("xpath=ancestor::label").click();
  await expect(expand(page)).toBeChecked();
  await expect(name(page)).toBeChecked();
  await page.waitForTimeout(300); // Let the kit switch transition settle for the capture.
  await page.screenshot({ path: "/private/tmp/0186-configuracion-mobile.png" });
  await expand(page).locator("xpath=ancestor::label").click();
  expect(bodies).toEqual([]);
  await expand(page).locator("xpath=ancestor::label").click();
  await name(page).locator("xpath=ancestor::label").click();
  await expect(name(page)).not.toBeChecked();
  await expect(
    page.getByText("Opciones del ticket guardadas", { exact: true }),
  ).toBeVisible();
  await table(page).locator("xpath=ancestor::label").click();
  await expect(table(page)).not.toBeChecked();
  expect(bodies).toEqual([
    { showBusinessName: false, showTable: true },
    { showBusinessName: false, showTable: false },
  ]);
  await expand(page).locator("xpath=ancestor::label").click();
  await expand(page).locator("xpath=ancestor::label").click();
  await expect(name(page)).not.toBeChecked();
  await page.reload();
  await expand(page).locator("xpath=ancestor::label").click();
  await expect(name(page)).not.toBeChecked();
  await expect(table(page)).not.toBeChecked();
  expect(bodies).toHaveLength(2);
  await expect(expand(page)).toBeChecked();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(300); // Capture the settled toggle, not its animation.
  await page.screenshot({
    path: "/private/tmp/0186-configuracion-desktop.png",
  });
});

test("fallo conserva ajustes; guardado bloquea dobles cambios y solo éxito avisa", async ({
  page,
}) => {
  await setup(page);
  let fail = true;
  let writes = 0;
  let release: (() => void) | undefined;
  await page.route("**/api/merchant/business/ticket", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        json: { showBusinessName: true, showTable: true },
      });
    writes += 1;
    if (fail)
      return route.fulfill({
        status: 503,
        json: { error: "No pudimos guardar el ajuste del ticket." },
      });
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    return route.fulfill({ json: route.request().postDataJSON() });
  });
  await page.goto(`${harness.url}?mode=settings`);
  await expand(page).locator("xpath=ancestor::label").click();
  await expect(name(page)).toBeChecked();
  await name(page).locator("xpath=ancestor::label").click();
  await expect(page.getByRole("alert")).toContainText(
    "No pudimos guardar el ajuste del ticket.",
  );
  await expect(name(page)).toBeChecked();
  await expect(
    page.getByText("Opciones del ticket guardadas", { exact: true }),
  ).toHaveCount(0);
  fail = false;
  await name(page).locator("xpath=ancestor::label").click();
  await expect(table(page)).toBeDisabled();
  await expect(expand(page)).toBeDisabled();
  expect(writes).toBe(2);
  await expect.poll(() => !!release).toBe(true);
  release!();
  await expect(name(page)).not.toBeChecked();
  await expect(table(page)).toBeEnabled();
  await expect(
    page.getByText("Opciones del ticket guardadas", { exact: true }),
  ).toBeVisible();
});

test("lectura fallida reintenta sin defaults; no owner no consulta ticket", async ({
  page,
}) => {
  await setup(page);
  let reads = 0;
  await page.route("**/api/merchant/business/ticket", (route) => {
    reads += 1;
    return reads === 1
      ? route.fulfill({
          status: 503,
          json: { error: "No pudimos leer el ajuste del ticket." },
        })
      : route.fulfill({ json: { showBusinessName: false, showTable: true } });
  });
  await page.goto(`${harness.url}?mode=settings`);
  await expand(page).locator("xpath=ancestor::label").click();
  await expect(page.getByRole("alert")).toContainText(
    "No pudimos leer el ajuste del ticket.",
  );
  await expect(name(page)).toHaveCount(0);
  await page
    .getByRole("button", { name: "Reintentar opciones del ticket" })
    .click();
  await expect(name(page)).not.toBeChecked();
  await expect(table(page)).toBeChecked();
  expect(reads).toBe(2);
  await page.route("**/api/merchant/session", (route) =>
    route.fulfill({ json: { membership: { role: "staff" } } }),
  );
  await page.reload();
  await expect(
    page.getByText("Solo la persona propietaria puede cambiar los módulos."),
  ).toBeVisible();
  await expect(expand(page)).toHaveCount(0);
  expect(reads).toBe(2);
});
