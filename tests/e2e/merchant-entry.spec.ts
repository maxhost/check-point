import { expect, test } from "@playwright/test";
import { merchantURL } from "./support/ports";

test("merchant root opens onboarding without a session", async ({ page }) => {
  await page.route("**/api/onboarding/state", (route) =>
    route.fulfill({ json: { authenticated: false } }),
  );
  await page.route("**/api/onboarding/prefill", (route) =>
    route.fulfill({
      json: { categories: [{ gcid: "gcid:cafe", displayName: "Cafetería" }] },
    }),
  );
  await page.goto(merchantURL);

  await expect(page).toHaveURL(`${merchantURL}/es/business/onboarding`);
  await expect(
    page.getByRole("heading", { name: /tu negocio/i }),
  ).toBeVisible();
});
