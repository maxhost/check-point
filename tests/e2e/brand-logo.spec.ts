import { expect } from "@playwright/test";
import {
  test,
  brandFixture,
  title,
  next,
  help,
} from "./support/brand-tour-fixture";
const png = {
  name: "logo.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5WQAAAAASUVORK5CYII=",
    "base64",
  ),
};
test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
test("logo: selector cancelado e inválido no avanzan, recorte real y subida fallida conserva archivo", async ({
  page,
  brandHarness,
}) => {
  const api = await brandFixture(page);
  await page.goto(brandHarness);
  await help(page, "Cargar o cambiar el logo");
  await page.locator("#brand-logo-file").setInputFiles([]);
  await expect(title(page)).toHaveText("Elegí tu logo");
  await page.locator("#brand-logo-file").setInputFiles({
    name: "invalido.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("texto"),
  });
  await expect(title(page)).toHaveText("Elegí tu logo");
  expect(api.uploads).toBe(0);
  await page.locator("#brand-logo-file").setInputFiles(png);
  await expect(
    page.getByRole("dialog", { name: "Recortar imagen" }),
  ).toBeVisible();
  await expect(title(page)).toHaveText("Ajustá el encuadre");
  await page.getByRole("button", { name: "Usar", exact: true }).click();
  await expect(title(page)).toHaveText("Revisá la vista previa");
  expect(api.uploads).toBe(0);
  await next(page);
  api.failUpload = 503;
  await page
    .getByRole("button", { name: "Guardar marca", exact: true })
    .click();
  await expect.poll(() => api.uploads).toBe(1);
  await expect(title(page)).toHaveText("Guardá la marca");
  expect(api.writes).toEqual([]);
  api.failUpload = 0;
  await page
    .getByRole("button", { name: "Guardar marca", exact: true })
    .click();
  await expect(title(page)).toHaveText("Marca guardada");
  expect(api.writes[0]).toMatchObject({
    logoAction: "replace",
    cropped: true,
    uploadId: "upload-2",
  });
  expect(api.progress).toEqual([]);
});
test("Salir deja recorte abierto; Cancelar termina ayuda y mantiene el nombre pendiente", async ({
  page,
  brandHarness,
}) => {
  const api = await brandFixture(page);
  await page.goto(brandHarness);
  await page
    .getByRole("textbox", { name: "Nombre del negocio" })
    .fill("Pendiente");
  await help(page, "Cargar o cambiar el logo");
  await page.locator("#brand-logo-file").setInputFiles(png);
  await expect(title(page)).toHaveText("Ajustá el encuadre");
  await page.getByRole("button", { name: "Salir de la guía" }).click();
  await expect(
    page.getByRole("dialog", { name: "Recortar imagen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Nombre del negocio" }),
  ).toHaveValue("Pendiente");
  await help(page, "Cargar o cambiar el logo");
  await page.locator("#brand-logo-file").setInputFiles(png);
  await expect(title(page)).toHaveText("Ajustá el encuadre");
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.locator(".driver-popover")).toHaveCount(0);
  expect(api.writes).toEqual([]);
  expect(api.uploads).toBe(0);
  expect(api.progress).toEqual([]);
});
test("archivo no decodificable usa fallback sin exigir recorte", async ({
  page,
  brandHarness,
}) => {
  const api = await brandFixture(page);
  await page.goto(brandHarness);
  await help(page, "Cargar o cambiar el logo");
  await page.locator("#brand-logo-file").setInputFiles({
    name: "fallback.heic",
    mimeType: "image/heic",
    buffer: Buffer.from("probe no decodificable"),
  });
  await expect(title(page)).toHaveText("Revisá la vista previa");
  await expect(
    page.getByRole("dialog", { name: "Recortar imagen" }),
  ).toHaveCount(0);
  await next(page);
  await page
    .getByRole("button", { name: "Guardar marca", exact: true })
    .click();
  await expect(title(page)).toHaveText("Marca guardada");
  expect(api.writes[0]).toMatchObject({
    logoAction: "replace",
    cropped: false,
  });
});
test("teclado puede recorrer cropper y guía sin perder controles", async ({
  page,
  brandHarness,
}) => {
  await brandFixture(page);
  await page.goto(brandHarness);
  await help(page, "Cargar o cambiar el logo");
  await page.locator("#brand-logo-file").setInputFiles(png);
  await expect(title(page)).toHaveText("Ajustá el encuadre");
  await page.getByRole("slider", { name: "Zoom", exact: true }).focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() =>
      Boolean(
        document.activeElement?.closest(".image-cropper, .brand-tour-popover"),
      ),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator(".driver-popover")).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "Recortar imagen" }),
  ).toBeVisible();
});
