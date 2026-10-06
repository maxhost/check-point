import { expect, test, type Page } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";

function coupon(kind: string, productId: string | null = null) {
  return {
    couponId: `coupon-${kind}`,
    label:
      kind === "free_product"
        ? "Café americano gratis"
        : kind === "two_for_one"
          ? "2x1 en café"
          : "2 puntos extra",
    kind,
    rule: null,
    productId,
    productName: productId ? "Café americano" : null,
    discountUnit: null,
    discountValue: null,
    currencyCode: null,
    extraUnits: kind === "extra_points" ? 2 : null,
    validUntil: "2026-11-03",
  };
}

const greenFree = {
  status: "selected",
  coupon: coupon("free_product", "coffee"),
  verdict: { valid: true },
};
const expired = {
  status: "selected",
  coupon: coupon("free_product", "coffee"),
  verdict: {
    valid: false,
    code: "coupon_expired",
    message: "Este cupón venció el 03/11/2026.",
  },
};

function resolved(couponState: object, unitPrice: number | null = 2) {
  return {
    consumer: { displayName: "Cliente de prueba" },
    membership: {
      id: "member-1",
      pointsBalance: 10,
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
          id: "coffee",
          name: "Café americano",
          categoryId: null,
          unitPrice,
          imagePath: null,
        },
      ],
      categories: [],
      habitualProductIds: [],
      lastPurchase: null,
    },
    rewards: [],
    couponState,
  };
}

async function scan(page: Page) {
  await page.getByRole("button", { name: "Escanear", exact: true }).click();
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("counter-qr", { detail: "qa-qr" })),
  );
  await expect(
    page.getByRole("heading", { name: "Cliente de prueba" }),
  ).toBeVisible();
}

test("consulta y reescaneo no consumen; el café entra una sola vez y la venta lo bonifica", async ({
  page,
}, testInfo) => {
  const harness = await startCatalogHarness(
    "tests/e2e/support/counter-harness.tsx",
  );
  const grants: Record<string, unknown>[] = [];
  let polls = 0;
  let validateCalls = 0;
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/api/counter/resolve", (route) =>
      route.fulfill({ json: resolved(greenFree) }),
    );
    await page.route("**/api/counter/coupon-state?*", (route) => {
      polls += 1;
      return route.fulfill({ json: { couponState: greenFree } });
    });
    await page.route("**/api/counter/coupon-validate", (route) => {
      validateCalls += 1;
      return route.fulfill({ status: 404 });
    });
    await page.route("**/api/counter/grant", (route) => {
      grants.push(route.request().postDataJSON());
      return route.fulfill({
        json: {
          order: {
            unitsGranted: 1,
            balanceAfter: 11,
            kind: "points",
            grossTotal: "2.00",
            total: "0.00",
            coupon: {
              label: "Café americano gratis",
              discountAmount: "2.00",
              extraUnits: null,
            },
          },
        },
      });
    });
    await page.goto(harness.url);
    await scan(page);
    await expect(page.getByText("Cupón válido")).toBeVisible();
    await expect(page.getByRole("button", { name: "Validar" })).toHaveCount(0);
    await expect(
      page.locator(".counter-product .counter-qty output"),
    ).toHaveText("1");
    await page.screenshot({
      path: testInfo.outputPath("coupon-green-mobile.png"),
    });
    // El sondeo corre cada 4000 ms; con la suite completa en paralelo el primero puede
    // llegar tarde (PARQUEADO #75), asi que se espera el sondeo en vez de un tiempo fijo.
    await expect.poll(() => polls, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect(
      page.locator(".counter-product .counter-qty output"),
    ).toHaveText("1");
    await page.getByRole("button", { name: "Cerrar Mostrador" }).click();
    expect(grants).toHaveLength(0);

    await scan(page);
    await expect(page.getByText("Cupón válido")).toBeVisible();
    await expect(
      page.locator(".counter-product .counter-qty output"),
    ).toHaveText("1");
    await page.getByRole("button", { name: "Acreditar compra" }).click();
    await expect(page.getByRole("heading", { name: "¡Listo!" })).toBeVisible();
    expect(grants).toHaveLength(1);
    expect(grants[0].coupon).toEqual({
      couponId: "coupon-free_product",
      productId: null,
    });
    expect(grants[0].items).toMatchObject([
      { productId: "coffee", quantity: 1 },
    ]);
    await expect(page.getByText("1 unidad bonificada")).toBeVisible();
    expect(validateCalls).toBe(0);
  } finally {
    await harness.close();
  }
});

