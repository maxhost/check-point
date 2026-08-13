import { expect, test } from "@playwright/test";
import { type DemoState, seedDemo } from "./support/demo";

const demoBusiness = {
  ownerName: "Maxi Demo",
  email: "maxi@example.com",
  plan: "pilot",
  businessName: "Bar Demo",
  logo: "",
  colors: { primary: "#176548", complementary: "#2d8b68", accent: "#e78132" },
  timezone: "America/Guayaquil",
  applyTimezoneToAllLocations: true,
  branches: [{ name: "Bar Demo Centro", address: "Centro" }],
} satisfies Partial<DemoState>;

test("owner activates and deactivates a stamp loyalty program", async ({
  page,
}) => {
  await seedDemo(page, demoBusiness);

  await page.goto("http://127.0.0.1:3001/backoffice/demo");
  await page.getByRole("link", { name: /Programa de fidelización/i }).click();
  await expect(
    page.getByRole("heading", { name: "Premia a tus clientes" }),
  ).toBeVisible();

  await page.getByRole("radio", { name: /Sellos/i }).check();
  await page.getByLabel("Sellos para completar la tarjeta").fill("8");
  const stampImage = page.getByLabel("Diseño del sello");
  const image = {
    name: "sello.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL3nwAAAABJRU5ErkJggg==",
      "base64",
    ),
  };
  await stampImage.setInputFiles(image);
  await expect(
    page.getByRole("img", { name: "Vista previa del sello" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Quitar diseño" }).click();
  await stampImage.setInputFiles(image);
  await expect(
    page.getByRole("img", { name: "Vista previa del sello" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Activar programa" }).click();
  await expect(
    page.getByRole("heading", { name: "Tu programa está activo" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Tu programa está activo" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Desactivar programa" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Desactivar" }).click();
  await expect(
    page.getByRole("heading", { name: "Premia a tus clientes" }),
  ).toBeVisible();
});
