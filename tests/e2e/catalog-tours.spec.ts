import { expect } from "@playwright/test";
import { test, title, next } from "./support/catalog-tour-fixture";
import { catalogApiFixture } from "./support/catalog-api-fixture";

test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

test("orientación vacía: cuatro pasos, ninguna escritura de dominio y progreso confirmado", async ({
  page,
  catalogHarness,
}) => {
  const api = await catalogApiFixture(page, true);
  await page.goto(
    `${catalogHarness}/backoffice/catalog?tour=onboarding&keep=1`,
  );
  for (const expected of [
    "Cargá tu menú con IA",
    "Creá y gestioná productos",
    "Organizá tu menú",
    "Aprendé una tarea cuando la necesites",
  ]) {
    await expect(title(page)).toHaveText(expected);
    await next(page);
  }
  await expect(page.locator(".driver-popover")).toHaveCount(0);
  expect(api.writes).toEqual([]);
  expect(api.progress).toEqual(["completed"]);
  expect(page.url()).toContain("keep=1");
  expect(page.url()).not.toContain("tour=onboarding");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Productos listos para vender" }),
  ).toBeVisible();
  await expect(page.locator(".driver-popover")).toHaveCount(0);
});

test("Saltar guarda skipped y un fallo de progreso permite reintentar", async ({
  page,
  catalogHarness,
}) => {
  const api = await catalogApiFixture(page);
  api.failProgress = true;
  await page.goto(`${catalogHarness}/backoffice/catalog?tour=onboarding`);
  await expect(title(page)).toHaveText("Cargá tu menú con IA");
  await page.getByRole("button", { name: "Saltar tour" }).click();
  await expect(page.getByText("No pudimos guardar tu progreso.")).toBeVisible();
  expect(api.progress).toEqual([]);
  await expect(page.locator(".onboarding-zone")).toBeVisible();
  api.failProgress = false;
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(page.getByText("No pudimos guardar tu progreso.")).toHaveCount(
    0,
  );
  expect(api.progress).toEqual(["skipped"]);
});
