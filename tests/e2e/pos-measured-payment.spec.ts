import { test, expect, type Page } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
import {
  paymentOrder,
  paymentResolved,
  paymentCoupon,
  paymentMethods,
  paymentClosed,
} from "./support/pos-measured-payment-fixture";
import type { MeasuredPaymentBody as PosCloseV2 } from "../../apps/merchant/src/modules/pos/ui/measured-payment-close";
let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/pos-measured-payment-harness.tsx",
  );
});
test.afterAll(async () => {
  await harness.close();
});
async function mock(page: Page, mode = "normal") {
  const calls: {
    url: string;
    body: PosCloseV2;
    scope: string;
    contract: string;
  }[] = [];
  let resolves = 0;
  await page.route("**/api/modules/pos/**", async (route) => {
    const request = route.request(),
      url = request.url();
    const body = request.postData() ? request.postDataJSON() : null;
    calls.push({
      url,
      body,
      scope: request.headers()["x-backoffice-scope"],
      contract: request.headers()["x-pos-contract"],
    });
    if (url.endsWith("/resolve")) {
      resolves++;
      if (mode === "late")
        await new Promise((resolve) => setTimeout(resolve, 150));
      await route.fulfill({
        json:
          mode === "mixture"
            ? {
                ...paymentResolved,
                couponState: {
                  ...paymentResolved.couponState,
                  coupon: {
                    ...paymentCoupon,
                    kind: "free_product",
                    productId: "coffee",
                  },
                },
              }
            : paymentResolved,
      });
      return;
    }
    if (url.includes("coupon-state")) {
      await route.fulfill({
        json: {
          couponState: {
            ...paymentResolved.couponState,
            coupon: {
              ...paymentCoupon,
              ...(mode === "mixture"
                ? { kind: "free_product", productId: "coffee" }
                : {}),
              ...(mode === "mass"
                ? { kind: "free_product", productId: "mass" }
                : {}),
              ...(mode === "changed" ? { discountValue: "50" } : {}),
            },
          },
        },
      });
      return;
    }
    if (url.endsWith("payment-methods")) {
      await route.fulfill({
        json: { methods: paymentMethods, defaultMethodId: "cash" },
      });
      return;
    }
    const count = calls.filter((call) => call.url.endsWith("/close")).length;
    if (mode === "lost" && count === 1) {
      await route.abort();
      return;
    }
    if (mode === "lost" && count === 2) {
      await route.fulfill({
        status: 409,
        json: { code: "version_conflict", error: "Cambió" },
      });
      return;
    }
    if (mode === "conflict") {
      await route.fulfill({
        status: 409,
        json: {
          code: "version_conflict",
          error: "Cambió",
          order: { ...paymentOrder, version: 2 },
        },
      });
      return;
    }
    if (mode === "late-close")
      await new Promise((resolve) => setTimeout(resolve, 60));
    const order = structuredClone(paymentOrder);
    if (mode === "mixture")
      order.items.push({
        ...order.items[0],
        lineId: "second",
        name: "Café distinto",
        quantity: "1",
        unitPrice: "3",
        lineTotal: "3",
      });
    if (mode === "cop") order.business.currencyCode = "COP";
    if (body.payments?.length === 0 && !body.coupon)
      order.items.forEach((line) => {
        line.unitPrice = "0";
      });
    await route.fulfill({
      json: paymentClosed(
        order,
        body,
        mode === "mixture"
          ? { ...paymentCoupon, kind: "free_product", productId: "coffee" }
          : paymentCoupon,
      ),
    });
  });
  return {
    calls,
    get resolves() {
      return resolves;
    },
  };
}
async function open(page: Page, query = "") {
  await page.goto(harness.url + query);
  await page
    .getByRole("button", { name: "Preparar cobro", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
test("anonymous cash exact buffers and frozen uncertain retry survive remount", async ({
  page,
}) => {
  const { calls } = await mock(page, "lost");
  await open(page);
  await page.getByRole("textbox", { name: "Recibido" }).fill("4,");
  await expect(
    page.getByRole("button", { name: "Confirmar cobro", exact: true }),
  ).toBeDisabled();
  await page.getByRole("textbox", { name: "Recibido" }).fill("5,00");
  await expect(
    page.getByText("Cambio: 0.99 USD", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirmar cobro", exact: true })
    .dblclick();
  await expect(
    page.getByRole("button", { name: "Reintentar el mismo cobro" }),
  ).toBeVisible();
  // Parent retains the session while the checkout view is replaced.
  await page.evaluate(() => {
    document.dispatchEvent(new CustomEvent("test-remount"));
  });
  await page.getByRole("button", { name: "Reintentar el mismo cobro" }).click();
  await expect(
    page.getByRole("button", { name: "Reintentar el mismo cobro" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reintentar el mismo cobro" }).click();
  await expect(page.getByRole("status", { name: "Sesión" })).toContainText(
    "closed",
  );
  const closes = calls.filter((call) => call.url.endsWith("/close"));
  expect(closes).toHaveLength(3);
  expect(closes[0].body).toEqual(closes[2].body);
  expect(closes[0].scope).toBe("a".repeat(64));
  expect(closes[0].contract).toBe("2");
});
test("zero closes with no methods and no fake payment", async ({ page }) => {
  const { calls } = await mock(page);
  await open(page, "?zero");
  await page.getByRole("button", { name: "Cerrar venta sin cobro" }).click();
  await expect(page.getByRole("status", { name: "Sesión" })).toContainText(
    "closed",
  );
  expect(calls.some((call) => call.url.endsWith("payment-methods"))).toBe(
    false,
  );
  expect(
    calls.find((call) => call.url.endsWith("/close"))?.body.payments,
  ).toEqual([]);
});
test("revalidation changed coupon requires explicit review and full rule", async ({
  page,
}) => {
  const data = await mock(page, "changed");
  await page.goto(harness.url);
  expect(data.resolves).toBe(0);
  await page.getByRole("button", { name: "Leer QR explícito" }).click();
  await expect(page.getByRole("status", { name: "Sesión" })).toContainText(
    "Ana",
  );
  await page
    .getByRole("button", { name: "Preparar cobro", exact: true })
    .click();
  await expect(
    page.getByText(paymentCoupon.rule!, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirmar cobro", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "He revisado la actualización" })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirmar cobro", exact: true }),
  ).toBeEnabled();
});
test("mass free coupon is blocked, local exclusion never removes global coupon", async ({
  page,
}) => {
  const { calls } = await mock(page, "mass");
  await page.goto(harness.url);
  await page.getByRole("button", { name: "Leer QR explícito" }).click();
  await expect(page.getByRole("status", { name: "Sesión" })).toContainText(
    "Ana",
  );
  await page
    .getByRole("button", { name: "Preparar cobro", exact: true })
    .click();
  await expect(
    page.getByText("Gratis y 2×1 no aplican a productos por peso", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Quitar beneficio de esta venta" })
    .click();
  await page
    .getByRole("button", { name: "Revisar cobro", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar cobro", exact: true })
    .click();
  await expect(page.getByRole("status", { name: "Sesión" })).toContainText(
    "closed",
  );
  expect(calls.some((call) => call.url.includes("coupon-remove"))).toBe(false);
  expect(
    calls.find((call) => call.url.endsWith("/close"))?.body.coupon,
  ).toBeUndefined();
});
test("first conflict sends one close and parent accepts same-order version explicitly", async ({
  page,
}) => {
  const { calls } = await mock(page, "conflict");
  await open(page);
  await page
    .getByRole("button", { name: "Confirmar cobro", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Recuperar orden para revisión" }),
  ).toBeVisible();
  expect(calls.filter((call) => call.url.endsWith("/close"))).toHaveLength(1);
  await page.evaluate(() =>
    document.dispatchEvent(new CustomEvent("test-review")),
  );
  await expect(page.getByRole("status", { name: "Sesión" })).toContainText(
    "versión 2",
  );
  expect(calls.filter((call) => call.url.endsWith("/close"))).toHaveLength(1);
});
test("late QR response cannot restore removed customer", async ({ page }) => {
  await mock(page, "late");
  await page.goto(harness.url);
  await page.getByRole("button", { name: "Leer QR explícito" }).click();
  await page.getByRole("button", { name: "Retirar persona" }).click();
  await page.waitForTimeout(220);
  await expect(page.getByRole("status", { name: "Sesión" })).toContainText(
    "Anónimo",
  );
});
test("approved checkout at phone and desktop", async ({ page }, info) => {
  await mock(page);
  await open(page);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole("button", { name: "Confirmar cobro", exact: true }),
    ).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`checkout-${width}.png`),
      fullPage: true,
    });
  }
});

test("currency zero cash uses normalized change with partial buffer retained", async ({
  page,
}) => {
  await mock(page, "cop");
  await open(page, "?cop");
  await page.getByRole("textbox", { name: "Recibido" }).fill("4,49");
  await expect(page.getByText("Cambio: 0 COP", { exact: false })).toBeVisible();
  await page.getByRole("textbox", { name: "Recibido" }).fill("4,50");
  await expect(page.getByText("Cambio: 1 COP", { exact: false })).toBeVisible();
});
test("real scope retirement discards a late canonical close callback", async ({
  page,
}) => {
  await mock(page, "late-close");
  await open(page);
  const pending = page.waitForRequest((request) =>
    request.url().endsWith("/close"),
  );
  await page
    .getByRole("button", { name: "Confirmar cobro", exact: true })
    .click();
  await pending;
  await page.evaluate(() =>
    document.dispatchEvent(new CustomEvent("test-identity")),
  );
  await page.waitForTimeout(150);
  await expect(page.getByRole("status", { name: "Sesión" })).toContainText(
    "retired",
  );
  await expect(page.getByRole("status", { name: "Sesión" })).toContainText(
    "cierres 0",
  );
});

test("mixed sale preserves explicit source snapshot target in close", async ({
  page,
}) => {
  const { calls } = await mock(page, "mixture");
  await page.goto(harness.url + "?mixture");
  await page.getByRole("button", { name: "Leer QR explícito" }).click();
  await expect(page.getByRole("status", { name: "Sesión" })).toContainText(
    "Ana",
  );
  await page
    .getByRole("button", { name: "Preparar cobro", exact: true })
    .click();
  await page.getByRole("button", { name: /Línea del beneficio$/ }).click();
  await page.getByRole("option", { name: /Café distinto/ }).click();
  await page
    .getByRole("button", { name: "Revisar cobro", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar cobro", exact: true })
    .click();
  await expect(page.getByRole("status", { name: "Sesión" })).toContainText(
    "closed",
  );
  expect(
    calls.find((call) => call.url.endsWith("/close"))?.body.coupon,
  ).toMatchObject({ productId: "coffee", targetSourceLineId: "second" });
});
