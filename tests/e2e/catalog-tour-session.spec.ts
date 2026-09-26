import { expect } from "@playwright/test";
import { test, help, next, title } from "./support/catalog-tour-fixture";
import { catalogApiFixture } from "./support/catalog-api-fixture";

test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

for (const status of [401, 403] as const) {
  test(`GET ${status} después de guardar termina la guía y conserva el reintento de lectura`, async ({
    page,
    catalogHarness,
  }) => {
    const api = await catalogApiFixture(page);
    await page.goto(catalogHarness);
    await help(page, "Crear una categoría");
    await page
      .getByRole("textbox", { name: "Nueva categoría" })
      .fill("Panadería");
    await next(page);
    await expect(title(page)).toHaveText("Guardá los datos");
    await page.route("**/api/catalog", (route) =>
      route.fulfill({
        status,
        json: { error: status === 401 ? "Sesión vencida" : "Sin permiso" },
      }),
    );
    await page.getByRole("button", { name: "Añadir", exact: true }).click();
    await expect(page.locator(".driver-popover")).toHaveCount(0);
    await expect(
      page.getByText(
        status === 401
          ? "Tu sesión venció. Volvé a iniciar sesión para continuar."
          : "Ya no tenés permiso para acceder al catálogo.",
      ),
    ).toBeVisible();
    expect(api.writes).toHaveLength(1);
    await page.unroute("**/api/catalog");
    await page.getByRole("button", { name: "Reintentar lectura" }).click();
    await expect(
      page.getByText("Los cambios ya se guardaron. Falta actualizar la lista."),
    ).toHaveCount(0);
    expect(api.writes).toHaveLength(1);
    expect(api.progress).toEqual([]);
  });
}
