import { expect } from "@playwright/test";
import {
  test,
  title,
  next,
  help,
  fieldsToSave,
} from "./support/catalog-tour-fixture";
import { catalogApiFixture } from "./support/catalog-api-fixture";

test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

test("crear categoría no avanza por un clic fallido ni persiste onboarding", async ({
  page,
  catalogHarness,
}) => {
  const api = await catalogApiFixture(page);
  await page.goto(catalogHarness);
  await help(page, "Crear una categoría");
  await page
    .getByRole("textbox", { name: "Nueva categoría" })
    .fill("Panadería");
  await next(page);
  api.failWrite = true;
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await expect(page.getByText("No pudimos guardar el producto.")).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(title(page)).toHaveText("Guardá los datos");
  api.failWrite = false;
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await expect(title(page)).toHaveText("Operación confirmada");
  await next(page);
  expect(api.categories.at(-1)?.name).toBe("Panadería");
  expect(api.progress).toEqual([]);
});

test("crear producto y reintentar una lectura no duplica el POST", async ({
  page,
  catalogHarness,
}) => {
  const api = await catalogApiFixture(page);
  await page.goto(catalogHarness);
  await help(page, "Crear un producto");
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  await expect(title(page)).toHaveText("Completá el nombre");
  await page
    .getByRole("textbox", { name: "Nombre del producto" })
    .fill("Chocolate");
  await fieldsToSave(page);
  api.failRead = true;
  await page
    .getByRole("button", { name: "Guardar producto", exact: true })
    .click();
  await expect(title(page)).toHaveText("Los cambios ya se guardaron");
  expect(api.writes.filter((item) => item.method === "POST")).toHaveLength(1);
  api.failRead = false;
  await page.getByRole("button", { name: "Reintentar lectura" }).click();
  await expect(title(page)).toHaveText("Operación confirmada");
  expect(api.writes.filter((item) => item.method === "POST")).toHaveLength(1);
  expect(api.progress).toEqual([]);
});

test("editar el segundo producto conserva el id y espera éxito", async ({
  page,
  catalogHarness,
}) => {
  const api = await catalogApiFixture(page);
  await page.goto(catalogHarness);
  await help(page, "Editar un producto");
  await page
    .locator('[data-catalog-id="product-second"]')
    .getByRole("button", { name: "Editar", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Nombre del producto" }),
  ).toHaveValue("Torta");
  await page
    .getByRole("textbox", { name: "Nombre del producto" })
    .fill("Torta de cacao");
  await fieldsToSave(page);
  api.failWrite = true;
  await page
    .getByRole("button", { name: "Guardar producto", exact: true })
    .click();
  await expect(page.getByText("No pudimos guardar el producto.")).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(title(page)).toHaveText("Guardá los datos");
  api.failWrite = false;
  await page
    .getByRole("button", { name: "Guardar producto", exact: true })
    .click();
  await expect(title(page)).toHaveText("Operación confirmada");
  expect(api.writes.every((item) => item.path.endsWith("product-second"))).toBe(
    true,
  );
  expect(api.products[0].name).toBe("Café");
});

test("editar categoría y Escape permite salir conservando el formulario", async ({
  page,
  catalogHarness,
}) => {
  const api = await catalogApiFixture(page);
  await page.goto(catalogHarness);
  await help(page, "Editar una categoría");
  await page
    .locator('[data-catalog-id="category-second"]')
    .getByRole("button", { name: "Renombrar" })
    .click();
  await page.getByRole("textbox", { name: "Renombrar Postres" }).fill("Dulces");
  await next(page);
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(title(page)).toHaveText("Operación confirmada");
  await next(page);
  expect(api.categories[1].name).toBe("Dulces");
  await help(page, "Crear un producto");
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  await expect(title(page)).toHaveText("Completá el nombre");
  await page.keyboard.press("Escape");
  await expect(page.locator(".driver-popover")).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "Sumá un producto al catálogo" }),
  ).toBeVisible();
  expect(api.progress).toEqual([]);
});
