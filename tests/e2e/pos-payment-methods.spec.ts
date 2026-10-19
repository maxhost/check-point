import { expect, test, type Page } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
import {
  paymentResolved,
  paymentCoupon,
  paymentMethods,
  paymentClosed,
  paymentOrder,
} from "./support/pos-measured-payment-fixture";
import type { MeasuredPaymentBody } from "../../apps/merchant/src/modules/pos/ui/measured-payment-close";
let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/pos-payment-methods-fixture.tsx",
    "pos",
  );
});
test.afterAll(async () => {
  await harness.close();
});
async function setup(page: Page, cop = false) {
  const stats = { methods: 0, closes: [] as MeasuredPaymentBody[] };
  const coupon = { ...paymentCoupon, discountValue: "100" };
  await page.route("**/api/modules/pos/**", (route) => {
    const req = route.request(),
      url = req.url();
    expect(req.headers()["x-pos-contract"]).toBe("2");
    if (url.endsWith("/resolve"))
      return route.fulfill({
        json: {
          ...paymentResolved,
          couponState: { status: "selected", verdict: { valid: true }, coupon },
        },
      });
    if (url.includes("coupon-state"))
      return route.fulfill({
        json: {
          couponState: { status: "selected", verdict: { valid: true }, coupon },
        },
      });
    if (url.endsWith("payment-methods")) {
      stats.methods++;
      return route.fulfill({
        json: {
          methods: [
            ...paymentMethods,
            {
              id: "card",
              name: "Tarjeta",
              isCash: false,
              chargeShape: "none",
              status: "active",
            },
          ],
          defaultMethodId: "cash",
        },
      });
    }
    const body = req.postDataJSON() as MeasuredPaymentBody;
    stats.closes.push(body);
    const order = structuredClone(paymentOrder);
    if (cop) order.business.currencyCode = "COP";
    return route.fulfill({ json: paymentClosed(order, body, coupon) });
  });
  await page.goto(harness.url + (cop ? "?cop" : ""));
  await page.getByRole("button", { name: "Leer QR explícito" }).click();
  await expect(page.getByRole("status", { name: "Sesión" })).toContainText(
    "Ana",
  );
  await page
    .getByRole("button", { name: "Preparar cobro", exact: true })
    .click();
  return stats;
}
for (const cop of [false, true]) {
  test(`100% coupon omits methods and sends empty payments; cop=${cop}`, async ({
    page,
  }) => {
    const stats = await setup(page, cop);
    await expect(
      page.getByRole("button", { name: "Cerrar venta sin cobro" }),
    ).toBeEnabled();
    expect(stats.methods).toBe(0);
    await page.getByRole("button", { name: "Cerrar venta sin cobro" }).click();
    await expect(page.getByRole("status", { name: "Sesión" })).toContainText(
      "closed",
    );
    expect(stats.closes[0].payments).toEqual([]);
  });
}
test("removing a customer from zero sale loads methods and restores a positive close", async ({
  page,
}) => {
  const stats = await setup(page);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page
    .getByRole("button", { name: "Retirar persona", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Preparar cobro", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirmar cobro", exact: true }),
  ).toBeEnabled();
  expect(stats.methods).toBe(1);
  await page
    .getByRole("button", { name: "Confirmar cobro", exact: true })
    .click();
  await expect(page.getByRole("status", { name: "Sesión" })).toContainText(
    "closed",
  );
  expect(stats.closes[0].membershipId).toBeUndefined();
  expect(stats.closes[0].coupon).toBeUndefined();
  expect(stats.closes[0].payments.length).toBe(1);
});

test("cash buffers reject insufficient, negative and excess precision before sending money", async ({
  page,
}) => {
  const stats = await setup(page);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page
    .getByRole("button", { name: "Retirar persona", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Preparar cobro", exact: true })
    .click();
  const received = page.getByRole("textbox", { name: "Recibido", exact: true });
  for (const buffer of ["1", "-1", "5.001", "4,"]) {
    await received.fill(buffer);
    await expect(
      page.getByRole("button", { name: "Confirmar cobro", exact: true }),
    ).toBeDisabled();
    expect(stats.closes).toHaveLength(0);
  }
  await received.fill("");
  await expect(
    page.getByRole("button", { name: "Confirmar cobro", exact: true }),
  ).toBeEnabled();
});

test("card method sends the selected exact amount and no cash buffer", async ({
  page,
}) => {
  const stats = await setup(page);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page
    .getByRole("button", { name: "Retirar persona", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Preparar cobro", exact: true })
    .click();
  await page.getByRole("button", { name: /Medio de pago$/ }).click();
  await page.getByRole("option", { name: "Tarjeta", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Recibido", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Confirmar cobro", exact: true })
    .click();
  await expect(page.getByRole("status", { name: "Sesión" })).toContainText(
    "closed",
  );
  expect(stats.closes[0].payments).toEqual([
    { methodId: "card", amount: "4.01" },
  ]);
  expect("received" in stats.closes[0]).toBe(false);
});
