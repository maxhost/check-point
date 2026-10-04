import { expect, test } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";

const resolved = {
  consumer: { displayName: "Cliente de prueba" },
  membership: {
    id: "member-1",
    pointsBalance: 20,
    stampsCount: 0,
    justEnrolled: false,
  },
  program: {
    id: "program-1",
    kind: "points",
    redeemAllowInsufficient: false,
    accrual: { mode: "per_purchase", grant: 1, blockAmount: null },
    cardDesign: {
      backgroundColor: null,
      backgroundColor2: null,
      gradientAngle: null,
      borderColor: null,
    },
  },
  catalog: {
    products: [
      {
        id: "product-1",
        name: "Pan",
        categoryId: null,
        unitPrice: 2,
        imagePath: null,
      },
    ],
    categories: [],
    habitualProductIds: [],
    lastPurchase: null,
  },
  rewards: [],
  couponState: { status: "none" },
};

test("Mostrador móvil oculta la navegación durante el flujo y deja accesibles las acciones", async ({
  page,
}, testInfo) => {
  const harness = await startCatalogHarness(
    "tests/e2e/support/counter-harness.tsx",
  );
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/api/counter/resolve", (route) =>
      route.fulfill({ json: resolved }),
    );
    await page.goto(harness.url);

    const nav = page
      .getByRole("navigation", { name: "Navegación principal" })
      .last();
    await expect(nav).toBeVisible();
    await page.getByRole("button", { name: "Escanear", exact: true }).click();
    await expect(nav).toBeHidden();
    await page.getByRole("button", { name: "Cerrar Mostrador" }).click();
    await expect(nav).toBeVisible();

    await page.getByRole("button", { name: "Escanear", exact: true }).click();
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("counter-qr", { detail: "qa-qr" })),
    );
    await expect(
      page.getByRole("heading", { name: "Cliente de prueba" }),
    ).toBeVisible();
    await expect(nav).toBeHidden();

    const panel = page.locator(".counter-panel");
    expect(
      await panel.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    ).toBe("rgba(0, 0, 0, 0)");
    await page.getByRole("button", { name: "Agregar Pan" }).click();
    const cancel = page.getByRole("button", { name: "Cancelar" });
    const confirm = page.getByRole("button", { name: "Acreditar compra" });
    await expect(cancel).toBeInViewport();
    await expect(confirm).toBeInViewport();
    await expect(confirm).toBeEnabled();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(
      page.getByRole("button", { name: "Cerrar Mostrador" }),
    ).toBeInViewport();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("counter-mobile.png") });

    await page.setViewportSize({ width: 1100, height: 844 });
    expect(
      await panel.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    ).toBe("rgb(255, 255, 255)");
    await page.setViewportSize({ width: 390, height: 844 });

    await page.getByRole("tab", { name: "Venta rápida" }).click();
    await expect(nav).toBeHidden();
    await page.getByRole("tab", { name: "Canjear" }).click();
    await expect(nav).toBeHidden();
    await page.getByRole("button", { name: "Cerrar Mostrador" }).click();
    await expect(
      page.getByRole("button", { name: "Escanear", exact: true }),
    ).toBeVisible();
    await expect(nav).toBeVisible();
  } finally {
    await harness.close();
  }
});
