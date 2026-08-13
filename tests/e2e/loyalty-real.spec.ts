import { expect, test } from "@playwright/test";

const baseURL = process.env.E2E_MERCHANT_BASE_URL;
const email = process.env.E2E_MERCHANT_EMAIL;
const password = process.env.E2E_MERCHANT_PASSWORD;
const enabled = process.env.E2E_LOYALTY_MUTATION_TEST === "true";

function localDateTime(daysFromNow: number) {
  const value = new Date(Date.now() + daysFromNow * 86_400_000);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 16);
}

test.describe("programa de fidelización real", () => {
  test.skip(
    !baseURL || !email || !password || !enabled,
    "requiere owner de prueba nuevo y aislado de la rama de desarrollo",
  );

  test("owner crea, edita y programa el cierre de un ciclo", async ({
    page,
  }) => {
    await page.goto(`${baseURL}/login`);
    await page.getByLabel(/email/i).fill(email!);
    await page.getByLabel(/contraseña/i).fill(password!);
    await page.getByRole("button", { name: /ingresar/i }).click();
    await page.goto(`${baseURL}/backoffice/loyalty`);

    await expect(
      page.getByRole("heading", { name: "Premia a tus clientes" }),
    ).toBeVisible();
    await page.getByLabel("Texto de términos").fill("Términos iniciales.");
    await page.getByRole("button", { name: "Activar programa" }).click();
    await expect(
      page.getByRole("heading", { name: "Tu programa está activo" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Editar programa" }).click();
    await page.getByLabel("Texto de términos").fill("Términos actualizados.");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Términos actualizados.")).toBeVisible();

    await page.getByRole("button", { name: "Cerrar programa" }).click();
    await page.getByLabel("Fin de acumulación").fill(localDateTime(2));
    await page.getByLabel("Fecha final de canje").fill(localDateTime(7));
    await page.getByRole("button", { name: "Continuar con el cierre" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Programar cierre" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Tu programa está en cierre" }),
    ).toBeVisible();

    // Cancelar el cierre lo devuelve a activo antes de la fecha de canje.
    await page.getByRole("button", { name: "Cancelar cierre" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Cancelar cierre" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Tu programa está activo" }),
    ).toBeVisible();
  });
});
