import { expect, test } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
import { operationModules } from "./support/modules-fixture";
import {
  paymentResolved,
  paymentCoupon,
} from "./support/pos-measured-payment-fixture";
let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/counter-harness.tsx",
    "pos",
  );
});
test.afterAll(async () => {
  await harness.close();
});
for (const invalid of [false, true]) {
  test(`shared camera resolves once, stops on detection/cancel; invalid coupon=${invalid}`, async ({
    page,
  }) => {
    const fullRule = invalid
      ? paymentCoupon.rule!.repeat(3)
      : paymentCoupon.rule!;
    const writes: string[] = [];
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/modules")
        return route.fulfill({
          json: { modules: operationModules(true, false) },
        });
      if (path === "/api/merchant/session")
        return route.fulfill({ json: { authenticated: true } });
      writes.push(path);
      expect(route.request().headers()["x-pos-contract"]).toBe("2");
      expect(route.request().headers()["x-backoffice-scope"]).toBe(
        "a".repeat(64),
      );
      expect(route.request().postDataJSON()).toEqual({
        qrToken: "camera-pass",
        locationId: "north",
      });
      return route.fulfill({
        json: {
          ...paymentResolved,
          couponState: {
            status: "selected",
            coupon: { ...paymentCoupon, rule: fullRule },
            verdict: invalid
              ? {
                  valid: false,
                  code: "coupon_expired",
                  message: "Este cupón venció.",
                }
              : { valid: true },
          },
        },
      });
    });
    await page.goto(`${harness.url}?mode=customer`);
    await page
      .getByRole("button", { name: "Identificar cliente", exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { posCameraStarts: number }).posCameraStarts,
        ),
      )
      .toBe(1);
    await page.evaluate(() => {
      (window as unknown as { posCameraToken: string }).posCameraToken =
        "camera-pass";
    });
    await expect(page.getByText("Ana", { exact: true })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const camera = window as unknown as {
            posCameraStarts: number;
            posCameraStops: number;
          };
          return camera.posCameraStops === camera.posCameraStarts;
        }),
      )
      .toBe(true);
    const starts = await page.evaluate(
      () => (window as unknown as { posCameraStarts: number }).posCameraStarts,
    );
    expect(writes).toEqual(["/api/modules/pos/resolve"]);
    if (invalid)
      await page
        .getByRole("button", { name: "Ver condiciones del cupón", exact: true })
        .click();
    await expect(page.getByText(fullRule, { exact: true })).toBeVisible();
    if (invalid)
      await expect(
        page.getByText("Este cupón venció.", { exact: true }),
      ).toBeVisible();
    await page
      .getByRole("button", { name: "Quitar beneficio de esta venta" })
      .click();
    await expect(
      page.getByText(`${paymentCoupon.label} · Sin aplicar`, { exact: true }),
    ).toBeVisible();
    expect(writes).toHaveLength(1);
    await page
      .getByRole("button", { name: "Quitar cliente", exact: true })
      .click();
    await page.evaluate(() => {
      (window as unknown as { posCameraToken: string | null }).posCameraToken =
        null;
    });
    await page
      .getByRole("button", { name: "Identificar cliente", exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { posCameraStarts: number }).posCameraStarts,
        ),
      )
      .toBe(starts + 1);
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const camera = window as unknown as {
            posCameraStarts: number;
            posCameraStops: number;
          };
          return camera.posCameraStops === camera.posCameraStarts;
        }),
      )
      .toBe(true);
    expect(writes).toHaveLength(1);
  });
}
