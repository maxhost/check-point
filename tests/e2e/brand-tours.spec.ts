import { expect } from "@playwright/test";
import {
  test,
  brandFixture,
  title,
  next,
  help,
} from "./support/brand-tour-fixture";
test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

test("cinco pasos sin editar y checklist, parámetro consumido y completed", async ({
  page,
  brandHarness,
}) => {
  const api = await brandFixture(page);
  await page.goto(`${brandHarness}/backoffice/brand?tour=onboarding&keep=1`);
  for (const expected of [
    "Dale identidad a tu negocio",
    "Usá los colores de tu marca",
    "Revisá horarios y moneda",
    "Aplicá tus cambios cuando estén listos",
    "Encontrá una guía cuando la necesites",
  ]) {
    await expect(title(page)).toHaveText(expected);
    await next(page);
  }
  await expect.poll(() => api.progress).toEqual(["completed"]);
  expect(api.writes).toEqual([]);
  expect(api.uploads).toBe(0);
  expect(page.url()).toContain("keep=1");
  expect(page.url()).not.toContain("tour=onboarding");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "La identidad de tu negocio" }),
  ).toBeVisible();
  await expect(page.locator(".driver-popover")).toHaveCount(0);
});
test("Saltar con error permite reintentar sólo progreso", async ({
  page,
  brandHarness,
}) => {
  const api = await brandFixture(page);
  api.failProgress = true;
  await page.goto(`${brandHarness}/backoffice/brand?tour=onboarding`);
  await expect(title(page)).toHaveText("Dale identidad a tu negocio");
  await page.getByRole("button", { name: "Saltar tour" }).click();
  await expect(page.getByText("No pudimos guardar tu progreso.")).toBeVisible();
  await expect(page.locator(".onboarding-zone")).toBeVisible();
  api.failProgress = false;
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect.poll(() => api.progress).toEqual(["skipped"]);
  expect(api.writes).toEqual([]);
});
test("nombre conserva otras ediciones, fallo no avanza y success usa DTO normalizado", async ({
  page,
  brandHarness,
}) => {
  const api = await brandFixture(page);
  await page.goto(brandHarness);
  await page
    .getByRole("textbox", { name: "Código hexadecimal acento" })
    .fill("#AABBCC");
  await help(page, "Cambiar el nombre");
  await page
    .getByRole("textbox", { name: "Nombre del negocio" })
    .fill("  Café   Nuevo  ");
  await next(page);
  await next(page);
  await expect(title(page)).toHaveText("Guardá la marca");
  await expect(page.locator(".driver-popover-description")).toContainText(
    "todos los cambios pendientes",
  );
  api.failPut = 422;
  await page
    .getByRole("button", { name: "Guardar marca", exact: true })
    .click();
  await expect.poll(() => api.writes.length).toBe(1);
  await expect(
    page.getByText("No pudimos aplicar esos cambios."),
  ).toBeVisible();
  await expect(title(page)).toHaveText("Guardá la marca");
  await expect(
    page.getByRole("textbox", { name: "Nombre del negocio" }),
  ).toHaveValue("  Café   Nuevo  ");
  api.failPut = 0;
  await page
    .getByRole("button", { name: "Guardar marca", exact: true })
    .click();
  await expect(title(page)).toHaveText("Marca guardada");
  expect(api.writes[1].brandAccentColor).toBe("#AABBCC");
  await next(page);
  await expect(
    page.getByRole("textbox", { name: "Nombre del negocio" }),
  ).toHaveValue("Café Nuevo");
  expect(api.progress).toEqual([]);
});
for (const task of [
  { name: "Ajustar los colores", steps: 4 },
  { name: "Cambiar la zona horaria", steps: 1 },
  { name: "Cambiar la moneda", steps: 1 },
])
  test(`${task.name}: usa el editor real y espera guardado`, async ({
    page,
    brandHarness,
  }) => {
    const api = await brandFixture(page);
    await page.goto(brandHarness);
    await help(page, task.name);
    if (task.name === "Cambiar la moneda") {
      await expect(page.locator(".driver-popover-description")).toContainText(
        "No convierte",
      );
      await page.getByRole("button", { name: "Moneda" }).click();
      await page.getByRole("option", { name: /EUR/ }).click();
    }
    if (task.name === "Cambiar la zona horaria") {
      await page
        .getByRole("button", { name: "Zona horaria del negocio" })
        .click();
      await page
        .getByRole("option", { name: "America/Lima", exact: true })
        .click();
    }
    for (let i = 0; i < task.steps; i++) await next(page);
    await expect(title(page)).toHaveText("Guardá la marca");
    await page
      .getByRole("button", { name: "Guardar marca", exact: true })
      .click();
    await expect(title(page)).toHaveText("Marca guardada");
    await next(page);
    expect(api.progress).toEqual([]);
    expect(api.writes).toHaveLength(1);
    if (task.name === "Cambiar la moneda")
      expect(api.writes[0].currencyCode).toBe("EUR");
    if (task.name === "Cambiar la zona horaria")
      expect(api.writes[0].timezone).toBe("America/Lima");
  });
