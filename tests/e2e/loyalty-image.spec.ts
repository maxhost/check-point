import { expect } from "@playwright/test";
import { test, loyaltyFixture, next } from "./support/loyalty-fixture";
const png = {
  name: "sello.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  ),
};
test("preparación tardía cancelada no restaura selección; crop real cancelar y elegir sin write", async ({
  page,
  loyaltyHarness,
}) => {
  const api = await loyaltyFixture(page, true);
  await page.addInitScript(() => {
    const NativeImage = window.Image;
    window.Image = class extends NativeImage {
      constructor() {
        super();
        const add = this.addEventListener.bind(this);
        Object.defineProperty(this, "onload", {
          set(fn) {
            if (fn) add("load", () => setTimeout(() => fn.call(this), 500));
          },
        });
      }
    } as typeof Image;
  });
  await page.goto(loyaltyHarness);
  await page.getByRole("button", { name: "Editar programa" }).click();
  await next(page);
  await page.getByLabel("Archivo del sello").setInputFiles(png);
  await expect(
    page.getByRole("button", { name: "Continuar", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancelar preparación" }).click();
  await page.waitForTimeout(700);
  await expect(page.locator(".image-cropper")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Continuar", exact: true }),
  ).toBeEnabled();
  expect(api.writes).toHaveLength(0);
  await page
    .getByLabel("Archivo del sello")
    .setInputFiles({ ...png, name: "nuevo.png" });
  await expect(page.locator(".image-cropper")).toBeVisible();
  await page
    .locator(".image-cropper")
    .getByRole("button", { name: "Cancelar", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Elegir sello", exact: true }),
  ).toBeVisible();
  expect(api.writes).toHaveLength(0);
  await page.getByLabel("Archivo del sello").setInputFiles(png);
  await page.getByLabel("Archivo del sello").setInputFiles({
    name: "bad.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("bad"),
  });
  await page.waitForTimeout(700);
  await expect(
    page.getByRole("button", { name: "Continuar", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".image-cropper")).toHaveCount(0);
});
test("navegación staff cinco permisos a320 y owner destino único", async ({
  page,
  loyaltyHarness,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await loyaltyFixture(page);
  await page.goto(`${loyaltyHarness}?staff`);
  await page
    .getByRole("button", { name: "Administración", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("link", { name: "Fidelización", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(loyaltyHarness);
  await expect(
    page
      .locator(".backoffice-sidebar")
      .getByRole("link", { name: "Programa de fidelización" }),
  ).toHaveCount(1);
});
test("diseño teclado slider checkbox preset intermedio y estilos", async ({
  page,
  loyaltyHarness,
}) => {
  await loyaltyFixture(page, true);
  await page.goto(loyaltyHarness);
  await page.getByRole("button", { name: "Editar programa" }).click();
  await next(page);
  const checkbox = page.getByRole("checkbox", { name: /Usar degradé/ });
  await checkbox.focus();
  await page.keyboard.press("Space");
  const slider = page.getByRole("slider");
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("195°", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Vertical", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  const button = page.getByRole("button", { name: "Atrás", exact: true });
  expect(
    await button.evaluate(
      (element) => getComputedStyle(element).borderTopWidth,
    ),
  ).toBe("1px");
});
test("recorte aplica al guardar, metadata y carga", async ({
  page,
  loyaltyHarness,
}) => {
  const api = await loyaltyFixture(page, true);
  api.program!.stampImagePath =
    "data:image/png;base64," + png.buffer.toString("base64");
  await page.goto(loyaltyHarness);
  await page.getByRole("button", { name: "Editar programa" }).click();
  await next(page);
  await page.getByLabel("Archivo del sello").setInputFiles(png);
  await expect(page.locator(".image-cropper")).toBeVisible();
  await page
    .locator(".image-cropper")
    .getByRole("button", { name: "Usar", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Cambiar sello" }),
  ).toBeVisible();
  expect(api.uploads).toBe(0);
  expect(api.writes).toHaveLength(0);
  await next(page);
  await next(page);
  await next(page);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(
    page.getByRole("button", { name: "Editar programa" }),
  ).toBeVisible();
  expect(api.uploads).toBe(1);
  expect(api.writes[0].body).toMatchObject({
    stampAction: "replace",
    stampUploadId: "stamp-upload-1",
    stampCropped: true,
  });
});
test("quitar invalida preparación tardía y envía remove sólo al guardar", async ({
  page,
  loyaltyHarness,
}) => {
  const api = await loyaltyFixture(page, true);
  api.program!.stampImagePath =
    "data:image/png;base64," + png.buffer.toString("base64");
  await page.addInitScript(() => {
    const NativeImage = window.Image;
    window.Image = class extends NativeImage {
      constructor() {
        super();
        const add = this.addEventListener.bind(this);
        Object.defineProperty(this, "onload", {
          set(fn) {
            if (fn) add("load", () => setTimeout(() => fn.call(this), 500));
          },
        });
      }
    } as typeof Image;
  });
  await page.goto(loyaltyHarness);
  await page.getByRole("button", { name: "Editar programa" }).click();
  await next(page);
  await page.getByLabel("Archivo del sello").setInputFiles(png);
  await page.getByRole("button", { name: "Quitar", exact: true }).click();
  await page.waitForTimeout(700);
  await expect(page.locator(".image-cropper")).toHaveCount(0);
  await expect(
    page.getByRole("img", { name: "Vista previa del sello" }),
  ).toHaveCount(0);
  await next(page);
  await next(page);
  await next(page);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(
    page.getByRole("button", { name: "Editar programa" }),
  ).toBeVisible();
  expect(api.writes[0].body.stampAction).toBe("remove");
  expect(api.uploads).toBe(0);
});
