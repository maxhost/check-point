import { expect } from "@playwright/test";
import {
  test,
  brandFixture,
  title,
  next,
  help,
} from "./support/brand-tour-fixture";
test.use({ reducedMotion: "reduce" });
test("desmontaje de orientación limpia Driver sin registrar Saltar", async ({
  page,
  brandHarness,
}) => {
  const api = await brandFixture(page);
  await page.goto(`${brandHarness}?tour=onboarding`);
  await expect(title(page)).toHaveText("Dale identidad a tu negocio");
  await page.evaluate(() =>
    window.dispatchEvent(new Event("brand-fixture-unmount")),
  );
  await expect(page.locator(".driver-popover, .driver-overlay")).toHaveCount(0);
  expect(api.progress).toEqual([]);
  expect(api.writes).toEqual([]);
});
test("respuesta perdida ofrece consulta sin fingir éxito ni repetir PUT", async ({
  page,
  brandHarness,
}) => {
  const api = await brandFixture(page);
  await page.goto(brandHarness);
  await help(page, "Cambiar el nombre");
  await next(page);
  await next(page);
  await page.route("**/api/brand", (route) =>
    route.request().method() === "PUT" ? route.abort() : route.fallback(),
  );
  await page
    .getByRole("button", { name: "Guardar marca", exact: true })
    .click();
  await expect(title(page)).toHaveText("Revisá la versión guardada");
  await page.getByRole("button", { name: "Consultar marca actual" }).click();
  await expect(
    page.getByRole("heading", { name: "Versión guardada" }),
  ).toBeVisible();
  expect(api.progress).toEqual([]);
  expect(api.writes).toEqual([]);
});
test("una respuesta vieja no avanza otra instancia de guía", async ({
  page,
  brandHarness,
}) => {
  await page.goto(`${brandHarness}?tickets=1`);
  await page.getByRole("button", { name: "Primero" }).click();
  await page.getByRole("button", { name: "Capturar" }).click();
  await page.getByRole("button", { name: "Segundo" }).click();
  await expect(page.locator("output")).toHaveText("change-currency:save");
  await page.getByRole("button", { name: "Resolver" }).click();
  await expect(page.locator("output")).toHaveText("change-currency:save");
});
for (const status of [401, 403])
  test(`PUT ${status} termina guía, preserva error y no persiste`, async ({
    page,
    brandHarness,
  }) => {
    const api = await brandFixture(page);
    await page.goto(brandHarness);
    await help(page, "Cambiar el nombre");
    await next(page);
    await next(page);
    api.failPut = status;
    await page
      .getByRole("button", { name: "Guardar marca", exact: true })
      .click();
    await expect(page.locator(".driver-popover")).toHaveCount(0);
    await expect(
      page.getByText("No pudimos aplicar esos cambios."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Guardar marca", exact: true }),
    ).toBeDisabled();
    expect(api.progress).toEqual([]);
  });
test("GET inicial fallido permite reintentar sin iniciar tour en skeleton", async ({
  page,
  brandHarness,
}) => {
  const api = await brandFixture(page);
  api.failGet = 503;
  await page.goto(`${brandHarness}?tour=onboarding`);
  await expect(page.getByText("Lectura rechazada.")).toBeVisible();
  await expect(page.locator(".driver-popover")).toHaveCount(0);
  api.failGet = 0;
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(title(page)).toHaveText("Dale identidad a tu negocio");
  expect(api.writes).toEqual([]);
});
test("guardado en vuelo congela controles y salir no cancela ni duplica PUT", async ({
  page,
  brandHarness,
}) => {
  const api = await brandFixture(page);
  await page.goto(brandHarness);
  await help(page, "Cambiar el nombre");
  await next(page);
  await next(page);
  let release!: () => void;
  api.holdPut = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page
    .getByRole("button", { name: "Guardar marca", exact: true })
    .click();
  await expect.poll(() => api.writes.length).toBe(1);
  await expect(
    page.getByRole("textbox", { name: "Nombre del negocio" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Guardando…", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Salir de la guía" }).click();
  release();
  await expect(
    page.getByRole("button", { name: "Guardar marca", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".driver-popover")).toHaveCount(0);
  await help(page, "Ajustar los colores");
  await expect(title(page)).toHaveText("Elegí el color primario");
  expect(api.writes).toHaveLength(1);
  expect(api.progress).toEqual([]);
});
for (const width of [320, 1280])
  test(`Marca ${width}px oscuro no desborda y guía conserva contraste`, async ({
    page,
    brandHarness,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ colorScheme: "dark" });
    await brandFixture(page);
    await page.goto(brandHarness);
    await help(page, "Cambiar el nombre");
    await expect(title(page)).toHaveText("Completá el nombre");
    await expect(page.locator(".driver-popover")).toHaveCSS("opacity", "1");
    const style = await page.locator(".driver-popover").evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      color: getComputedStyle(element).color,
    }));
    expect(style.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(style.color).not.toBe(style.background);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const bounds = await page.locator(".driver-popover").boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `/tmp/brand-${width}-dark.png`,
      fullPage: true,
    });
  });
