import { expect } from "@playwright/test";
import { test, help, title } from "./support/catalog-tour-fixture";
import { catalogApiFixture } from "./support/catalog-api-fixture";
test.use({ reducedMotion: "reduce" });
test("una respuesta de otro recorrido no avanza la sesión nueva", async ({
  page,
  catalogHarness,
}) => {
  await page.goto(`${catalogHarness}?tickets`);
  await page.getByRole("button", { name: "Primero" }).click();
  await page.getByRole("button", { name: "Capturar" }).click();
  await page.getByRole("button", { name: "Segundo" }).click();
  await expect(page.locator("output")).toHaveText("two:name");
  await page.getByRole("button", { name: "Resolver" }).click();
  await expect(page.locator("output")).toHaveText("two:name");
});
test("guardar con Enter termina por éxito aunque queden instrucciones", async ({
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
    .fill("Guardado con teclado");
  await page
    .getByRole("textbox", { name: "Nombre del producto" })
    .press("Enter");
  await expect(title(page)).toHaveText("Operación confirmada");
  expect(api.writes).toHaveLength(1);
  expect(api.progress).toEqual([]);
});