test("cupón rojo muestra el motivo literal, permite Quitar y no se manda con la venta", async ({
  page,
}, testInfo) => {
  const harness = await startCatalogHarness(
    "tests/e2e/support/counter-harness.tsx",
  );
  const grants: Record<string, unknown>[] = [];
  let removes = 0;
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/api/counter/resolve", (route) =>
      route.fulfill({ json: resolved(expired) }),
    );
    await page.route("**/api/counter/coupon-remove", (route) => {
      removes += 1;
      return route.fulfill({ json: { removed: "selected" } });
    });
    await page.route("**/api/counter/grant", (route) => {
      grants.push(route.request().postDataJSON());
      return route.fulfill({
        json: {
          order: {
            unitsGranted: 1,
            balanceAfter: 11,
            kind: "points",
            grossTotal: "2.00",
            total: "2.00",
            coupon: null,
          },
        },
      });
    });
    await page.goto(harness.url);
    await scan(page);
    await expect(page.getByText("Cupón no válido")).toBeVisible();
    await expect(page.locator(".counter-coupon-reason")).toHaveText(
      "Este cupón venció el 03/11/2026.",
    );
    await page.screenshot({
      path: testInfo.outputPath("coupon-red-mobile.png"),
    });
    await expect(page.locator(".counter-product .counter-qty")).toHaveCount(0);
    await page.getByRole("button", { name: "Quitar" }).click();
    expect(removes).toBe(1);
    await expect(page.getByText("Cupón no válido")).toHaveCount(0);

    await page.getByRole("button", { name: "Cerrar Mostrador" }).click();
    await scan(page);
    await page.getByRole("button", { name: "Agregar Café americano" }).click();
    await page.getByRole("button", { name: "Acreditar compra" }).click();
    await expect(page.getByRole("heading", { name: "¡Listo!" })).toBeVisible();
    expect(grants).toHaveLength(1);
    expect(grants[0]).not.toHaveProperty("coupon");
  } finally {
    await harness.close();
  }
});

test("2x1 pide precio y muestra cada rechazo M4; coupon_not_selected refresca M1", async ({
  page,
}) => {
  const harness = await startCatalogHarness(
    "tests/e2e/support/counter-harness.tsx",
  );
  const errors = [
    "coupon_not_yet_valid",
    "coupon_expired",
    "already_redeemed",
    "coupon_daily_limit",
    "coupon_cap_reached",
    "program_changed",
    "coupon_product_missing",
    "coupon_quantity",
    "coupon_currency_mismatch",
    "coupon_not_selected",
  ];
  let polls = 0;
  try {
    await page.route("**/api/counter/resolve", (route) =>
      route.fulfill({
        json: resolved(
          {
            status: "selected",
            coupon: coupon("two_for_one", "coffee"),
            verdict: { valid: true },
          },
          null,
        ),
      }),
    );
    await page.route("**/api/counter/coupon-state?*", (route) => {
      polls += 1;
      return route.fulfill({
        json: {
          couponState:
            errors.length === 0
              ? expired
              : {
                  status: "selected",
                  coupon: coupon("two_for_one", "coffee"),
                  verdict: { valid: true },
                },
        },
      });
    });
    await page.route("**/api/counter/grant", (route) => {
      const code = errors.shift();
      return route.fulfill({
        status: 409,
        json: { error: `Rechazo ${code}`, code },
      });
    });
    await page.goto(harness.url);
    await scan(page);
    await expect(
      page.locator(".counter-product .counter-qty output"),
    ).toHaveText("2");
    await expect(
      page.getByRole("button", { name: "Acreditar compra" }),
    ).toBeDisabled();
    await page
      .getByRole("spinbutton", { name: "Precio unitario de Café americano" })
      .fill("2");
    const confirm = page.getByRole("button", { name: "Acreditar compra" });
    await expect(confirm).toBeEnabled();
    const previousPolls = polls;
    for (const code of [...errors]) {
      await confirm.click();
      await expect(page.getByText(`Rechazo ${code}`)).toBeVisible();
      await expect(page.getByRole("heading", { name: "¡Listo!" })).toHaveCount(
        0,
      );
    }
    expect(polls).toBeGreaterThan(previousPolls);
    await expect(
      page.getByText("Este cupón venció el 03/11/2026."),
    ).toBeVisible();
  } finally {
    await harness.close();
  }
});

test("el éxito separa unidades de venta y extras del cupón", async ({
  page,
}) => {
  const harness = await startCatalogHarness(
    "tests/e2e/support/counter-harness.tsx",
  );
  try {
    await page.route("**/api/counter/resolve", (route) =>
      route.fulfill({
        json: resolved({
          status: "selected",
          coupon: coupon("extra_points"),
          verdict: { valid: true },
        }),
      }),
    );
    await page.route("**/api/counter/grant", (route) =>
      route.fulfill({
        json: {
          order: {
            unitsGranted: 1,
            balanceAfter: 13,
            kind: "points",
            grossTotal: "2.00",
            total: "2.00",
            coupon: {
              label: "2 puntos extra",
              discountAmount: "0.00",
              extraUnits: 2,
            },
          },
        },
      }),
    );
    await page.goto(harness.url);
    await scan(page);
    await expect(page.getByRole("button", { name: "Quitar" })).toBeVisible();
    await page.getByRole("button", { name: "Agregar Café americano" }).click();
    await page.getByRole("button", { name: "Acreditar compra" }).click();
    await expect(
      page.getByText("+1 punto por la venta para Cliente de prueba"),
    ).toBeVisible();
    await expect(page.getByText("+2 puntos del cupón")).toBeVisible();
    await expect(page.getByText("Saldo: 13 puntos")).toBeVisible();
  } finally {
    await harness.close();
  }
});
