import { expect } from "@playwright/test";
import { test, brandFixture, title, next } from "./support/brand-tour-fixture";

test.use({ reducedMotion: "reduce" });

test("orientación con logo conserva identidad y no escribe Marca", async ({
  page,
  brandHarness,
}) => {
  const api = await brandFixture(page);
  api.brand.logoPath =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
  await page.goto(`${brandHarness}?tour=onboarding`);
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
  await expect(
    page.getByRole("textbox", { name: "Nombre del negocio" }),
  ).toHaveValue("Café Inicial");
  await expect(page.getByAltText("Logo de Café Inicial")).toHaveAttribute(
    "src",
    api.brand.logoPath,
  );
  expect(api.writes).toEqual([]);
  expect(api.uploads).toBe(0);
});

for (const status of [200, 503])
  test(`progreso tardío ${status} conserva error del editor y borrador`, async ({
    page,
    brandHarness,
  }) => {
    const api = await brandFixture(page);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let requested = false;
    await page.route("**/api/onboarding/tours/brand", async (route) => {
      requested = true;
      await pending;
      if (status === 200) api.progress.push("skipped");
      await route.fulfill({
        status,
        json:
          status === 200
            ? { status: "skipped" }
            : { error: "Progreso rechazado.", code: "onboarding_unavailable" },
      });
    });
    await page.goto(`${brandHarness}?tour=onboarding`);
    await expect(title(page)).toHaveText("Dale identidad a tu negocio");
    await page.getByRole("button", { name: "Saltar tour" }).click();
    await expect.poll(() => requested).toBe(true);
    await expect(page.locator(".onboarding-zone")).toBeVisible();
    const name = page.getByRole("textbox", { name: "Nombre del negocio" });
    await name.fill("Borrador después del tour");
    api.failPut = 422;
    // The restored floating checklist can cover the footer; use the keyboard.
    const save = page.getByRole("button", {
      name: "Guardar marca",
      exact: true,
    });
    await save.focus();
    await save.press("Enter");
    const editorError = page.getByText("No pudimos aplicar esos cambios.");
    await expect(editorError).toBeVisible();
    release();
    // Wait for the late response to affect the UI before checking the editor.
    if (status === 200)
      await expect(page.locator(".onboarding-zone")).toHaveCount(0);
    else
      await expect(
        page.getByText("No pudimos guardar tu progreso."),
      ).toBeVisible();
    await expect(editorError).toBeVisible();
    await expect(name).toHaveValue("Borrador después del tour");
    expect(api.writes).toHaveLength(1);
    expect(api.uploads).toBe(0);
  });
