import { expect } from "@playwright/test";
import { test } from "./support/catalog-tour-fixture";
import { catalogApiFixture } from "./support/catalog-api-fixture";
const save = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "Guardar producto", exact: true });
const name = (page: import("@playwright/test").Page) =>
  page.getByRole("textbox", { name: "Nombre del producto" });
async function edit(page: import("@playwright/test").Page) {
  await page
    .locator('[data-catalog-id="product-first"]')
    .getByRole("button", { name: "Editar", exact: true })
    .click();
}
test("V2 exact payload, enabled units and paired mobile/desktop editor capture (future contract fixture)", async ({
  page,
  catalogHarness,
}) => {
  const api = await catalogApiFixture(page);
  api.salesMassUnits = ["lb", "g"];
  await page.goto(catalogHarness);
  await page.getByRole("button", { name: "Cerrar la guía de inicio" }).click();
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  await name(page).fill("Café por peso");
  await expect(
    page.getByRole("checkbox", { name: "Este producto se vende por peso" }),
  ).not.toBeChecked();
  await page
    .getByText("Este producto se vende por peso", { exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Este producto se vende por peso" }),
  ).toBeChecked();
  const price = page.getByRole("textbox", {
    name: "Precio de venta por libra (opcional)",
  });
  await price.fill("0.123456789");
  await page
    .getByRole("textbox", { name: "Precio de costo por libra (opcional)" })
    .fill("0");
  await page.getByRole("button", { name: "Unidad de venta" }).click();
  await expect(page.getByRole("option", { name: "kilogramo" })).toHaveCount(0);
  await page.getByRole("option", { name: "gramo" }).click();
  await expect(
    page.getByRole("textbox", { name: "Precio de venta por gramo (opcional)" }),
  ).toHaveValue("0.123456789");
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.screenshot({
      path: `/private/tmp/checkpass-pos-0242/catalog-ui-0242-evidence/catalog-editor-${width}.png`,
      fullPage: true,
    });
  }
  await save(page).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(api.writes.at(-1)?.body).toMatchObject({
    unitPrice: "0.123456789",
    unitCost: "0",
    soldByWeight: true,
    pricingUnit: "g",
  });
  expect(api.writes.at(-1)?.body).not.toHaveProperty("expectedSalesRevision");
  expect(
    api.headers
      .filter(
        (item) =>
          item.path === "/api/catalog" || item.path === "/api/catalog/product",
      )
      .every((item) => item.contract === "2"),
  ).toBe(true);
  await expect(page.locator(".catalog-item-meta").last()).toContainText(
    "0,123456789",
  );
});
test("legacy high tariff is unchanged when editing name; empty cost remains null", async ({
  page,
  catalogHarness,
}) => {
  const api = await catalogApiFixture(page);
  api.products[0].unitPrice = "9999999999.99";
  await page.goto(catalogHarness);
  await edit(page);
  await name(page).fill("Nombre nuevo");
  await save(page).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(api.writes.at(-1)?.body).toMatchObject({
    unitPrice: "9999999999.99",
    unitCost: null,
    expectedSalesRevision: "1",
    soldByWeight: false,
    pricingUnit: "unit",
  });
});
test("conflict preserves edited fields, adopts untouched remote fields only after explicit review", async ({
  page,
  catalogHarness,
}) => {
  const api = await catalogApiFixture(page);
  await page.goto(catalogHarness);
  await edit(page);
  await name(page).fill("Mi nombre");
  await page
    .getByRole("textbox", { name: "Precio de costo (opcional)" })
    .fill("0.000000001");
  const remote = {
    ...api.products[0],
    name: "Nombre remoto",
    unitPrice: "7.123456789",
    catalogRevision: "2",
  };
  api.writeError = {
    status: 409,
    code: "catalog_changed",
    error: "El producto cambió.",
    product: remote,
  };
  await save(page).click();
  await expect(name(page)).toHaveValue("Mi nombre");
  await expect(save(page)).toBeDisabled();
  await expect(page.getByText(/Ambos cambiaron: Nombre/)).toBeVisible();
  expect(api.writes).toHaveLength(1);
  await page
    .getByRole("button", { name: "Ya revisé: conservar mis cambios" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Precio de venta (opcional)" }),
  ).toHaveValue("7.123456789");
  api.writeError = null;
  await save(page).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(api.writes.at(-1)?.body).toMatchObject({
    name: "Mi nombre",
    unitPrice: "7.123456789",
    unitCost: "0.000000001",
    expectedSalesRevision: "2",
  });
});
for (const code of [
  "measurement_basis_required",
  "pos_client_upgrade_required",
  "invalid_unit",
  "invalid_price",
]) {
  test(`${code} preserves the complete draft without retry`, async ({
    page,
    catalogHarness,
  }) => {
    const api = await catalogApiFixture(page);
    await page.goto(catalogHarness);
    await edit(page);
    await name(page).fill("Conservar");
    api.writeError = {
      status: code.startsWith("invalid") ? 422 : 409,
      code,
      error: "Revisa los datos del producto.",
    };
    await save(page).click();
    await expect(name(page)).toHaveValue("Conservar");
    await expect(save(page)).toBeDisabled();
    expect(api.writes).toHaveLength(1);
    await page.getByRole("button", { name: "Corregir borrador" }).click();
    await expect(save(page)).toBeEnabled();
  });
}
test("uncertain write requires authoritative reading and explicit review; missing product never becomes create", async ({
  page,
  catalogHarness,
}) => {
  const api = await catalogApiFixture(page);
  await page.goto(catalogHarness);
  await edit(page);
  await name(page).fill("Conservar");
  api.failWrite = true;
  await save(page).click();
  await expect(save(page)).toBeDisabled();
  await page.getByRole("button", { name: "Revisar estado actual" }).click();
  await page
    .getByRole("button", { name: "Ya revisé: conservar mis cambios" })
    .click();
  api.failWrite = false;
  api.writeError = {
    status: 404,
    code: "missing",
    error: "El producto ya no existe.",
  };
  await save(page).click();
  await expect(name(page)).toHaveValue("Conservar");
  await expect(save(page)).toBeDisabled();
  expect(api.writes.every((item) => item.method === "PUT")).toBe(true);
});
test("permission revocation removes catalog and draft, with no success", async ({
  page,
  catalogHarness,
}) => {
  const api = await catalogApiFixture(page);
  await page.goto(catalogHarness);
  await edit(page);
  api.writeError = {
    status: 403,
    code: "missing_permission",
    error: "Acceso retirado",
  };
  await save(page).click();
  await expect(page.locator(".catalog-list")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Producto guardado.")).toHaveCount(0);
});
test("confirmed write with failed GET retries only reading and blocks duplicate submit", async ({
  page,
  catalogHarness,
}) => {
  const api = await catalogApiFixture(page);
  await page.goto(catalogHarness);
  await edit(page);
  api.failRead = true;
  await name(page).fill("Guardar una vez");
  await save(page).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(api.writes).toHaveLength(1);
  api.failRead = false;
  await page.getByRole("button", { name: "Reintentar lectura" }).click();
  await expect(
    page.getByText("Guardar una vez", { exact: true }),
  ).toBeVisible();
  expect(api.writes).toHaveLength(1);
});
test("uncertain POST remains blocked after discarding until an authoritative catalog read", async ({
  page,
  catalogHarness,
}) => {
  const api = await catalogApiFixture(page);
  await page.goto(catalogHarness);
  await page.getByRole("button", { name: "Cerrar la guía de inicio" }).click();
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  await name(page).fill("Alta confirmada sin respuesta");
  api.writeError = {
    status: 503,
    code: "uncertain",
    error: "Respuesta perdida",
  };
  // The authoritative server state contains the product even though its write response failed.
  api.products.push({
    ...api.products[0],
    id: "confirmed-create",
    name: "Alta confirmada sin respuesta",
  });
  await save(page).click();
  await expect(save(page)).toBeDisabled();
  await page.getByRole("button", { name: "Descartar borrador" }).click();
  await expect(
    page.getByRole("button", { name: "Nuevo producto" }),
  ).toBeDisabled();
  expect(api.writes).toHaveLength(1);
  api.failRead = true;
  await page.getByRole("button", { name: "Reintentar lectura" }).click();
  await expect(
    page.getByRole("button", { name: "Nuevo producto" }),
  ).toBeDisabled();
  api.failRead = false;
  await page.getByRole("button", { name: "Reintentar lectura" }).click();
  await expect(
    page.getByText("Alta confirmada sin respuesta", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nuevo producto" }),
  ).toBeEnabled();
  expect(api.writes).toHaveLength(1);
});
test("crossed price and measure changes require review of the whole commercial basis", async ({
  page,
  catalogHarness,
}) => {
  const api = await catalogApiFixture(page);
  await page.goto(catalogHarness);
  await edit(page);
  await page
    .getByRole("textbox", { name: "Precio de venta (opcional)" })
    .fill("5");
  const remote = {
    ...api.products[0],
    soldByWeight: true,
    pricingUnit: "lb",
    unitPrice: "8",
    catalogRevision: "2",
  };
  api.writeError = {
    status: 409,
    code: "catalog_changed",
    error: "El producto cambió.",
    product: remote,
  };
  await save(page).click();
  await expect(
    page.getByText(
      /Ambos cambiaron: Venta por peso \/ Unidad de venta \/ Precio de venta \/ Precio de costo/,
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ya revisé: conservar mis cambios" })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Este producto se vende por peso" }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("textbox", { name: "Precio de venta (opcional)" }),
  ).toHaveValue("5");
  api.writeError = null;
  await save(page).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(api.writes.at(-1)?.body).toMatchObject({
    unitPrice: "5",
    soldByWeight: false,
    pricingUnit: "unit",
    expectedSalesRevision: "2",
  });
});
test("conflict retains category, selected locations and image removal through explicit review", async ({
  page,
  catalogHarness,
}) => {
  const api = await catalogApiFixture(page);
  api.locations.push({ id: "location-two", name: "Norte" });
  api.products[0].imagePath =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=";
  await page.goto(catalogHarness);
  await edit(page);
  await page.getByRole("button", { name: /Categoría/ }).click();
  await page.getByRole("option", { name: "Postres" }).click();
  await page.getByRole("button", { name: "Quitar", exact: true }).click();
  await page.getByRole("radio", { name: /Locales específicos/ }).check();
  await page.getByRole("checkbox", { name: "Norte", exact: true }).check();
  const remote = {
    ...api.products[0],
    name: "Remoto",
    categoryId: null,
    availableAllLocations: false,
    locationIds: ["location-one"],
    catalogRevision: "2",
    imagePath: "/remote-image.png",
  };
  api.writeError = {
    status: 409,
    code: "catalog_changed",
    error: "El producto cambió.",
    product: remote,
  };
  await save(page).click();
  await expect(
    page.getByText(
      /Ambos cambiaron: Categoría, Disponibilidad \/ Locales, Imagen/,
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Locales: Centro", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ya revisé: conservar mis cambios" })
    .click();
  await expect(name(page)).toHaveValue("Remoto");
  await expect(
    page.getByRole("checkbox", { name: "Norte", exact: true }),
  ).toBeChecked();
  api.writeError = null;
  await save(page).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(api.writes.at(-1)?.body).toMatchObject({
    categoryId: "category-second",
    availableAllLocations: false,
    locationIds: ["location-two"],
    imageAction: "remove",
    expectedSalesRevision: "2",
  });
});
