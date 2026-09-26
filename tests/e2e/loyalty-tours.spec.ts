import { expect } from "@playwright/test";
import { test, loyaltyFixture } from "./support/loyalty-fixture";
for (const existing of [false, true]) {
  for (const decision of ["completed", "skipped"] as const) {
    test(`onboarding ${existing ? "guardado" : "vacío"} ${decision} persiste una decisión`, async ({
      page,
      loyaltyHarness,
    }) => {
      const api = await loyaltyFixture(page, existing);
      const posts: unknown[] = [];
      await page.route("**/api/onboarding/tours/program", async (route) => {
        posts.push(route.request().postDataJSON());
        await route.fulfill({ json: { ok: true } });
      });
      await page.goto(`${loyaltyHarness}?tour=onboarding&keep=1`);
      await expect(page.locator(".driver-popover-title")).toHaveText(
        "Tu programa de fidelización",
      );
      expect(new URL(page.url()).searchParams.get("keep")).toBe("1");
      expect(new URL(page.url()).searchParams.has("tour")).toBe(false);
      if (decision === "skipped")
        await page.getByRole("button", { name: "Saltar tour" }).click();
      else {
        for (let step = 0; step < 4; step++)
          await page
            .getByRole("button", { name: "Siguiente", exact: true })
            .click();
        await page.getByRole("button", { name: "Listo", exact: true }).click();
      }
      await expect.poll(() => posts).toEqual([{ status: decision }]);
      expect(api.writes).toHaveLength(0);
      await page.reload();
      await expect(
        page.getByRole("button", { name: "Ayuda", exact: true }),
      ).toBeVisible();
      await expect(page.locator(".driver-popover")).toHaveCount(0);
      expect(posts).toHaveLength(1);
    });
  }
}
test("repetir orientación y staff nunca escriben progreso", async ({
  page,
  loyaltyHarness,
}) => {
  await loyaltyFixture(page, true);
  let posts = 0;
  await page.route("**/api/onboarding/tours/program", async (route) => {
    posts++;
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto(`${loyaltyHarness}?staff=1&tour=onboarding&no-catalog=1`);
  await expect(page.locator(".driver-popover")).toHaveCount(0);
  await page.getByRole("button", { name: "Ayuda", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Programar el cierre", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Conocer fidelización", exact: true })
    .click();
  for (let step = 0; step < 4; step++)
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await page.getByRole("button", { name: "Listo", exact: true }).click();
  expect(posts).toBe(0);
});