test("Quitar es borrador, guardado fallido no avanza y no persiste onboarding", async ({
  page,
  brandHarness,
}) => {
  const api = await brandFixture(page);
  api.brand.logoPath =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
  await page.goto(brandHarness);
  await help(page, "Quitar el logo");
  await page.getByRole("button", { name: "Quitar", exact: true }).click();
  await expect(title(page)).toHaveText("Revisá la vista previa");
  expect(api.writes).toEqual([]);
  await next(page);
  api.failPut = 503;
  await page
    .getByRole("button", { name: "Guardar marca", exact: true })
    .click();
  await expect.poll(() => api.writes.length).toBe(1);
  await expect(
    page.getByText("No pudimos aplicar esos cambios."),
  ).toBeVisible();
  await expect(title(page)).toHaveText("Guardá la marca");
  api.failPut = 0;
  await page
    .getByRole("button", { name: "Guardar marca", exact: true })
    .click();
  await expect(title(page)).toHaveText("Marca guardada");
  expect(api.brand.logoPath).toBeNull();
  expect(api.progress).toEqual([]);
});
test("Salir conserva el borrador y otra ayuda puede empezar", async ({
  page,
  brandHarness,
}) => {
  const api = await brandFixture(page);
  await page.goto(brandHarness);
  await help(page, "Cambiar el nombre");
  await page
    .getByRole("textbox", { name: "Nombre del negocio" })
    .fill("Borrador conservado");
  await page.getByRole("button", { name: "Salir de la guía" }).click();
  await expect(
    page.getByRole("textbox", { name: "Nombre del negocio" }),
  ).toHaveValue("Borrador conservado");
  await help(page, "Ajustar los colores");
  await page.keyboard.press("Escape");
  await expect(page.locator(".driver-popover")).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Nombre del negocio" }),
  ).toHaveValue("Borrador conservado");
  expect(api.progress).toEqual([]);
  expect(api.writes).toEqual([]);
});
test("conflicto conserva borrador, GET fallido reintenta lectura y adopción requiere confirmar", async ({
  page,
  brandHarness,
}) => {
  const api = await brandFixture(page);
  await page.goto(brandHarness);
  await help(page, "Cambiar el nombre");
  await page
    .getByRole("textbox", { name: "Nombre del negocio" })
    .fill("Borrador local");
  await next(page);
  await next(page);
  api.failPut = 409;
  api.brand.name = "Otra sesión";
  await page
    .getByRole("button", { name: "Guardar marca", exact: true })
    .click();
  await expect(title(page)).toHaveText("Revisá la versión guardada");
  api.failGet = 503;
  await page.getByRole("button", { name: "Consultar marca actual" }).click();
  await expect.poll(() => api.reads).toBe(2);
  api.failGet = 0;
  await page.getByRole("button", { name: "Consultar marca actual" }).click();
  await expect(page.getByText("Otra sesión", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Nombre del negocio" }),
  ).toHaveValue("Borrador local");
  await page
    .getByRole("button", { name: "Usar versión guardada", exact: true })
    .click();
  await page.getByRole("button", { name: "Conservar borrador" }).click();
  await expect(
    page.getByRole("textbox", { name: "Nombre del negocio" }),
  ).toHaveValue("Borrador local");
  await page
    .getByRole("button", { name: "Usar versión guardada", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Descartar borrador y usar versión guardada" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Nombre del negocio" }),
  ).toHaveValue("Otra sesión");
  expect(api.writes).toHaveLength(1);
  expect(api.progress).toEqual([]);
});
test("staff usa ayuda y no ve afiche ni inicia orientación", async ({
  page,
  brandHarness,
}) => {
  const api = await brandFixture(page);
  await page.goto(`${brandHarness}?staff=1&tour=onboarding`);
  await expect(
    page.getByRole("button", { name: "Ayuda", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Crear afiche" })).toHaveCount(0);
  await expect(page.locator(".driver-popover")).toHaveCount(0);
  await help(page, "Cambiar el nombre");
  await next(page);
  await next(page);
  await page
    .getByRole("button", { name: "Guardar marca", exact: true })
    .click();
  await expect(title(page)).toHaveText("Marca guardada");
  expect(api.progress).toEqual([]);
});
