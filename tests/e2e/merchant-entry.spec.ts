import { expect, test } from "@playwright/test";
import { merchantURL } from "./support/ports";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/onboarding/state", (route) =>
    route.fulfill({ json: { authenticated: false } }),
  );
  await page.route("**/api/onboarding/prefill", (route) =>
    route.fulfill({
      json: { categories: [{ gcid: "gcid:cafe", displayName: "Cafetería" }] },
    }),
  );
});

for (const path of [
  "/",
  "/es/business/onboarding",
  "/?signup=0",
  "/?signup=1&signup=1",
]) {
  test(`entrada ${path} abre login sin sesión`, async ({ page }) => {
    await page.goto(`${merchantURL}${path}`);
    await expect(page).toHaveURL(`${merchantURL}/es/business/onboarding`);
    await expect(
      page.getByRole("heading", { name: "Entra a tu cuenta" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Enviarme código" }),
    ).toBeVisible();
    await expect(page).toHaveTitle("Entra a tu cuenta · CheckPass Club");
  });
}
for (const path of ["/?signup=1", "/es/business/onboarding?signup=1"]) {
  test(`entrada ${path} abre registro explícito`, async ({ page }) => {
    await page.goto(`${merchantURL}${path}`);
    await expect(page).toHaveURL(
      `${merchantURL}/es/business/onboarding?signup=1`,
    );
    await expect(
      page.getByRole("heading", { name: /tu negocio/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Iniciar sesión" }),
    ).toBeVisible();
    await expect(page).toHaveTitle("Crea tu negocio · CheckPass Club");
  });
}
test("login permite crear un negocio y volver al login", async ({ page }) => {
  await page.goto(merchantURL);
  await page.getByRole("tab", { name: "Crear un negocio" }).click();
  await expect(
    page.getByRole("heading", { name: /tu negocio/i }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Iniciar sesión" }).click();
  await expect(
    page.getByRole("heading", { name: "Entra a tu cuenta" }),
  ).toBeVisible();
});
test("rebote tiene prioridad sobre el pedido de alta", async ({ page }) => {
  await page.goto(`${merchantURL}/?e=payment_required&signup=1`);
  await expect(page).toHaveURL(`${merchantURL}/?e=payment_required&signup=1`);
  await expect(
    page.getByText("El negocio necesita un plan activo", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enviarme código" }),
  ).toHaveCount(0);
});
