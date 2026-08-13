import { expect, test } from "@playwright/test";
import { seedDemo } from "./support/demo";

test("owner changes the analytics demo sector without changing the business fixture", async ({
  page,
}) => {
  await seedDemo(page, {
    businessName: "Demo",
    branches: [{ name: "Centro", address: "Centro" }],
  });
  await page.goto("http://127.0.0.1:3001/backoffice/demo/analytics");
  await expect(
    page.getByRole("heading", { name: "Entiende lo que está funcionando" }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Hotel" }).check();
  await expect(
    page.getByRole("heading", { name: "Estadías y servicios" }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Retail" }).check();
  await expect(
    page.getByRole("heading", { name: "Compra y categoría" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem("merchant-demo") ?? "{}")
          .businessName,
    ),
  ).toBe("Demo");
});
