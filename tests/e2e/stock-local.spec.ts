import { expect, test } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
import { chooseLocal, stockLocalFixture } from "./support/stock-local-fixture";

let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/modules-ui-harness.tsx",
    "stock",
  );
});
test.afterAll(async () => {
  if (harness) await harness.close();
});

for (const width of [390, 1280]) {
  test(`Local elegido separa historial y manual/audio/conteo; saldos ocultos y pendientes (${width})`, async ({
    page,
  }, info) => {
    const { reads } = await stockLocalFixture(page);
    await page.setViewportSize({ width, height: 900 });
    const entries: unknown[] = [];
    const adjustments: unknown[] = [];
    await page.route("**/api/modules/stock/entries", (route) => {
      entries.push(route.request().postDataJSON());
      return route.fulfill({ json: { ok: true } });
    });
    await page.route("**/api/modules/stock/entries/draft", (route) =>
      route.fulfill({
        json: {
          draft: {
            lines: [
              {
                itemId: "flour",
                name: "Harina",
                quantity: "2.5",
                unit: "kg",
                totalCost: null,
                sourceText: "2,5 kg",
              },
            ],
            unparsed: [],
          },
        },
      }),
    );
    let blocked = true;
    await page.route(
      "**/api/modules/stock/items/flour/adjustments",
      (route) => {
        adjustments.push(route.request().postDataJSON());
        return route.fulfill(
          blocked
            ? {
                status: 409,
                json: {
                  code: "consumption_pending",
                  error:
                    "Hay consumos pendientes. Actualiza el stock y reintenta el conteo.",
                },
              }
            : { json: { ok: true } },
        );
      },
    );
    await page.goto(`${harness.url}/backoffice/stock?surface=stock`);
    await expect.poll(() => reads.includes("first")).toBe(true);
    await chooseLocal(page, "Norte");
    await expect(
      page.getByText("Harina: -750 g", { exact: false }),
    ).toHaveCount(0);
    await expect(
      page.getByLabel("Saldos del local", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Consumo · Harina", { exact: false }),
    ).toBeVisible();
    await expect(page.getByText("Venta sale", { exact: false })).toBeVisible();
    await expect(
      page.getByText("1 consumo pendiente", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Actualizar stock", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`stock-local-${width}.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Registrar stock", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Nuevo stock", exact: true })
      .click();
    let dialog = page.getByRole("dialog", { name: "Nuevo stock", exact: true });
    await dialog.getByRole("button", { name: "Manual", exact: true }).click();
    await dialog.getByRole("button", { name: "Insumo", exact: false }).click();
    await page.getByRole("option", { name: "Harina", exact: true }).click();
    await dialog
      .getByRole("textbox", { name: "Cantidad", exact: true })
      .fill("2");
    await expect(
      dialog.getByRole("textbox", { name: "Precio total", exact: true }),
    ).toHaveValue("");
    await expect(
      dialog.getByRole("button", { name: "Guardar compra", exact: true }),
    ).toBeDisabled();
    expect(entries).toEqual([]);
    await dialog
      .getByRole("textbox", { name: "Precio total", exact: true })
      .fill("5");
    await dialog
      .getByRole("button", { name: "Guardar compra", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    expect(entries[0]).toMatchObject({
      locationId: "second",
      lines: [{ itemId: "flour", quantity: "2", totalCost: "5" }],
    });
    await page
      .getByRole("button", { name: "Registrar stock", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Nuevo stock", exact: true })
      .click();
    dialog = page.getByRole("dialog", { name: "Nuevo stock", exact: true });
    await dialog
      .getByRole("textbox", { name: "Describe tu compra", exact: true })
      .fill("2,5 kg de harina");
    await dialog.getByRole("button", { name: "Analizar", exact: true }).click();
    await expect(
      dialog.getByRole("textbox", { name: "Precio total", exact: true }),
    ).toHaveValue("");
    await expect(
      dialog.getByRole("button", { name: "Guardar compra", exact: true }),
    ).toBeDisabled();
    expect(entries).toHaveLength(1);
    await dialog
      .getByRole("textbox", { name: "Precio total", exact: true })
      .fill("0");
    await dialog
      .getByRole("button", { name: "Guardar compra", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    expect(entries[1]).toMatchObject({
      locationId: "second",
      lines: [{ itemId: "flour", quantity: "2.5", unit: "kg", totalCost: "0" }],
    });
    await chooseLocal(page, "Sur · Archivado");
    await page
      .getByRole("button", { name: "Registrar stock", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Nuevo stock", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Ajustar stock", exact: true })
      .click();
    const count = page.getByRole("dialog", {
      name: "Ajustar stock",
      exact: true,
    });
    await count.getByRole("button", { name: "Insumo", exact: false }).click();
    await page.getByRole("option", { name: "Harina", exact: true }).click();
    await count
      .getByRole("textbox", { name: "Cantidad contada", exact: true })
      .fill("0");
    await count
      .getByRole("button", { name: "Guardar conteo", exact: true })
      .click();
    await expect(count).toContainText("Hay consumos pendientes");
    await expect(
      count.getByRole("textbox", { name: "Cantidad contada", exact: true }),
    ).toHaveValue("0");
    blocked = false;
    await count
      .getByRole("button", { name: "Guardar conteo", exact: true })
      .click();
    await expect(count).toHaveCount(0);
    expect(adjustments).toEqual([
      { locationId: "archived", countedQuantity: "0.000" },
      { locationId: "archived", countedQuantity: "0.000" },
    ]);
    expect(reads).toContain("second");
    expect(reads).toContain("archived");
  });
}
test("Un local activo es automático y sin selector; sin activo no compra", async ({
  page,
}) => {
  const { reads } = await stockLocalFixture(page, true);
  await page.goto(`${harness.url}/backoffice/stock?surface=stock`);
  await expect.poll(() => reads.includes("first")).toBe(true);
  await expect(
    page.getByRole("button", { name: "Local", exact: false }),
  ).toHaveCount(0);
  await page.route("**/api/modules/stock/locations", (route) =>
    route.fulfill({ json: { locations: [], defaultLocationId: null } }),
  );
  await page.reload();
  await expect(
    page.getByText("No tienes locales disponibles", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Registrar stock", exact: true }),
  ).toBeDisabled();
});

test("Cambiar local no muestra saldos ni pendientes del anterior si falla su lectura", async ({
  page,
}) => {
  await stockLocalFixture(page);
  await page.route("**/api/modules/stock/movements?*", (route) => {
    const local = new URL(route.request().url()).searchParams.get("locationId");
    return route.fulfill(
      local === "second"
        ? {
            status: 503,
            json: { error: "No pudimos leer el local Norte. Reintenta." },
          }
        : { json: { movements: [], pending: { count: 1, failed: 1 } } },
    );
  });
  await page.goto(`${harness.url}/backoffice/stock?surface=stock`);
  await expect(
    page.getByText("1 consumo pendiente", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Harina: 1000 g", { exact: false })).toHaveCount(
    0,
  );
  await expect(
    page.getByLabel("Saldos del local", { exact: true }),
  ).toHaveCount(0);
  await chooseLocal(page, "Norte");
  await expect(
    page.getByText("No pudimos leer el local Norte. Reintenta.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("1 consumo pendiente", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Harina:", { exact: false })).toHaveCount(0);
});
