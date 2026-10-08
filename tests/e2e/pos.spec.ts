import { expect, test, type Page } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
import type { PosOrder } from "../../apps/merchant/src/app/backoffice/pos/pos-types";
let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/pos-counter-harness.tsx",
  );
});
test.afterAll(async () => {
  await harness.close();
});
const product = {
  id: "coffee",
  name: "Café",
  unitPrice: 15,
  categoryId: null,
  imagePath: null,
};
const baseOrder: PosOrder = {
  id: "order-1",
  tableLabel: "Mesa 4",
  status: "open",
  version: 1,
  location: { id: "local-1", name: "Centro" },
  business: { name: "Café de prueba", currencyCode: "USD" },
  items: [
    {
      lineId: "line-1",
      productId: "coffee",
      name: "Café",
      quantity: 1,
      unitPrice: "10.00",
      lineTotal: "10.00",
    },
  ],
  total: "10.00",
  createdAt: "2026-10-08T12:00:00Z",
  createdBy: "Ana",
  closedAt: null,
  closedBy: null,
  sale: null,
};
const coupon = {
  status: "selected",
  verdict: { valid: true },
  coupon: {
    couponId: "coupon-1",
    label: "Descuento elegido",
    kind: "discount",
    rule: null,
    productId: null,
    productName: null,
    discountUnit: "percent",
    discountValue: "10",
    currencyCode: "USD",
    extraUnits: null,
    validUntil: "2026-12-01",
  },
};
const resolved = {
  consumer: { displayName: "Cliente de prueba" },
  membership: {
    id: "member-1",
    pointsBalance: 10,
    stampsCount: 0,
    justEnrolled: false,
  },
  program: { kind: "points" },
  couponState: coupon,
  catalog: {
    products: [product],
    categories: [],
    habitualProductIds: [],
    lastPurchase: null,
  },
  rewards: [],
};
async function setup(page: Page, enabled = true) {
  const counterCalls: string[] = [];
  await page.route("**/api/counter/**", (route) => {
    counterCalls.push(route.request().url());
    return route.abort();
  });
  await page.route("**/api/merchant/session", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        business: { posEnabled: enabled, currencyCode: "USD" },
        membership: { role: "owner", permissions: ["pos"] },
      },
    }),
  );
  await page.route("**/api/pos/catalog**", (route) =>
    route.fulfill({
      json: {
        products: [
          product,
          { ...product, id: "custom", name: "Especial", unitPrice: null },
        ],
        categories: [],
      },
    }),
  );
  await page.route("**/api/pos/orders", (route) =>
    route.fulfill({
      json: {
        open: [{ ...baseOrder, itemCount: 1, saleTotal: null }],
        closedToday: [],
      },
    }),
  );
  await page.route("**/api/pos/orders/order-1", (route) =>
    route.fulfill({ json: baseOrder }),
  );
  return counterCalls;
}
async function open(page: Page) {
  await page.goto(harness.url);
  await page.getByRole("button", { name: "Abrir Mesa 4" }).click();
}
async function scan(page: Page) {
  await page.getByRole("button", { name: "Escanear pase" }).click();
  await page.getByRole("textbox", { name: "Código del pase" }).fill("qa-token");
  await page.getByRole("button", { name: "Leer pase" }).click();
}
test("crear con local y precio escrito; editar conserva snapshot y lineId; imprimir y cerrar sin pase", async ({
  page,
}, testInfo) => {
  const calls = await setup(page);
  let createBody: Record<string, unknown> | null = null;
  let editBody: Record<string, unknown> | null = null;
  await page.route("**/api/pos/orders", (route) => {
    if (route.request().method() === "POST") {
      createBody = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: baseOrder });
    }
    return route.fulfill({ json: { open: [], closedToday: [] } });
  });
  await page.route("**/api/pos/orders/order-1", (route) => {
    if (route.request().method() === "PUT") {
      editBody = route.request().postDataJSON();
      return route.fulfill({
        json: {
          ...baseOrder,
          version: 2,
          items: [{ ...baseOrder.items[0], quantity: 2, lineTotal: "20.00" }],
          total: "20.00",
        },
      });
    }
    return route.fulfill({ json: baseOrder });
  });
  const closeBodies: unknown[] = [];
  await page.route("**/api/pos/orders/order-1/close", (route) => {
    closeBodies.push(route.request().postDataJSON());
    return route.fulfill({
      json: {
        ...baseOrder,
        status: "closed",
        total: "20.00",
        closedAt: "2026-10-08T13:00:00Z",
        closedBy: "Ana",
      },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(harness.url);
  await expect(page.getByRole("link", { name: "Abrir mostrador" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Nueva orden" }).click();
  await page.getByRole("textbox", { name: "Nombre de mesa" }).fill("Mesa 4");
  await expect(
    page.getByRole("button", { name: "Guardar orden" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /Local/ }).click();
  await page.getByRole("option", { name: "Centro" }).click();
  await page
    .getByRole("button", { name: "Agregar Especial", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "Precio unitario de Especial" })
    .fill("7.50");
  await page
    .getByRole("spinbutton", { name: "Precio unitario de Especial" })
    .press("Tab");
  await page.getByRole("button", { name: "Guardar orden" }).click();
  await expect(
    page.getByRole("heading", { name: "Mesa 4 · Precuenta" }),
  ).toBeVisible();
  expect(createBody).toEqual({
    tableLabel: "Mesa 4",
    locationId: "local-1",
    items: [{ productId: "custom", quantity: 1, unitPrice: "7.50" }],
  });
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByRole("button", { name: /Ver detalle/ }).click();
  await expect(
    page.getByText("$10,00 por unidad · Precio guardado"),
  ).toBeVisible();
  await page.getByRole("button", { name: /Ocultar detalle/ }).click();
  await page
    .getByRole("button", { name: "Agregar un Café", exact: true })
    .click();
  await page.getByRole("button", { name: "Guardar orden" }).click();
  await expect(
    page.getByRole("button", { name: "Cobrar", exact: true }),
  ).toBeVisible();
  expect(editBody).toEqual({
    version: 1,
    tableLabel: "Mesa 4",
    locationId: "local-1",
    items: [{ lineId: "line-1", productId: "coffee", quantity: 2 }],
  });
  await page.evaluate(() => {
    window.print = () => {
      document.documentElement.dataset.printed = "yes";
    };
  });
  await page.getByRole("button", { name: "Imprimir" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-printed", "yes");
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("navigation").first()).toBeHidden();
  await expect(page.getByRole("button", { name: "Imprimir" })).toBeHidden();
  await expect(
    page.getByRole("region", { name: "Ticket de la orden" }),
  ).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  await page.screenshot({ path: testInfo.outputPath("pos-mobile.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  await page.getByRole("textbox", { name: "Recibido" }).fill("30");
  await page.getByRole("textbox", { name: "Recibido" }).press("Tab");
  await expect(page.getByText("Cambio: $10,00")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar venta", exact: true }).click();
  await expect(page.getByText("Venta cerrada sin pase.")).toBeVisible();
  expect(closeBodies[0]).toMatchObject({ version: 2 });
  expect(Object.keys(closeBodies[0] as object).sort()).toEqual([
    "clientRequestId",
    "version",
  ]);
  expect(calls).toEqual([]);
});
test("conflicto carga versión vigente y anulación confirmada", async ({
  page,
}) => {
  await setup(page);
  await page.route("**/api/pos/orders/order-1", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({
          status: 409,
          json: {
            code: "version_conflict",
            error: "Conflicto",
            order: { ...baseOrder, version: 4, tableLabel: "Mesa actual" },
          },
        })
      : route.fulfill({ json: baseOrder }),
  );
  let voided = false;
  await page.route("**/api/pos/orders/order-1/void", (route) => {
    voided = true;
    return route.fulfill({
      json: { ...baseOrder, tableLabel: "Mesa actual", status: "voided" },
    });
  });
  await open(page);
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByRole("button", { name: "Guardar orden" }).click();
  await expect(
    page.getByText(
      "Otra persona modificó esta orden. Cargamos la versión actual; revísala antes de continuar.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Mesa actual · Precuenta" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Anular", exact: true }).click();
  expect(voided).toBe(false);
  await page.getByRole("button", { name: "Anular orden", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Mesa actual · Anulada" }),
  ).toBeVisible();
});
test("cobro con pase usa solo POS y reintenta con UUID y cuerpo idénticos", async ({
  page,
}) => {
  const calls = await setup(page);
  await page.route("**/api/pos/resolve", (route) => {
    expect(route.request().postDataJSON()).toEqual({
      qrToken: "qa-token",
      locationId: "local-1",
    });
    return route.fulfill({ json: resolved });
  });
  await page.route("**/api/pos/coupon-state**", (route) =>
    route.fulfill({ json: { couponState: coupon } }),
  );
  const bodies: unknown[] = [];
  await page.route("**/api/pos/orders/order-1/close", (route) => {
    bodies.push(route.request().postDataJSON());
    if (bodies.length === 1)
      return route.fulfill({
        status: 503,
        json: { error: "No pudimos confirmar el cierre." },
      });
    if (bodies.length === 2) return route.abort("failed");
    return route.fulfill({
      json: {
        ...baseOrder,
        status: "closed",
        sale: {
          consumer: "Cliente de prueba",
          total: "9.00",
          grossTotal: "10.00",
          unitsGranted: 3,
          balanceAfter: 13,
          kind: "points",
          coupon: {
            label: "Descuento elegido",
            discountAmount: "1.00",
            extraUnits: null,
          },
        },
      },
    });
  });
  await open(page);
  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  await scan(page);
  await expect(
    page.getByRole("heading", { name: "Cupón válido", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar venta", exact: true }).click();
  await page.getByRole("button", { name: "Reintentar cierre" }).click();
  await page.getByRole("button", { name: "Reintentar cierre" }).click();
  await expect(page.getByText("+3 puntos acreditados")).toBeVisible();
  await expect(page.getByText("Saldo: 13 puntos")).toBeVisible();
  await expect(page.getByText("Total: $9,00")).toBeVisible();
  expect(bodies).toHaveLength(3);
  expect(bodies[1]).toEqual(bodies[0]);
  expect(bodies[2]).toEqual(bodies[0]);
  expect(bodies[0]).toMatchObject({
    membershipId: "member-1",
    coupon: { couponId: "coupon-1" },
  });
  expect(calls).toEqual([]);
});
test("cupón inválido se puede quitar; error al cerrar conserva orden abierta", async ({
  page,
}) => {
  await setup(page);
  const invalid = {
    ...coupon,
    verdict: {
      valid: false,
      code: "coupon_expired",
      message: "El cupón venció.",
    },
  };
  await page.route("**/api/pos/resolve", (route) =>
    route.fulfill({ json: { ...resolved, couponState: invalid } }),
  );
  await page.route("**/api/pos/coupon-state**", (route) =>
    route.fulfill({ json: { couponState: invalid } }),
  );
  let removed: unknown;
  await page.route("**/api/pos/coupon-remove", (route) => {
    removed = route.request().postDataJSON();
    return route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/pos/orders/order-1/close", (route) =>
    route.fulfill({
      status: 409,
      json: { error: "El cupón venció.", code: "coupon_expired" },
    }),
  );
  await open(page);
  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  await scan(page);
  await expect(
    page.getByRole("heading", { name: "Cupón no válido" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Quitar", exact: true }).click();
  expect(removed).toEqual({ membershipId: "member-1", couponId: "coupon-1" });
  await page.getByRole("button", { name: "Cerrar venta", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Cerrar venta", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Mesa 4 · Precuenta" }),
  ).toBeVisible();
  await expect(page.getByText("El cupón venció.").first()).toBeVisible();
});
test("activación y desactivación bloqueada por órdenes abiertas", async ({
  page,
}) => {
  await setup(page, false);
  const bodies: unknown[] = [];
  await page.route("**/api/merchant/business/pos", (route) => {
    const body = route.request().postDataJSON();
    bodies.push(body);
    return body.enabled
      ? route.fulfill({ json: { enabled: true } })
      : route.fulfill({
          status: 409,
          json: {
            error: "Órdenes abiertas",
            code: "pos_has_open_orders",
            openCount: 3,
          },
        });
  });
  await page.goto(`${harness.url}?mode=settings`);
  await page.getByRole("button", { name: "Activar POS", exact: true }).click();
  await page
    .getByRole("button", { name: "Desactivar POS", exact: true })
    .click();
  await expect(
    page.getByRole("alertdialog", { name: "No puedes desactivar el POS" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Hay 3 órdenes abiertas. Cierra o anula esas órdenes antes de desactivar el módulo.",
    ),
  ).toBeVisible();
  expect(bodies).toEqual([{ enabled: true }, { enabled: false }]);
});
test("módulo apagado oculta permiso y bloquea POS; encendido ofrece permiso y navegación a staff pos", async ({
  page,
}) => {
  await setup(page, false);
  await page.goto(`${harness.url}?mode=permissions-off`);
  await expect(
    page.getByRole("switch", { name: "POS", exact: true }),
  ).toHaveCount(0);
  await page.goto(harness.url);
  await expect(
    page.getByRole("heading", { name: "POS no disponible" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "POS", exact: true }),
  ).toHaveCount(0);
  await setup(page, true);
  await page.goto(`${harness.url}?mode=permissions-on`);
  await expect(
    page.getByRole("switch", { name: "POS", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "POS", exact: true }).first(),
  ).toBeVisible();
});

test("pérdida del permiso retira las acciones y no llama al mostrador", async ({
  page,
}) => {
  const calls = await setup(page);
  await page.route("**/api/pos/orders", (route) =>
    route.fulfill({
      status: 403,
      json: {
        error: "No tienes permiso para operar el POS.",
        code: "missing_permission",
      },
    }),
  );
  await page.goto(harness.url);
  await expect(
    page.getByRole("heading", { name: "POS no disponible" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Nueva orden" })).toHaveCount(
    0,
  );
  expect(calls).toEqual([]);
});

test("POS reutiliza catálogo de Mostrador: ranking HTTP, categorías en carrusel, búsqueda y cantidades", async ({
  page,
}, testInfo) => {
  await setup(page);
  const categories = Array.from({ length: 7 }, (_, index) => ({
    id: `category-${index}`,
    name: `Categoría de prueba ${index}`,
  }));
  const products = [
    {
      ...product,
      id: "juice",
      name: "Zumo",
      categoryId: "category-0",
      unitPrice: 5,
    },
    { ...product, categoryId: "category-1" },
    ...categories.slice(2).map((category, index) => ({
      ...product,
      id: `product-${index}`,
      name: `Producto ${index}`,
      categoryId: category.id,
    })),
  ];
  await page.route("**/api/pos/catalog**", (route) =>
    route.fulfill({
      json: {
        products,
        categories,
        bestSellingProductIds: ["juice", "coffee"],
      },
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(harness.url);
  await page.getByRole("button", { name: "Nueva orden" }).click();
  await page
    .getByRole("textbox", { name: "Nombre de mesa" })
    .fill("Mesa prueba");
  await page.getByRole("button", { name: /Local/ }).click();
  await page.getByRole("option", { name: "Centro" }).click();
  const catalog = page.locator(".counter-detailed");
  await expect(
    catalog.locator(".counter-product-add").first(),
  ).toHaveAccessibleName("Agregar Zumo");
  await expect(
    catalog.locator(".counter-product-add").nth(1),
  ).toHaveAccessibleName("Agregar Café");
  const carousel = page.getByRole("group", { name: "Categorías" });
  expect(
    await carousel.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  ).toBe(true);
  await carousel
    .getByRole("button", { name: "Categoría de prueba 1", exact: true })
    .click();
  await expect(
    catalog.getByRole("button", { name: "Agregar Zumo", exact: true }),
  ).toHaveCount(0);
  await catalog
    .getByRole("button", { name: "Agregar Café", exact: true })
    .click();
  await catalog
    .getByRole("button", { name: "Agregar un Café", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /2 artículos/ })).toBeVisible();
  await catalog
    .getByRole("button", { name: "Quitar un Café", exact: true })
    .click();
  await catalog
    .getByRole("button", { name: "Quitar un Café", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /0 artículos/ })).toBeVisible();
  await expect(
    catalog.getByRole("button", { name: "Quitar un Café", exact: true }),
  ).toHaveCount(0);
  await catalog.getByRole("button", { name: "Buscar", exact: true }).click();
  await page.getByRole("searchbox", { name: "Buscar producto" }).fill("zumo");
  await expect(
    catalog.getByRole("button", { name: "Agregar Zumo", exact: true }),
  ).toBeVisible();
  await expect(
    catalog.getByRole("button", { name: "Agregar Café", exact: true }),
  ).toHaveCount(0);
  await catalog
    .getByRole("button", { name: "Cerrar búsqueda", exact: true })
    .click();
  await carousel.getByRole("button", { name: "Todos", exact: true }).click();
  await catalog
    .getByRole("button", { name: "Agregar Zumo", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Guardar orden", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Cancelar", exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("pos-catalog-mobile.png"),
  });
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.screenshot({
    path: testInfo.outputPath("pos-catalog-desktop.png"),
  });
});

test("el resumen mantiene snapshots duplicados y productos borrados separados al editar", async ({
  page,
}) => {
  await setup(page);
  const items = [
    baseOrder.items[0],
    {
      ...baseOrder.items[0],
      lineId: "line-2",
      unitPrice: "15.00",
      lineTotal: "15.00",
    },
    {
      ...baseOrder.items[0],
      lineId: "line-3",
      productId: null,
      name: "Producto retirado",
      unitPrice: "7.00",
      lineTotal: "7.00",
    },
  ];
  let body: unknown;
  await page.route("**/api/pos/orders/order-1", (route) => {
    if (route.request().method() === "PUT")
      body = route.request().postDataJSON();
    return route.fulfill({ json: { ...baseOrder, items, total: "32.00" } });
  });
  await open(page);
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByRole("button", { name: /Ver detalle/ }).click();
  const detail = page.locator("#pos-cart-detail");
  await expect(
    detail.getByText("$10,00 por unidad · Precio guardado"),
  ).toBeVisible();
  await expect(
    detail.getByText("$15,00 por unidad · Precio guardado"),
  ).toBeVisible();
  await expect(detail.getByText("1 × Producto retirado")).toBeVisible();
  await page
    .locator(".counter-detailed")
    .getByRole("button", { name: "Agregar un Café", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Guardar orden", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mesa 4 · Precuenta" }),
  ).toBeVisible();
  expect(body).toMatchObject({
    items: [
      { lineId: "line-1", productId: "coffee", quantity: 1 },
      { lineId: "line-2", productId: "coffee", quantity: 2 },
      { lineId: "line-3", productId: null, quantity: 1 },
    ],
  });
});
