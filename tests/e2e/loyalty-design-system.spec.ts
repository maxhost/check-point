import { expect } from "@playwright/test";
import {
  test,
  loyaltyFixture,
  next,
  pointsReview,
  storedProgram,
} from "./support/loyalty-fixture";
test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
test("puntos: payload completo, borrador ida/vuelta y GET después de 201", async ({
  page,
  loyaltyHarness,
}) => {
  const api = await loyaltyFixture(page);
  await page.goto(loyaltyHarness);
  await pointsReview(page);
  await page.getByRole("button", { name: "Atrás" }).click();
  await expect(
    page.getByRole("textbox", { name: "Nombre del premio" }),
  ).toHaveValue("Café gratis");
  await page.getByRole("button", { name: "Atrás" }).click();
  await expect(
    page.getByRole("textbox", { name: "Monto por bloque" }),
  ).toHaveValue("5,50");
  await page.getByRole("button", { name: "Atrás" }).click();
  await expect(
    page.getByRole("textbox", { name: "Nombre singular", exact: true }),
  ).toHaveValue("Crédito");
  await next(page);
  await next(page);
  await next(page);
  await page.getByRole("button", { name: "Activar programa" }).click();
  await expect(
    page.getByRole("button", { name: "Editar programa" }),
  ).toBeVisible();
  expect(api.writes).toHaveLength(1);
  expect(api.writes[0].body).toEqual({
    kind: "points",
    configuration: { unitSingular: "Crédito", unitPlural: "Créditos" },
    clauses: [{ text: "Condiciones nuevas" }],
    stampAction: "keep",
    accrual: { mode: "per_amount", grant: 10, blockAmount: "5.5" },
    rewards: [{ type: "custom", label: "Café gratis", pointsCost: 50 }],
    redeemAllowInsufficient: false,
  });
  expect(api.reads).toBe(2);
});
test("monto vacío y cero no avanzan; foco y corrección decimal", async ({
  page,
  loyaltyHarness,
}) => {
  const api = await loyaltyFixture(page);
  await page.goto(loyaltyHarness);
  await next(page);
  await next(page);
  await page
    .getByRole("textbox", { name: "Texto de términos" })
    .fill("Términos");
  for (const value of ["", "0"]) {
    await page.getByRole("textbox", { name: "Monto por bloque" }).fill(value);
    await next(page);
    await expect(page.getByText("Ingresá un monto mayor que 0")).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Monto por bloque" }),
    ).toBeFocused();
    expect(api.writes).toHaveLength(0);
  }
  await page.getByRole("textbox", { name: "Monto por bloque" }).fill("0,50");
  await next(page);
  await expect(
    page.getByRole("textbox", { name: "Nombre del premio" }),
  ).toBeVisible();
});
test("GET503 muestra recuperación antes del skeleton", async ({
  page,
  loyaltyHarness,
}) => {
  const api = await loyaltyFixture(page);
  api.failRead = 503;
  await page.goto(loyaltyHarness);
  await expect(page.getByRole("alert")).toContainText("no está disponible");
  api.failRead = 0;
  await page.getByRole("button", { name: "Reintentar lectura" }).click();
  await expect(
    page.getByRole("heading", { name: "Creá tu programa" }),
  ).toBeVisible();
});
test("sellos staff sin catálogo conserva snapshot, plural y flag; no cierre", async ({
  page,
  loyaltyHarness,
}) => {
  const api = await loyaltyFixture(page, true);
  await page.goto(`${loyaltyHarness}?staff&no-catalog`);
  await expect(page.getByText("Café guardado")).toBeVisible();
  expect(api.catalogReads).toBe(0);
  await expect(
    page.getByRole("button", { name: "Cerrar programa" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Editar programa" }).click();
  await next(page);
  await expect(page.locator(".card-preview")).toBeVisible();
  await next(page);
  await next(page);
  await expect(
    page.getByText("No tenés permiso para consultar el catálogo"),
  ).toBeVisible();
  await next(page);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(
    page.getByRole("button", { name: "Editar programa" }),
  ).toBeVisible();
  expect(api.writes[0].body).toMatchObject({
    kind: "stamps",
    configuration: storedProgram.configuration,
    redeemAllowInsufficient: true,
    accrual: { mode: "per_purchase", grant: 1, blockAmount: null },
    rewards: [
      { type: "catalog_product", productId: "missing", pointsCost: null },
    ],
    stampAction: "keep",
  });
  expect(api.writes[0].body.cardDesign).toBeDefined();
  expect(api.writes.every((write) => write.method === "PUT")).toBe(true);
});
test("doble submit mismo tick produce un solo PUT y bloquea campos", async ({
  page,
  loyaltyHarness,
}) => {
  const api = await loyaltyFixture(page);
  api.delay = 500;
  await page.goto(loyaltyHarness);
  await pointsReview(page);
  await page.locator("form").evaluate((form) => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  await expect.poll(() => api.writes.length).toBe(1);
  await expect(page.getByRole("button", { name: "Atrás" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Editar programa" }),
  ).toBeVisible();
  expect(api.writes).toHaveLength(1);
});
test("PUT422 conserva borrador y refresh fallido sólo reintenta GET", async ({
  page,
  loyaltyHarness,
}) => {
  const api = await loyaltyFixture(page);
  api.failWrite = 422;
  api.code = "invalid_program";
  await page.goto(loyaltyHarness);
  await pointsReview(page);
  await page.getByRole("button", { name: "Activar programa" }).click();
  await expect(page.getByRole("alert")).toContainText("Revisá los datos");
  await page.getByRole("button", { name: "Atrás" }).click();
  await expect(
    page.getByRole("textbox", { name: "Nombre del premio" }),
  ).toHaveValue("Café gratis");
  await next(page);
  api.failWrite = 0;
  api.failRead = 503;
  await page.getByRole("button", { name: "Activar programa" }).click();
  await expect(
    page.getByText("Se guardó el cambio, pero no pudimos actualizar la vista"),
  ).toBeVisible();
  const writes = api.writes.length;
  api.failRead = 0;
  await page.getByRole("button", { name: "Actualizar vista" }).click();
  await expect(
    page.getByRole("button", { name: "Editar programa" }),
  ).toBeVisible();
  expect(api.writes).toHaveLength(writes);
});
for (const width of [320, 390, 768, 1280])
  for (const theme of ["light", "dark"] as const)
    test(`render ${width} ${theme}: estilos wizard y sin overflow`, async ({
      page,
      loyaltyHarness,
    }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      await loyaltyFixture(page);
      await page.goto(loyaltyHarness);
      await next(page);
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      const styles = await page
        .getByRole("textbox", { name: "Nombre singular", exact: true })
        .evaluate((input) => {
          const style = getComputedStyle(input);
          const reference = getComputedStyle(
            document.querySelector("#wizard-reference input")!,
          );
          return {
            font: style.fontSize,
            color: style.color,
            bg: style.backgroundColor,
            height: input.getBoundingClientRect().height,
            reference: {
              font: reference.fontSize,
              color: reference.color,
              bg: reference.backgroundColor,
            },
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
      expect(styles.font).toBe("16px");
      expect(styles.color).toBe(styles.reference.color);
      expect(styles.bg).toBe(styles.reference.bg);
      expect(styles.height).toBeGreaterThanOrEqual(48);
      expect(styles.overflow).toBe(false);
      await page.screenshot({
        path: info.outputPath(`${width}-${theme}.png`),
        fullPage: true,
      });
    });
