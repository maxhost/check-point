import { expect } from "@playwright/test";
import { test, brandFixture } from "./support/brand-tour-fixture";

test("Marca conserva identidad y no expone ni envía Regional/Fiscal", async ({
  page,
  brandHarness,
}) => {
  const api = await brandFixture(page);
  await page.goto(brandHarness);
  await page
    .getByRole("button", { name: "Cerrar la guía de inicio", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Nombre del negocio" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Paleta de colores" }),
  ).toBeVisible();
  for (const name of ["Configuración regional", "Datos fiscales"])
    await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(
      0,
    );
  await expect(
    page.getByRole("button", { name: "Zona horaria del negocio" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Tasa de IVA de venta (%)" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Guardar marca", exact: true })
    .click();
  await expect.poll(() => api.writes.length).toBe(1);
  expect(api.writes[0]).toMatchObject({ name: "Café Inicial", revision: 1 });
  for (const field of [
    "timezone",
    "currencyCode",
    "chargesVat",
    "saleVatRate",
    "recoversPurchaseVat",
  ])
    expect(api.writes[0]).not.toHaveProperty(field);
});
