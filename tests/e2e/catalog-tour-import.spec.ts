import { expect } from "@playwright/test";
import { test, title, help } from "./support/catalog-tour-fixture";
import { catalogApiFixture } from "./support/catalog-api-fixture";

test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

test("PDF autoanaliza; salir de la guía no cancela y resultado explica sin precio", async ({
  page,
  catalogHarness,
}) => {
  const api = await catalogApiFixture(page);
  await page.goto(catalogHarness);
  await help(page, "Importar un PDF");
  await page
    .getByRole("button", { name: "Importar con IA", exact: true })
    .click();
  await expect(title(page)).toHaveText("Elegí los archivos");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "menu.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("pdf fixture"),
    });
  await expect(title(page)).toHaveText("Estamos procesando tu menú");
  await expect(
    page.getByRole("button", { name: "Cancelar importación", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Salir de la guía", exact: true })
    .click();
  await expect(page.locator(".driver-popover")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Cancelar importación", exact: true }),
  ).toBeVisible();
  expect(api.cancellations).toBe(0);
  api.importStatus = "accepted";
  await expect(
    page.getByText("Catálogo importado", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("sin precio", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ver mi catálogo" }).click();
  expect(api.progress).toEqual([]);
});

test("fotos esperan Analizar y resultado termina la ayuda", async ({
  page,
  catalogHarness,
}) => {
  const api = await catalogApiFixture(page);
  await page.goto(catalogHarness);
  await help(page, "Importar fotos desde el celular");
  await page
    .getByRole("button", { name: "Importar con IA", exact: true })
    .click();
  await expect(title(page)).toHaveText("Elegí los archivos");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "menu.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("image fixture"),
    });
  await expect(title(page)).toHaveText("Analizá las fotos");
  expect(api.writes).toEqual([]);
  api.importStatus = "accepted";
  await page
    .getByRole("button", { name: "Analizar catálogo", exact: true })
    .click();
  await expect(title(page)).toHaveText("Tu catálogo ya está cargado");
  await page.getByRole("button", { name: "Ver mi catálogo" }).click();
  await expect(page.locator(".driver-popover")).toHaveCount(0);
  expect(api.progress).toEqual([]);
});

test("import existente y staff: permisos, bloqueo de altas y ningún progreso", async ({
  page,
  catalogHarness,
}) => {
  const api = await catalogApiFixture(page);
  api.importing = true;
  await page.goto(`${catalogHarness}?staff&tour=onboarding`);
  await expect(
    page.getByRole("heading", { name: "Productos listos para vender" }),
  ).toBeVisible();
  await expect(page.locator(".driver-popover")).toHaveCount(0);
  await page.getByRole("button", { name: "Ayuda", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "¿Qué querés hacer?" });
  await expect(
    dialog.getByRole("button", { name: /Crear un producto/ }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: /Eliminar un producto/ }),
  ).toBeDisabled();
  await dialog
    .getByRole("button", { name: /Ver importación en curso/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Importar con IA", exact: true })
    .click();
  await expect(title(page)).toHaveText("Estamos procesando tu menú");
  expect(api.progress).toEqual([]);
});
