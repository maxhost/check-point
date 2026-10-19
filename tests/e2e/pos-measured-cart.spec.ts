import { test, expect } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/pos-measured-cart-harness.tsx",
  );
});
test.afterAll(async () => {
  await harness.close();
});
async function choose(page: import("@playwright/test").Page, name: string) {
  await page.getByRole("button", { name: "Unidad de cantidad" }).click();
  await page.getByRole("option", { name, exact: true }).click();
}
async function payload(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Revisar borrador" }).click();
  return JSON.parse(
    await page.getByRole("status", { name: "Comando preparado" }).innerText(),
  );
}
test("mass manual, buffers, coma, tarifa congelada y doble confirmación", async ({
  page,
}) => {
  await page.goto(harness.url);
  await page.getByRole("button", { name: /Añadir Café en grano/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Cantidad", exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Confirmar cantidad" }),
  ).toBeDisabled();
  await choose(page, "lb");
  for (const value of ["", "0", "1.", "1e3", "0.1234567891", "1000000000"]) {
    await page
      .getByRole("textbox", { name: "Cantidad", exact: true })
      .fill(value);
    await expect(
      page.getByRole("button", { name: "Confirmar cantidad" }),
    ).toBeDisabled();
  }
  await page
    .getByRole("textbox", { name: "Cantidad", exact: true })
    .fill("2,123456789");
  await page.getByRole("button", { name: "Confirmar cantidad" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const items = await payload(page);
  expect(items).toHaveLength(4);
  expect(items[3]).toEqual({
    productId: "mass",
    quantity: "2.123456789",
    quantityUnit: "lb",
    catalogRevision: "3",
  });
  expect(items[0]).toMatchObject({ lineId: "old", quantity: "2" });
  expect(items[1].productId).toBeNull();
  await page.getByRole("button", { name: /Añadir Café en grano/ }).click();
  await page.getByRole("textbox", { name: "Cantidad", exact: true }).fill("1");
  await page.getByRole("button", { name: "Confirmar cantidad" }).dblclick();
  expect(await payload(page)).toHaveLength(5);
});
test("vista aproximada conserva fuente; captura nueva explícita y cancelación", async ({
  page,
}) => {
  await page.goto(harness.url);
  await page
    .getByRole("button", { name: "Editar cantidad de Grano guardado, línea 3" })
    .click();
  await choose(page, "lb");
  await expect(
    page.getByText(/Aproximación de la cantidad original/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirmar cantidad" }).click();
  expect((await payload(page))[2]).toMatchObject({
    quantity: "1",
    quantityUnit: "g",
  });
  await page
    .getByRole("button", { name: "Editar cantidad de Grano guardado, línea 3" })
    .click();
  await page.getByRole("textbox", { name: "Cantidad", exact: true }).fill("");
  await expect(
    page.getByRole("button", { name: "Confirmar cantidad" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Revisar borrador" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  expect((await payload(page))[2]).toMatchObject({
    quantity: "1",
    quantityUnit: "g",
  });
  await page
    .getByRole("button", { name: "Editar cantidad de Grano guardado, línea 3" })
    .click();
  await page
    .getByRole("textbox", { name: "Cantidad", exact: true })
    .fill("0,5");
  await page.getByRole("button", { name: "Confirmar cantidad" }).click();
  expect((await payload(page))[2]).toMatchObject({
    quantity: "0.5",
    quantityUnit: "lb",
  });
});
test("unidad histórica deshabilitada, unidad entera, precios separados, cero/null", async ({
  page,
}) => {
  await page.goto(harness.url);
  await page
    .getByRole("button", { name: "Editar cantidad de Grano guardado, línea 3" })
    .click();
  await page.getByRole("textbox", { name: "Cantidad", exact: true }).fill("2");
  await expect(
    page.getByRole("button", { name: "Confirmar cantidad" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page
    .getByRole("button", { name: "Añadir Café", exact: true })
    .dblclick();
  await page.getByRole("button", { name: "Añadir Agua", exact: true }).click();
  await page
    .getByRole("button", { name: "Añadir Sin precio", exact: true })
    .click();
  await expect(
    page.getByText("Este producto no tiene precio de venta."),
  ).toBeVisible();
  const items = await payload(page);
  expect(items).toHaveLength(6);
  expect(
    items.filter((item: { productId: string }) => item.productId === "coffee"),
  ).toHaveLength(3);
  await page
    .getByRole("button", { name: "Editar cantidad de Café anterior, línea 1" })
    .click();
  await page
    .getByRole("textbox", { name: "Cantidad", exact: true })
    .fill("1.5");
  await expect(
    page.getByRole("button", { name: "Confirmar cantidad" }),
  ).toBeDisabled();
});
test("inspección agrupada móvil y escritorio", async ({ page }) => {
  await page.goto(harness.url);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 950 });
    await page.screenshot({
      path: `/private/tmp/checkpass-pos-0242/cart-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .getByRole("button", { name: "Editar cantidad de Grano guardado, línea 3" })
    .click();
  await choose(page, "lb");
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 950 });
    await page.screenshot({
      path: `/private/tmp/checkpass-pos-0242/cart-dialog-${width}.png`,
      fullPage: true,
    });
  }
});
