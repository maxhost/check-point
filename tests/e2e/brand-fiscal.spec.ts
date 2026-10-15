import { expect, type Page } from "@playwright/test";
import { test, brandFixture } from "./support/brand-tour-fixture";

test.use({ reducedMotion: "reduce" });
const rate = (page: Page) =>
  page.getByRole("textbox", { name: "Tasa de IVA de venta (%)", exact: true });
const save = (page: Page) =>
  page.getByRole("button", { name: "Guardar marca", exact: true });
async function choose(page: Page, label: string, value: string) {
  await page.getByRole("button", { name: new RegExp(label) }).click();
  await page.getByRole("option", { name: value, exact: true }).click();
}

for (const width of [390, 1280]) {
  test(`fiscal ${width}px: required, exact payload, independent flags, retention and reload`, async ({
    page,
    brandHarness,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const api = await brandFixture(page);
    await page.goto(brandHarness);
    await page
      .getByRole("button", { name: "Cerrar la guía de inicio", exact: true })
      .click();
    const section = page
      .getByRole("heading", { name: "Datos fiscales", exact: true })
      .locator("..", { has: page.locator("p") })
      .locator("../..");
    await expect(
      page.getByText(
        "Guardamos estos datos para funciones futuras. Hoy no cambian los precios del catálogo, los cobros del POS ni los costos de tus insumos.",
        { exact: true },
      ),
    ).toBeVisible();
    const headings = await page.locator(".brand-editor h2").allTextContents();
    expect(headings.slice(-2)).toEqual([
      "Configuración regional",
      "Datos fiscales",
    ]);
    await expect(rate(page)).toBeDisabled();
    await expect(rate(page)).toHaveValue("");
    await choose(page, "¿Cobras IVA", "Sí");
    await expect(rate(page)).toBeEnabled();
    await expect(rate(page)).toHaveAttribute("aria-required", "true");
    await save(page).click();
    await expect(
      page.getByText("Ingresa la tasa de IVA de venta para guardar.").first(),
    ).toBeVisible();
    expect(api.writes).toHaveLength(0);
    await rate(page).fill("15.001");
    await save(page).click();
    expect(api.writes).toHaveLength(0);
    await rate(page).fill("15.5");
    await choose(page, "¿Recuperas el IVA", "Sí");
    await choose(page, "¿Cobras IVA", "No");
    await expect(rate(page)).toBeDisabled();
    await expect(rate(page)).toHaveValue("15.5");
    await save(page).click();
    await expect.poll(() => api.writes.length).toBe(1);
    expect(api.writes[0]).toMatchObject({
      chargesVat: false,
      saleVatRate: "15.50",
      recoversPurchaseVat: true,
    });
    await expect(rate(page)).toHaveValue("15.50");
    await page.reload();
    await expect(rate(page)).toBeDisabled();
    await expect(rate(page)).toHaveValue("15.50");
    await choose(page, "¿Cobras IVA", "Sí");
    await rate(page).fill("0");
    await save(page).click();
    await expect.poll(() => api.writes.length).toBe(2);
    expect(api.writes[1]).toMatchObject({
      chargesVat: true,
      saleVatRate: "0.00",
      recoversPurchaseVat: true,
    });
    await expect(rate(page)).toHaveValue("0.00");
    await expect(save(page)).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await section.screenshot({
      animations: "disabled",
      path: testInfo.outputPath(`checkpass-0229-fiscal-${width}-light.png`),
    });
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: testInfo.outputPath(`checkpass-0229-page-${width}-light.png`),
    });
    await page.evaluate(
      () => (document.documentElement.dataset.theme = "dark"),
    );
    await section.screenshot({
      animations: "disabled",
      path: testInfo.outputPath(`checkpass-0229-fiscal-${width}-dark.png`),
    });
    await page.screenshot({
      animations: "disabled",
      fullPage: true,
      path: testInfo.outputPath(`checkpass-0229-page-${width}-dark.png`),
    });
  });
}

test("fiscal: failed save keeps draft; conflict consult preserves it and adoption replaces every flag", async ({
  page,
  brandHarness,
}) => {
  const api = await brandFixture(page);
  await page.goto(brandHarness);
  await page
    .getByRole("button", { name: "Cerrar la guía de inicio", exact: true })
    .click();
  await choose(page, "¿Cobras IVA", "Sí");
  await rate(page).fill("19.25");
  await choose(page, "¿Recuperas el IVA", "Sí");
  api.failPut = 503;
  await save(page).click();
  await expect(
    page.getByText("No pudimos aplicar esos cambios."),
  ).toBeVisible();
  await expect(rate(page)).toHaveValue("19.25");
  expect(api.brand.saleVatRate).toBeNull();
  api.failPut = 409;
  await save(page).click();
  await expect(
    page.getByRole("button", { name: "Consultar marca actual" }),
  ).toBeVisible();
  api.brand = {
    ...api.brand,
    brandRevision: 2,
    chargesVat: true,
    saleVatRate: "0.00",
    recoversPurchaseVat: false,
  };
  await page.getByRole("button", { name: "Consultar marca actual" }).click();
  await expect(
    page.getByRole("heading", { name: "Versión guardada" }),
  ).toBeVisible();
  await expect(rate(page)).toHaveValue("19.25");
  await expect(page.locator(".brand-recovery")).toContainText("0.00");
  await page
    .getByRole("button", { name: "Usar versión guardada", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Descartar borrador y usar versión guardada",
      exact: true,
    })
    .click();
  await expect(rate(page)).toHaveValue("0.00");
  await expect(
    page.getByRole("button", { name: /¿Recuperas el IVA/ }),
  ).toContainText("No");
  await expect(save(page)).toBeEnabled();
  expect(api.writes).toHaveLength(2);
});

test("fiscal: pending save and rejected access freeze the fiscal controls", async ({
  page,
  brandHarness,
}) => {
  const api = await brandFixture(page);
  api.brand.chargesVat = true;
  api.brand.saleVatRate = "15.00";
  await page.goto(brandHarness);
  await page
    .getByRole("button", { name: "Cerrar la guía de inicio", exact: true })
    .click();
  let release!: () => void;
  api.holdPut = new Promise<void>((resolve) => {
    release = resolve;
  });
  api.failPut = 403;
  await save(page).click();
  await expect.poll(() => api.writes.length).toBe(1);
  await expect(rate(page)).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /¿Cobras IVA/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /¿Recuperas el IVA/ }),
  ).toBeDisabled();
  release();
  await expect(
    page.getByText("No pudimos aplicar esos cambios."),
  ).toBeVisible();
  await expect(save(page)).toBeDisabled();
  await expect(rate(page)).toHaveValue("15.00");
});
