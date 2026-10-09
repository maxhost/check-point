import { expect } from "@playwright/test";
import { test, loyaltyFixture, pointsReview } from "./support/loyalty-fixture";
async function create(page: import("@playwright/test").Page) {
  await page
    .getByRole("main")
    .getByRole("button", { name: "Ayuda", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Crear un programa", exact: true })
    .click();
  await pointsReview(page);
}
for (const failure of ["rejected", "uncertain"] as const) {
  test(`guardar ${failure} conserva fase y borrador sin anunciar éxito`, async ({
    page,
    loyaltyHarness,
  }) => {
    const api = await loyaltyFixture(page);
    api.failWrite = failure === "rejected" ? 422 : 0;
    api.invalidWrite = failure === "uncertain";
    await page.goto(loyaltyHarness);
    await create(page);
    await page
      .getByRole("button", { name: "Activar programa", exact: true })
      .click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.locator(".driver-popover-title")).toHaveText("Revisión");
    await expect(page.locator(".driver-popover-description")).not.toContainText(
      "quedó activado",
    );
    expect(api.writes).toHaveLength(1);
    api.failWrite = 0;
    api.invalidWrite = false;
    await page
      .getByRole("button", { name: "Activar programa", exact: true })
      .click();
    await expect(page.locator(".driver-popover-title")).toHaveText(
      "Guardado confirmado",
    );
    expect(api.writes).toHaveLength(2);
  });
}
test("escritura confirmada con GET fallido ofrece sólo refrescar", async ({
  page,
  loyaltyHarness,
}) => {
  const api = await loyaltyFixture(page);
  await page.goto(loyaltyHarness);
  await create(page);
  api.failRead = 503;
  await page
    .getByRole("button", { name: "Activar programa", exact: true })
    .click();
  await expect(page.locator(".driver-popover-title")).toHaveText(
    "Vista pendiente",
  );
  expect(api.writes).toHaveLength(1);
  api.failRead = 0;
  await page
    .getByRole("button", { name: "Actualizar vista", exact: true })
    .click();
  await expect(page.locator(".driver-popover-title")).toHaveText(
    "Guardado confirmado",
  );
  expect(api.writes).toHaveLength(1);
});
