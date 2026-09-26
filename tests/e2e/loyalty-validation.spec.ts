import { expect } from "@playwright/test";
import {
  test,
  loyaltyFixture,
  next,
  business,
} from "./support/loyalty-fixture";
test("GET DTO inválido y templates inválidas muestran error recuperable", async ({
  page,
  loyaltyHarness,
}) => {
  const api = await loyaltyFixture(page);
  api.program = {};
  await page.goto(loyaltyHarness);
  await expect(page.getByRole("alert")).toBeVisible();
  api.program = null;
  await page.getByRole("button", { name: "Reintentar lectura" }).click();
  await expect(
    page.getByRole("heading", { name: "Creá tu programa" }),
  ).toBeVisible();
  await page.route("**/api/loyalty-terms/templates", (route) =>
    route.fulfill({ json: { templates: [{ id: "t" }] } }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(api.writes).toHaveLength(0);
  void business;
});
test("meta mínimo máximo y límite20, último premio conservado", async ({
  page,
  loyaltyHarness,
}) => {
  await loyaltyFixture(page);
  await page.goto(loyaltyHarness);
  await page.getByRole("radio", { name: /Sellos Una tarjeta/ }).focus();
  await page.keyboard.press("Space");
  await next(page);
  const target = page.getByRole("textbox", { name: "Sellos para completar" });
  await target.fill("");
  await next(page);
  await expect(page.getByText("Elegí un entero entre 2 y 50")).toBeVisible();
  for (const value of ["1", "51"]) {
    await target.fill(value);
    await next(page);
    await expect(page.getByText("Elegí un entero entre 2 y 50")).toBeVisible();
  }
  await target.fill("2");
  await target.press("Tab");
  await expect(
    page.getByRole("button", { name: /Decrease Sellos/ }),
  ).toBeDisabled();
  await target.fill("50");
  await target.press("Tab");
  await expect(
    page.getByRole("button", { name: /Increase Sellos/ }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Atrás" }).click();
  await page.getByRole("radio", { name: /Puntos Una unidad/ }).focus();
  await page.keyboard.press("Space");
  await next(page);
  await next(page);
  await page
    .getByRole("textbox", { name: "Texto de términos" })
    .fill("Términos");
  await next(page);
  await expect(page.getByRole("button", { name: /Quitar premio/ })).toHaveCount(
    0,
  );
  for (let index = 1; index < 20; index++)
    await page
      .getByRole("button", { name: "Agregar premio", exact: true })
      .click();
  await expect(page.getByText("Podés agregar hasta 20 premios.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Agregar premio", exact: true }),
  ).toBeDisabled();
});
test("catálogo vacío explícito conserva producto guardado", async ({
  page,
  loyaltyHarness,
}) => {
  const api = await loyaltyFixture(page, true);
  await page.route("**/api/catalog", (route) =>
    route.fulfill({ json: { products: [] } }),
  );
  await page.goto(loyaltyHarness);
  await page.getByRole("button", { name: "Editar programa" }).click();
  await next(page);
  await next(page);
  await next(page);
  await expect(
    page.getByText("No hay productos en tu catálogo", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Café guardado Producto/ }),
  ).toBeVisible();
  await next(page);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(
    page.getByRole("button", { name: "Editar programa" }),
  ).toBeVisible();
  expect(api.writes[0].body.rewards).toMatchObject([{ productId: "missing" }]);
});
