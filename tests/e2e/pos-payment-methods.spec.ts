import { test, expect, type Page } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
const cashId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const cardId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/pos-payment-methods-fixture.tsx",
    "pos",
  );
});
test.afterAll(async () => {
  await harness?.close();
});

async function setup(page: Page, scenario = "plain", retry = false) {
  const stats = { methodReads: 0, closes: [] as Record<string, unknown>[] };
  const coupon = {
    couponId: "coupon",
    label: "Beneficio",
    kind: scenario === "targets" ? "free_product" : "discount",
    rule: null,
    productId: null,
    productName: null,
    discountUnit: scenario === "cop" ? "amount" : "percent",
    discountValue:
      scenario === "cop" ? "0.60" : scenario === "partial" ? "50" : "100",
    currencyCode: scenario === "cop" ? "COP" : "USD",
    extraUnits: null,
    validUntil: "2027-01-01",
  };
  const couponState = { status: "selected", verdict: { valid: true }, coupon };
  await page.route("**/api/modules/pos/payment-methods", (route) => {
    stats.methodReads++;
    return route.fulfill({
      json: {
        methods: [
          {
            id: cashId,
            name: "Efectivo",
            chargeShape: "none",
            isCash: true,
            status: "active",
          },
          {
            id: cardId,
            name: "Tarjeta de débito",
            chargeShape: "percent",
            isCash: false,
            status: "active",
          },
        ],
        defaultMethodId: cashId,
      },
    });
  });
  await page.route("**/api/modules/pos/resolve", (route) =>
    route.fulfill({
      json: {
        consumer: { displayName: "Ana" },
        membership: {
          id: "membership",
          pointsBalance: 0,
          stampsCount: 0,
          justEnrolled: false,
        },
        program: {
          id: "program",
          kind: "points",
          redeemAllowInsufficient: false,
          accrual: { mode: "per_amount", grant: 1, blockAmount: 1 },
          cardDesign: {
            backgroundColor: null,
            backgroundColor2: null,
            gradientAngle: null,
            borderColor: null,
          },
        },
        catalog: {
          products: [],
          categories: [],
          habitualProductIds: [],
          lastPurchase: null,
        },
        rewards: [],
        couponState,
      },
    }),
  );
  await page.route("**/api/modules/pos/coupon-state?*", (route) =>
    route.fulfill({ json: { couponState } }),
  );
  await page.route("**/api/modules/pos/orders/*/close", (route) => {
    stats.closes.push(route.request().postDataJSON());
    if (retry && stats.closes.length === 1) return route.abort("failed");
    return route.fulfill({ json: { id: "closed-order", status: "closed" } });
  });
  await page.goto(`${harness.url}?scenario=${scenario}`);
  return stats;
}
async function open(page: Page, withCustomer = false) {
  if (withCustomer) {
    await page
      .getByRole("button", { name: "Identificar cliente", exact: true })
      .click();
    await expect(
      page.getByText("Cliente listo", { exact: true }),
    ).toBeVisible();
  }
  await page
    .getByRole("button", { name: "Revisar cobro", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Cobrar Venta" }),
  ).toBeVisible();
  await expect(
    page.getByText("Actualizando beneficio…", { exact: true }),
  ).toHaveCount(0);
}
const method = (page: Page) =>
  page.getByRole("button", { name: /Medio de pago$/ });
async function selectCard(page: Page) {
  await method(page).click();
  await page
    .getByRole("option", { name: "Tarjeta de débito", exact: true })
    .click();
}

for (const width of [390, 1280]) {
  test(`selector cash/card and exact payload at ${width}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const stats = await setup(page);
    await open(page);
    await expect(method(page)).toContainText("Efectivo");
    await expect(
      page.getByRole("textbox", { name: "Recibido", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Confirmar cobro", exact: true }),
    ).toBeEnabled();
    await page.screenshot({
      path: info.outputPath(`payment-method-${width}.png`),
      fullPage: true,
    });
    await selectCard(page);
    await expect(
      page.getByRole("textbox", { name: "Recibido", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Confirmar cobro", exact: true })
      .click();
    await expect(
      page.getByText("Venta cerrada", { exact: true }),
    ).toBeVisible();
    expect(stats.closes[0].payments).toEqual([
      { methodId: cardId, amount: "10.00" },
    ]);
    expect(stats.closes[0]).not.toHaveProperty("commission");
  });
}

test("COP coupon preview and payment keep the approved rounded amount", async ({
  page,
}) => {
  const stats = await setup(page, "cop");
  await open(page, true);
  await expect(page.getByText(/Ajuste de redondeo:/)).toContainText("0,20");
  await page
    .getByRole("button", { name: "Confirmar cobro", exact: true })
    .click();
  await expect(page.getByText("Venta cerrada", { exact: true })).toBeVisible();
  expect(stats.closes[0].payments).toEqual([
    { methodId: cashId, amount: "10" },
  ]);
});

test("100% coupon hides the payment method and sends an empty list", async ({
  page,
}) => {
  const stats = await setup(page, "zero");
  await open(page, true);
  await expect(method(page)).toHaveCount(0);
  expect(stats.methodReads).toBe(0);
  await page
    .getByRole("button", { name: "Confirmar cobro", exact: true })
    .click();
  await expect(page.getByText("Venta cerrada", { exact: true })).toBeVisible();
  expect(stats.closes[0].payments).toEqual([]);
});

test("removing the customer from a zero sale loads methods and enables a positive close", async ({
  page,
}) => {
  const stats = await setup(page, "zero");
  await open(page, true);
  await page
    .getByRole("button", { name: "Quitar cliente", exact: true })
    .click();
  await expect(method(page)).toContainText("Efectivo");
  await expect(
    page.getByRole("button", { name: "Confirmar cobro", exact: true }),
  ).toBeEnabled();
  expect(stats.methodReads).toBe(1);
  await page
    .getByRole("button", { name: "Confirmar cobro", exact: true })
    .click();
  await expect(page.getByText("Venta cerrada", { exact: true })).toBeVisible();
  expect(stats.closes[0].payments).toEqual([
    { methodId: cashId, amount: "10.00" },
  ]);
  expect(stats.closes[0]).not.toHaveProperty("membershipId");
});

test("excluding a 100% coupon loads methods; removing a customer preserves a valid selected method", async ({
  page,
}) => {
  const stats = await setup(page, "zero");
  await open(page, true);
  await page
    .getByRole("button", { name: "Quitar beneficio", exact: true })
    .click();
  await expect(method(page)).toContainText("Efectivo");
  await selectCard(page);
  await page
    .getByRole("button", { name: "Quitar cliente", exact: true })
    .click();
  await expect(method(page)).toContainText("Tarjeta de débito");
  await expect(
    page.getByRole("button", { name: "Confirmar cobro", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Confirmar cobro", exact: true })
    .click();
  await expect(page.getByText("Venta cerrada", { exact: true })).toBeVisible();
  expect(stats.closes[0].payments).toEqual([
    { methodId: cardId, amount: "10.00" },
  ]);
});

test("changing the free-product destination from zero to positive reloads payment methods", async ({
  page,
}) => {
  const stats = await setup(page, "targets");
  await open(page, true);
  await page.getByRole("button", { name: /Producto de la oferta$/ }).click();
  await page
    .getByRole("option", { name: "Servicio principal", exact: true })
    .click();
  await expect(method(page)).toHaveCount(0);
  await page.getByRole("button", { name: /Producto de la oferta$/ }).click();
  await page
    .getByRole("option", { name: "Servicio incluido", exact: true })
    .click();
  await expect(method(page)).toContainText("Efectivo");
  await expect(
    page.getByRole("button", { name: "Confirmar cobro", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Confirmar cobro", exact: true })
    .click();
  await expect(page.getByText("Venta cerrada", { exact: true })).toBeVisible();
  expect(stats.closes[0].payments).toEqual([
    { methodId: cashId, amount: "10.00" },
  ]);
});

test("uncertain close freezes method, payments and idempotency key for retry", async ({
  page,
}) => {
  const stats = await setup(page, "plain", true);
  await open(page);
  await selectCard(page);
  await page
    .getByRole("button", { name: "Confirmar cobro", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reintentar cobro", exact: true }),
  ).toBeVisible();
  await expect(method(page)).toBeDisabled();
  await page
    .getByRole("button", { name: "Reintentar cobro", exact: true })
    .click();
  await expect(page.getByText("Venta cerrada", { exact: true })).toBeVisible();
  expect(stats.closes).toHaveLength(2);
  expect(stats.closes[1]).toEqual(stats.closes[0]);
});
