import { expect } from "@playwright/test";
import {
  test,
  loyaltyFixture,
  pointsReview,
  next,
} from "./support/loyalty-fixture";
export async function help(
  page: import("@playwright/test").Page,
  name: string,
) {
  await page.getByRole("button", { name: "Ayuda", exact: true }).click();
  await page.getByRole("button", { name, exact: true }).click();
}
test("crear acompaña pasos reales y no persiste ayuda", async ({
  page,
  loyaltyHarness,
}) => {
  const api = await loyaltyFixture(page);
  let posts = 0;
  await page.route("**/api/onboarding/tours/program", async (route) => {
    posts++;
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto(loyaltyHarness);
  await help(page, "Crear un programa");
  await expect(page.locator(".driver-popover-title")).toHaveText("Modalidad");
  await pointsReview(page);
  await expect(page.locator(".driver-popover-title")).toHaveText("Revisión");
  await page
    .getByRole("button", { name: "Activar programa", exact: true })
    .click();
  await expect(page.locator(".driver-popover-description")).toHaveText(
    "El programa quedó activado.",
  );
  await page.getByRole("button", { name: "Listo", exact: true }).click();
  expect(posts).toBe(0);
  expect(api.writes).toHaveLength(1);
});
test("políticas conserva borrador completo y salir sólo retira guía", async ({
  page,
  loyaltyHarness,
}) => {
  const api = await loyaltyFixture(page, true);
  let posts = 0;
  await page.route("**/api/onboarding/tours/program", async (route) => {
    posts++;
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto(loyaltyHarness);
  await page
    .getByRole("button", { name: "Editar programa", exact: true })
    .click();
  await next(page);
  await page.getByLabel("Color de fondo", { exact: true }).fill("#123456");
  await next(page);
  await page
    .getByRole("textbox", { name: "Texto de términos" })
    .fill("Borrador conservado");
  await next(page);
  await page.getByRole("radio", { name: "Premio libre", exact: true }).check();
  await page
    .getByRole("textbox", { name: "Nombre del premio" })
    .fill("Premio pendiente");
  await help(page, "Editar políticas");
  await expect(
    page.getByRole("textbox", { name: "Texto de términos" }),
  ).toHaveValue("Borrador conservado");
  await page
    .getByRole("button", { name: "Salir de la guía", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "¿Salir sin guardar?" }),
  ).toHaveCount(0);
  await help(page, "Editar políticas");
  await next(page);
  await expect(page.locator(".driver-popover-title")).toHaveText(
    "Canje sin saldo",
  );
  await expect(
    page.getByRole("textbox", { name: "Nombre del premio" }),
  ).toHaveValue("Premio pendiente");
  await next(page);
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(page.locator(".driver-popover-title")).toHaveText(
    "Guardado confirmado",
  );
  expect(api.writes[0].body.clauses).toEqual([{ text: "Borrador conservado" }]);
  expect((api.writes[0].body.rewards as { label: string }[])[0].label).toBe(
    "Premio pendiente",
  );
  expect(
    (api.writes[0].body.cardDesign as { backgroundColor: string })
      .backgroundColor,
  ).toBe("#123456");
  await page.getByRole("button", { name: "Listo", exact: true }).click();
  expect(posts).toBe(0);
});
test("cierre espera confirmación y DELETE más GET, cancelar no escribe", async ({
  page,
  loyaltyHarness,
}) => {
  const api = await loyaltyFixture(page, true);
  api.delay = 500;
  await page.goto(loyaltyHarness);
  await help(page, "Programar el cierre");
  await page
    .getByRole("button", { name: "Cerrar programa", exact: true })
    .click();
  await page
    .getByLabel("Fin de acumulación", { exact: true })
    .fill("2035-01-01T10:00");
  await page
    .getByLabel("Fecha final de canje", { exact: true })
    .fill("2035-01-02T10:00");
  await page
    .getByRole("button", { name: "Continuar con el cierre", exact: true })
    .click();
  await expect(page.locator(".driver-popover-title")).toHaveText(
    "Confirmación de cierre",
  );
  expect(api.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(api.writes).toHaveLength(0);
  await page
    .getByRole("button", { name: "Continuar con el cierre", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Programar cierre", exact: true })
    .click();
  await expect(page.locator(".driver-popover-title")).not.toHaveText(
    "Cierre confirmado",
  );
  await expect(page.locator(".driver-popover-title")).toHaveText(
    "Cierre confirmado",
  );
  expect(api.writes).toHaveLength(1);
});
