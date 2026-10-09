import { expect, test, type Page } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
import {
  detailKey,
  historyKey,
  DiscardedPosRead,
  PosCache,
} from "../../apps/merchant/src/app/backoffice/pos/pos-cache";
import type { PosOrder } from "../../apps/merchant/src/app/backoffice/pos/pos-types";
let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/pos-counter-harness.tsx",
    "pos",
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
        user: { id: "operator-1" },
        business: {
          id: "business-1",
          status: "active",
          timezone: "UTC",
          posEnabled: enabled,
          currencyCode: "USD",
        },
        membership: { role: "owner", status: "active", permissions: ["pos"] },
      },
    }),
  );
  await page.route("**/api/pos/catalog**", (route) =>
    route.fulfill({
      json: {
        products: [
          product,
          { ...product, id: "custom", name: "Especial", unitPrice: 7.5 },
        ],
        categories: [],
        bestSellingProductIds: [],
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
async function annul(page: Page) {
  await page.getByRole("button", { name: "Más acciones", exact: true }).click();
  await page.getByRole("button", { name: "Anular", exact: true }).click();
}
async function editContext(page: Page) {
  await page.getByRole("button", { name: "Mesa y local", exact: true }).click();
}
async function scan(page: Page) {
  await page.getByRole("button", { name: "Escanear pase" }).click();
  await page.getByRole("textbox", { name: "Código del pase" }).fill("qa-token");
  await page.getByRole("button", { name: "Leer pase" }).click();
}
test("crear en pasos con precio de catálogo; editar conserva snapshot y lineId; imprimir y cerrar sin pase", async ({
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
        version: 3,
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
    page.getByRole("radio", { name: "Productos", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Guardar orden", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Tomar pedido", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /Local/ }).click();
  await page.getByRole("option", { name: "Centro" }).click();
  await page.getByRole("button", { name: "Tomar pedido", exact: true }).click();
  await page
    .getByRole("button", { name: "Agregar Especial", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Precio unitario de Especial" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Revisar pedido", exact: true })
    .click();
  await page
    .getByRole("button", { name: /^Guardar (pedido|orden|cambios)$/ })
    .click();
  await expect(page.getByRole("heading", { name: "Mesa 4" })).toBeVisible();
  expect(createBody).toEqual({
    tableLabel: "Mesa 4",
    locationId: "local-1",
    items: [{ productId: "custom", quantity: 1 }],
  });
  await page.getByRole("radio", { name: "Productos", exact: true }).click();
  await page.getByRole("radio", { name: /^Pedido/ }).click();
  await expect(
    page.getByText("$10,00 por unidad · Precio guardado"),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Productos", exact: true }).click();
  await page
    .getByRole("button", { name: "Agregar un Café", exact: true })
    .click();
  await page
    .getByRole("button", { name: /^Guardar (pedido|orden|cambios)$/ })
    .click();
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
  await page.getByRole("button", { name: "Más acciones", exact: true }).click();
  await page.getByRole("button", { name: "Imprimir precuenta" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-printed", "yes");
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("navigation").first()).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Imprimir precuenta" }),
  ).toBeHidden();
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
  let current = baseOrder;
  await page.route("**/api/pos/orders/order-1", (route) =>
    route.request().method() === "PUT"
      ? ((current = { ...baseOrder, version: 4, tableLabel: "Mesa actual" }),
        route.fulfill({
          status: 409,
          json: {
            code: "version_conflict",
            error: "Conflicto",
            order: { ...baseOrder, version: 4, tableLabel: "Mesa actual" },
          },
        }))
      : route.fulfill({ json: current }),
  );
  let voided = false;
  await page.route("**/api/pos/orders/order-1/void", (route) => {
    voided = true;
    return route.fulfill({
      json: {
        ...baseOrder,
        version: 5,
        tableLabel: "Mesa actual",
        status: "voided",
      },
    });
  });
  await open(page);
  await page.getByRole("radio", { name: "Productos", exact: true }).click();
  await page
    .getByRole("button", { name: "Agregar un Café", exact: true })
    .click();
  await page
    .getByRole("button", { name: /^Guardar (pedido|orden|cambios)$/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mesa 4", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Guardar cambios", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Revisar versión actual" }).click();
  await expect(
    page.getByRole("heading", { name: "Tus cambios · Mesa 4" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Versión actual · Mesa actual" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Usar versión actual" }).click();
  await expect(
    page.getByRole("heading", { name: "Mesa actual", exact: true }),
  ).toBeVisible();
  await annul(page);
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
    page.getByRole("heading", { name: "Mesa 4 · Precuenta", exact: true }),
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
  await page.getByRole("button", { name: "Tomar pedido", exact: true }).click();
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
  await expect(catalog.locator(".counter-qty output")).toHaveText("2");
  await catalog
    .getByRole("button", { name: "Quitar un Café", exact: true })
    .click();
  await catalog
    .getByRole("button", { name: "Quitar un Café", exact: true })
    .click();
  await expect(catalog.locator(".counter-qty output")).toHaveCount(0);
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
    page.getByRole("button", {
      name: /^Guardar (pedido|orden|cambios)$/,
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.locator(".counter-detailed-footer").getByText(/artículos|\$/),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Revisar pedido", exact: true }),
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

for (const scenario of [
  {
    name: "ranking parcial conserva los demás productos alfabéticamente",
    ranking: ["juice"],
    expected: ["Agregar Zumo", "Agregar Agua", "Agregar Café"],
  },
  {
    name: "ranking vacío conserva todo el catálogo alfabético",
    ranking: [],
    expected: ["Agregar Agua", "Agregar Café", "Agregar Zumo"],
  },
]) {
  test(`POS: ${scenario.name}`, async ({ page }) => {
    await setup(page);
    await page.route("**/api/pos/catalog**", (route) =>
      route.fulfill({
        json: {
          products: [
            { ...product, id: "juice", name: "Zumo" },
            product,
            { ...product, id: "water", name: "Agua" },
          ],
          categories: [],
          bestSellingProductIds: scenario.ranking,
        },
      }),
    );
    await page.goto(harness.url);
    await page.getByRole("button", { name: "Nueva orden" }).click();
    await page
      .getByRole("textbox", { name: "Nombre de mesa" })
      .fill("Mesa ranking");
    await page.getByRole("button", { name: /Local/ }).click();
    await page.getByRole("option", { name: "Centro" }).click();
    await page
      .getByRole("button", { name: "Tomar pedido", exact: true })
      .click();
    const cards = page.locator(".counter-detailed .counter-product-add");
    await expect(cards).toHaveCount(scenario.expected.length);
    for (const [index, name] of scenario.expected.entries()) {
      await expect(cards.nth(index)).toHaveAccessibleName(name);
      await expect(cards.nth(index)).toBeVisible();
    }
    await page
      .getByRole("button", { name: "Agregar Agua", exact: true })
      .click();
    await expect(
      page.locator(".counter-detailed .counter-qty output"),
    ).toHaveText("1");
  });
}

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
  await page.getByRole("radio", { name: "Productos", exact: true }).click();
  await page.getByRole("radio", { name: /^Pedido/ }).click();
  const detail = page.getByRole("region", { name: "Productos del pedido" });
  await expect(
    detail.getByText("$10,00 por unidad · Precio guardado"),
  ).toBeVisible();
  await expect(
    detail.getByText("$15,00 por unidad · Precio guardado"),
  ).toBeVisible();
  await expect(
    detail.getByText("Producto retirado", { exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Productos", exact: true }).click();
  await page
    .locator(".counter-detailed")
    .getByRole("button", { name: "Agregar un Café", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: /^Guardar (pedido|orden|cambios)$/,
      exact: true,
    })
    .click();
  await expect(page.getByRole("heading", { name: "Mesa 4" })).toBeVisible();
  expect(body).toMatchObject({
    items: [
      { lineId: "line-1", productId: "coffee", quantity: 1 },
      { lineId: "line-2", productId: "coffee", quantity: 2 },
      { lineId: "line-3", productId: null, quantity: 1 },
    ],
  });
});

function trackedReads(page: Page) {
  const reads: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      request.method() === "GET" &&
      (url.pathname === "/api/merchant/session" ||
        url.pathname.startsWith("/api/pos/"))
    )
      reads.push(url.pathname + url.search);
  });
  return reads;
}

test("caché POS: crear, editar, volver y abrir no repite GET ni por reloj/foco", async ({
  page,
}) => {
  await setup(page);
  const reads = trackedReads(page);
  let saved = baseOrder;
  let body: unknown;
  await page.route("**/api/pos/orders", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 201, json: saved })
      : route.fulfill({ json: { open: [], closedToday: [] } }),
  );
  await page.route("**/api/pos/orders/order-1", (route) => {
    if (route.request().method() === "PUT") {
      body = route.request().postDataJSON();
      saved = {
        ...saved,
        version: 2,
        items: [{ ...saved.items[0], quantity: 2, lineTotal: "20.00" }],
        total: "20.00",
      };
    }
    return route.fulfill({ json: saved });
  });
  await page.goto(harness.url);
  await page.getByRole("button", { name: "Nueva orden" }).click();
  await page.getByRole("textbox", { name: "Nombre de mesa" }).fill("Mesa 4");
  await page.getByRole("button", { name: /Local/ }).click();
  await page.getByRole("option", { name: "Centro" }).click();
  await page.getByRole("button", { name: "Tomar pedido", exact: true }).click();
  await page.getByRole("button", { name: "Agregar Café", exact: true }).click();
  await page
    .getByRole("button", { name: "Revisar pedido", exact: true })
    .click();
  await page
    .getByRole("button", { name: /^Guardar (pedido|orden|cambios)$/ })
    .click();
  await expect(
    page.getByRole("radio", { name: "Productos", exact: true }),
  ).toBeVisible();
  const firstReads = [...reads];
  expect(reads.filter((url) => url === "/api/pos/orders")).toHaveLength(1);
  expect(reads.filter((url) => url === "/api/pos/orders/order-1")).toHaveLength(
    0,
  );
  await page
    .getByRole("button", { name: "Volver al listado de órdenes" })
    .click();
  await page.getByRole("button", { name: "Abrir Mesa 4" }).click();
  await page.getByRole("radio", { name: "Productos", exact: true }).click();
  await page
    .getByRole("button", { name: "Agregar un Café", exact: true })
    .click();
  await page
    .getByRole("button", { name: /^Guardar (pedido|orden|cambios)$/ })
    .click();
  await expect(
    page.getByRole("radio", { name: "Productos", exact: true }),
  ).toBeVisible();
  expect(body).toMatchObject({
    version: 1,
    items: [{ lineId: "line-1", quantity: 2 }],
  });
  await page
    .getByRole("button", { name: "Volver al listado de órdenes" })
    .click();
  await expect(page.getByText("$20,00", { exact: true })).toBeVisible();
  await page.clock.install();
  await page.clock.fastForward(60 * 60 * 1000);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.getByRole("button", { name: "Abrir Mesa 4" }).click();
  await expect(page.getByRole("heading", { name: "Mesa 4" })).toBeVisible();
  expect(reads).toEqual(firstReads);
  await page.reload();
  await expect(page.getByRole("button", { name: "Nueva orden" })).toBeVisible();
  expect(reads.filter((url) => url === "/api/pos/orders")).toHaveLength(2);
});

test("caché POS: detalle se lee una vez; recargar obtiene la versión actual", async ({
  page,
}) => {
  await setup(page);
  const reads = trackedReads(page);
  await open(page);
  await expect(
    page.getByRole("radio", { name: "Productos", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Volver al listado de órdenes" })
    .click();
  await page.getByRole("button", { name: "Abrir Mesa 4" }).click();
  await expect(
    page.getByRole("radio", { name: "Productos", exact: true }),
  ).toBeVisible();
  expect(reads.filter((url) => url === "/api/pos/orders/order-1")).toHaveLength(
    1,
  );
  await page.route("**/api/pos/orders/order-1", (route) =>
    route.fulfill({
      json: { ...baseOrder, version: 2, tableLabel: "Mesa actual" },
    }),
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "Nueva orden" })).toBeVisible();
  await page.getByRole("button", { name: "Abrir Mesa 4" }).click();
  await expect(
    page.getByRole("heading", { name: "Mesa actual" }),
  ).toBeVisible();
  expect(reads.filter((url) => url === "/api/pos/orders/order-1")).toHaveLength(
    2,
  );
  expect(reads.filter((url) => url === "/api/pos/orders")).toHaveLength(2);
});

test("caché POS: catálogo por local reutilizado conserva el borrador", async ({
  page,
}) => {
  await setup(page);
  const reads = trackedReads(page);
  const price = 15;
  let body: unknown;
  await page.route("**/api/pos/catalog**", (route) =>
    route.fulfill({
      json: {
        products:
          new URL(route.request().url()).searchParams.get("locationId") ===
          "local-2"
            ? [
                {
                  ...product,
                  id: "north-water",
                  name: "Agua Norte",
                  unitPrice: 5,
                },
              ]
            : [{ ...product, unitPrice: price }],
        categories: [],
        bestSellingProductIds: [],
      },
    }),
  );
  await page.route("**/api/pos/orders/order-1", (route) => {
    if (route.request().method() === "PUT")
      body = route.request().postDataJSON();
    return route.fulfill({
      json: {
        ...baseOrder,
        version: route.request().method() === "PUT" ? 2 : 1,
      },
    });
  });
  await open(page);
  await page.getByRole("radio", { name: "Productos", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Agregar un Café", exact: true }),
  ).toBeVisible();
  await editContext(page);
  await page
    .getByRole("textbox", { name: "Nombre de mesa" })
    .fill("Mesa escrita");
  await page.getByRole("button", { name: /Local/ }).click();
  await page.getByRole("option", { name: "Norte" }).click();
  await page
    .getByRole("button", { name: "Cambiar local", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Agregar Agua Norte", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Agregar Café", exact: true }),
  ).toHaveCount(0);
  await editContext(page);
  await page.getByRole("button", { name: /Local/ }).click();
  await page.getByRole("option", { name: "Centro" }).click();
  await page
    .getByRole("button", { name: "Cambiar local", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Agregar un Café", exact: true }),
  ).toBeVisible();
  expect(
    reads.filter((url) => url === "/api/pos/catalog?locationId=local-1"),
  ).toHaveLength(1);
  expect(
    reads.filter((url) => url === "/api/pos/catalog?locationId=local-2"),
  ).toHaveLength(1);
  await editContext(page);
  await expect(
    page.getByRole("textbox", { name: "Nombre de mesa" }),
  ).toHaveValue("Mesa escrita");
  await page.getByRole("button", { name: "Listo", exact: true }).click();
  await expect(page.locator(".counter-product-add small")).toHaveText("$15,00");
  await page.getByRole("radio", { name: /^Pedido/ }).click();
  await expect(
    page.getByText("$10,00 por unidad · Precio guardado"),
  ).toBeVisible();
  expect(
    reads.filter((url) => url === "/api/pos/catalog?locationId=local-1"),
  ).toHaveLength(1);
  await page
    .getByRole("button", { name: /^Guardar (pedido|orden|cambios)$/ })
    .click();
  await expect(
    page.getByRole("radio", { name: "Productos", exact: true }),
  ).toBeVisible();
  expect(body).toMatchObject({
    version: 1,
    tableLabel: "Mesa escrita",
    items: [{ lineId: "line-1", quantity: 1 }],
  });
});

test("caché POS: una respuesta de A no desplaza la mesa B seleccionada", async ({
  page,
}) => {
  await setup(page);
  const other = { ...baseOrder, id: "order-2", tableLabel: "Mesa dos" };
  let release!: () => void;
  await page.route("**/api/pos/orders", (route) =>
    route.fulfill({
      json: {
        open: [baseOrder, other].map((order) => ({
          ...order,
          itemCount: 1,
          saleTotal: null,
        })),
        closedToday: [],
      },
    }),
  );
  await page.route("**/api/pos/orders/order-1", async (route) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fulfill({ json: baseOrder });
  });
  await page.route("**/api/pos/orders/order-2", (route) =>
    route.fulfill({ json: other }),
  );
  await page.goto(harness.url);
  await page.getByRole("button", { name: "Abrir Mesa 4" }).click();
  await expect.poll(() => typeof release).toBe("function");
  await page.getByRole("button", { name: "Abrir Mesa dos" }).click();
  await expect(page.getByRole("heading", { name: "Mesa dos" })).toBeVisible();
  const response = page.waitForResponse("**/api/pos/orders/order-1");
  release();
  await response;
  await expect(page.getByRole("heading", { name: "Mesa dos" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mesa 4" })).toHaveCount(0);
});

for (const status of [401, 403, 404, 503, "transport"] as const) {
  test(`caché POS: lectura ${status} ${status === 503 || status === "transport" ? "conserva copia" : "retira datos"}`, async ({
    page,
  }) => {
    await setup(page);
    await open(page);
    await expect(
      page.getByRole("radio", { name: "Productos", exact: true }),
    ).toBeVisible();
    await page.route("**/api/pos/orders/order-1", (route) =>
      status === "transport"
        ? route.abort()
        : route.fulfill({
            status,
            json: {
              error: "Error de lectura",
              code:
                status === 404
                  ? "unknown_pos_order"
                  : status === 403
                    ? "missing_permission"
                    : "unavailable",
            },
          }),
    );
    await annul(page);
    if (status === 503 || status === "transport") {
      await expect(
        page.getByText(
          "No pudimos actualizar los datos. Puedes consultar la última versión disponible.",
        ),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: "Mesa 4" })).toBeVisible();
    } else {
      await expect(page.getByRole("heading", { name: "Mesa 4" })).toHaveCount(
        0,
      );
      if (status === 404)
        await expect(
          page.getByRole("button", { name: "Abrir Mesa 4" }),
        ).toHaveCount(0);
      else
        await expect(
          page.getByRole("heading", { name: "POS no disponible" }),
        ).toBeVisible();
    }
  });
}

test("caché POS: lecturas concurrentes se deduplican y generaciones viejas se descartan", async () => {
  const cache = new PosCache();
  cache.bind("operator:business");
  let calls = 0;
  let release!: (order: PosOrder) => void;
  const request = () => {
    calls += 1;
    return new Promise<PosOrder>((resolve) => {
      release = resolve;
    });
  };
  const first = cache.read(detailKey(baseOrder.id), request);
  const second = cache.read(detailKey(baseOrder.id), request);
  expect(first).toBe(second);
  expect(calls).toBe(1);
  const discarded = expect(first).rejects.toBeInstanceOf(DiscardedPosRead);
  cache.beginWrite(baseOrder.id);
  cache.accept({ ...baseOrder, version: 2 });
  release(baseOrder);
  await discarded;
  expect(cache.peek<PosOrder>(detailKey(baseOrder.id))?.version).toBe(2);
  await expect(cache.order(baseOrder.id)).resolves.toMatchObject({
    version: 2,
  });
});

for (const action of ["close", "void"] as const) {
  test(`caché POS: ${action} retira abierta, reconcilia historial y reabre sin GET`, async ({
    page,
  }) => {
    await setup(page);
    const reads = trackedReads(page);
    let finished: PosOrder | null = null;
    await page.route("**/api/pos/orders", (route) =>
      route.fulfill({
        json: {
          open: finished
            ? []
            : [{ ...baseOrder, itemCount: 1, saleTotal: null }],
          closedToday: finished
            ? [{ ...finished, itemCount: 1, saleTotal: null }]
            : [],
        },
      }),
    );
    await page.route(`**/api/pos/orders/order-1/${action}`, (route) => {
      finished = {
        ...baseOrder,
        version: 2,
        status: action === "close" ? "closed" : "voided",
        closedAt: "2026-10-08T14:00:00Z",
        closedBy: "Ana",
      };
      return route.fulfill({ json: finished });
    });
    await open(page);
    if (action === "close") {
      await page.getByRole("button", { name: "Cobrar", exact: true }).click();
      await page
        .getByRole("button", { name: "Cerrar venta", exact: true })
        .click();
      await expect(page.getByText("Venta cerrada sin pase.")).toBeVisible();
    } else {
      await annul(page);
      await page
        .getByRole("button", { name: "Anular orden", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Mesa 4 · Anulada" }),
      ).toBeVisible();
    }
    await expect
      .poll(() => reads.filter((url) => url === "/api/pos/orders").length)
      .toBe(2);
    await page
      .getByRole("button", { name: "Volver al listado de órdenes" })
      .click();
    await expect(page.getByText("No hay órdenes abiertas.")).toBeVisible();
    const closedGroup = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Cerradas hoy", exact: true }),
    });
    await expect(
      closedGroup.getByRole("button", { name: "Abrir Mesa 4" }),
    ).toBeVisible();
    await closedGroup.getByRole("button", { name: "Abrir Mesa 4" }).click();
    await expect(
      page.getByRole("heading", {
        name:
          action === "close" ? "Mesa 4 · Venta cerrada" : "Mesa 4 · Anulada",
      }),
    ).toBeVisible();
    expect(
      reads.filter((url) => url === "/api/pos/orders/order-1"),
    ).toHaveLength(action === "close" ? 1 : 2);
  });
}

test("caché POS: anulación relee y exige revisar una orden que cambió", async ({
  page,
}) => {
  await setup(page);
  let calls = 0;
  let voided = false;
  await page.route("**/api/pos/orders/order-1", (route) => {
    calls += 1;
    return route.fulfill({
      json:
        calls === 1
          ? baseOrder
          : { ...baseOrder, version: 2, tableLabel: "Mesa cambiada" },
    });
  });
  await page.route("**/api/pos/orders/order-1/void", (route) => {
    voided = true;
    return route.fulfill({
      json: {
        ...baseOrder,
        version: 3,
        status: "voided",
        tableLabel: "Mesa cambiada",
      },
    });
  });
  await open(page);
  await annul(page);
  await expect(
    page.getByRole("heading", { name: "Mesa cambiada" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Anular orden", exact: true }),
  ).toHaveCount(0);
  expect(voided).toBe(false);
  await annul(page);
  await page.getByRole("button", { name: "Anular orden", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Mesa cambiada · Anulada" }),
  ).toBeVisible();
  expect(voided).toBe(true);
});

for (const context of ["signed-out", "revoked", "other-business"] as const) {
  test(`caché POS: ${context} descarta un borrador y la caché anterior`, async ({
    page,
  }) => {
    await setup(page);
    const reads = trackedReads(page);
    await open(page);
    await page.getByRole("radio", { name: "Productos", exact: true }).click();
    await editContext(page);
    await page
      .getByRole("textbox", { name: "Nombre de mesa" })
      .fill("Borrador privado");
    await page.route("**/api/merchant/session", (route) =>
      route.fulfill({
        json:
          context === "signed-out"
            ? { authenticated: false }
            : {
                authenticated: true,
                user: { id: "operator-1" },
                business: {
                  id:
                    context === "other-business" ? "business-2" : "business-1",
                  status: "active",
                  timezone: "UTC",
                  posEnabled: true,
                  currencyCode: "USD",
                },
                membership: {
                  role: "owner",
                  status: "active",
                  permissions: context === "revoked" ? [] : ["pos"],
                },
              },
      }),
    );
    page.once("dialog", (dialog) => dialog.accept());
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: "Nombre de mesa" }),
    ).toHaveCount(0);
    if (context !== "other-business")
      await expect(
        page.getByRole("heading", { name: "POS no disponible" }),
      ).toBeVisible();
    await setup(page);
    await page.reload();
    await page.getByRole("button", { name: "Abrir Mesa 4" }).click();
    await page.getByRole("radio", { name: "Productos", exact: true }).click();
    await editContext(page);
    await expect(
      page.getByRole("textbox", { name: "Nombre de mesa" }),
    ).toHaveValue("Mesa 4");
    expect(
      reads.filter((url) => url === "/api/pos/orders/order-1"),
    ).toHaveLength(2);
  });
}

test("caché POS: historial anterior no revierte escritura y cambio de contexto invalida respuestas", async () => {
  const cache = new PosCache();
  cache.bind("operator:business-1");
  cache.put(historyKey, {
    open: [{ ...baseOrder, itemCount: 1, saleTotal: null }],
    closedToday: [],
  });
  let release!: (value: unknown) => void;
  const previous = cache.read(
    historyKey,
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
    true,
  );
  const discarded = expect(previous).rejects.toBeInstanceOf(DiscardedPosRead);
  cache.beginWrite(baseOrder.id);
  cache.accept({ ...baseOrder, version: 2, tableLabel: "Mesa nueva" });
  release({ open: [baseOrder], closedToday: [] });
  await discarded;
  expect(
    cache.peek<{ open: { tableLabel: string }[] }>(historyKey, true)?.open[0]
      .tableLabel,
  ).toBe("Mesa nueva");
  const oldContext = cache.read(
    detailKey("order-2"),
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const oldDiscarded =
    expect(oldContext).rejects.toBeInstanceOf(DiscardedPosRead);
  cache.bind("operator:business-2");
  release(baseOrder);
  await oldDiscarded;
  expect(cache.peek(detailKey(baseOrder.id), true)).toBeNull();
  expect(cache.peek(detailKey("order-2"), true)).toBeNull();
});

test("caché POS: conflicto sin snapshot bloquea acciones hasta releer la versión actual", async ({
  page,
}) => {
  await setup(page);
  let reads = 0;
  let release!: () => void;
  await page.route("**/api/pos/orders/order-1", async (route) => {
    if (route.request().method() === "PUT")
      return route.fulfill({
        status: 409,
        json: { code: "version_conflict", error: "Conflicto" },
      });
    reads += 1;
    if (reads > 1)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    await route.fulfill({
      json:
        reads === 1
          ? baseOrder
          : { ...baseOrder, version: 4, tableLabel: "Mesa actual" },
    });
  });
  await open(page);
  await page.getByRole("radio", { name: "Productos", exact: true }).click();
  await page
    .getByRole("button", { name: "Agregar un Café", exact: true })
    .click();
  await page
    .getByRole("button", { name: /^Guardar (pedido|orden|cambios)$/ })
    .click();
  await expect.poll(() => typeof release).toBe("function");
  await expect(
    page.getByRole("radio", { name: "Productos", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Guardar cambios", exact: true }),
  ).toBeDisabled();
  release();
  await page.getByRole("button", { name: "Revisar versión actual" }).click();
  await page.getByRole("button", { name: "Usar versión actual" }).click();
  await expect(
    page.getByRole("heading", { name: "Mesa actual", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "Productos", exact: true }),
  ).toBeEnabled();
  expect(reads).toBe(2);
});

test("POS ofrece X para volver al inicio y no muestra actualización manual", async ({
  page,
}) => {
  await setup(page);
  await page.goto(harness.url);
  const close = page.getByRole("link", { name: "Cerrar POS", exact: true });
  await expect(close).toBeVisible();
  await expect(close).toHaveAttribute("href", "/backoffice");
  await expect(
    page.getByRole("button", { name: "Actualizar órdenes" }),
  ).toHaveCount(0);
  await close.click();
  await expect(page).toHaveURL(new URL("/backoffice", harness.url).href);
});

test("órdenes abiertas: filas compactas con mesa, total y Abrir", async ({
  page,
}) => {
  await setup(page);
  const orders = [
    baseOrder,
    { ...baseOrder, id: "order-2", tableLabel: "Terraza", total: "25.00" },
    {
      ...baseOrder,
      id: "order-3",
      tableLabel: "Mesa junto a la ventana del salón principal",
      total: "35.00",
    },
  ];
  await page.route("**/api/pos/orders", (route) =>
    route.fulfill({
      json: {
        open: orders.map((order) => ({
          ...order,
          itemCount: 1,
          saleTotal: null,
        })),
        closedToday: [],
      },
    }),
  );
  await page.route("**/api/pos/orders/order-2", (route) =>
    route.fulfill({ json: orders[1] }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(harness.url);
  const section = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Abiertas", exact: true }),
  });
  await expect(section.getByRole("heading", { level: 3 })).toHaveText(
    orders.map((order) => order.tableLabel),
  );
  await expect(section.getByRole("button")).toHaveText([
    "Abrir",
    "Abrir",
    "Abrir",
  ]);
  await expect(section.getByText("$25,00", { exact: true })).toBeVisible();
  await expect(
    section.getByText(/productos|Sin local|Centro|Abierta$/),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await section
    .getByRole("button", { name: "Abrir Terraza", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Terraza" })).toBeVisible();
});

test("orden abierta ocupa el ancho y X vuelve al listado con caché", async ({
  page,
}) => {
  await setup(page);
  const reads = trackedReads(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const ticket = page.getByRole("region", { name: "Ticket de la orden" });
  await expect(ticket).toBeHidden();
  await expect(
    page.getByRole("region", { name: "Productos del pedido" }),
  ).toBeVisible();
  await expect(page.locator(".backoffice-mobile-nav")).toBeHidden();
  const main = await page.locator("main").boundingBox();
  expect(main!.width).toBe(390);
  const closeIcon = await page
    .getByRole("button", { name: "Volver al listado de órdenes", exact: true })
    .locator("svg")
    .boundingBox();
  expect(closeIcon!.width).toBe(24);
  const closeButton = page.getByRole("button", {
    name: "Volver al listado de órdenes",
    exact: true,
  });
  const closeBox = await closeButton.boundingBox();
  expect(closeBox!.width).toBe(44);
  expect(closeBox!.height).toBe(44);
  const headerBackground = await closeButton.evaluate(
    (el) => getComputedStyle(el.parentElement!).backgroundColor,
  );
  expect(headerBackground).toBe("rgba(0, 0, 0, 0)");
  await expect(
    page.getByRole("button", { name: "Volver al historial" }),
  ).toHaveCount(0);

  await page.screenshot({ path: "/private/tmp/pos-0176-mobile.png" });
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.screenshot({ path: "/private/tmp/pos-0176-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  const firstReads = [...reads];
  await page
    .getByRole("button", { name: "Volver al listado de órdenes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Abiertas", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".backoffice-mobile-nav")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Cerrar POS", exact: true }),
  ).toHaveAttribute("href", "/backoffice");
  await page.screenshot({ path: "/private/tmp/pos-0175-mobile.png" });
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.screenshot({ path: "/private/tmp/pos-0175-desktop.png" });
  await page.getByRole("button", { name: "Abrir Mesa 4", exact: true }).click();
  await page.getByRole("radio", { name: "Productos", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Agregar un Café", exact: true }),
  ).toBeVisible();
  const afterCatalog = [...reads];
  await page
    .getByRole("button", { name: "Volver al listado de órdenes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Abiertas", exact: true }),
  ).toBeVisible();
  expect(reads).toEqual(afterCatalog);
  expect(
    reads.filter((url) => url !== "/api/pos/catalog?locationId=local-1"),
  ).toEqual(firstReads);
});

test("orden abierta prioriza mesa y acciones; conserva ticket impreso", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(
    page.getByRole("heading", { name: "Mesa 4", level: 1, exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("main").getByRole("heading", { name: "POS", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .locator("main")
      .getByRole("heading", { name: "Café de prueba", exact: true }),
  ).toHaveCount(0);
  const edit = page.getByRole("button", {
    name: "Añadir productos",
    exact: true,
  });
  const pay = page.getByRole("button", { name: "Cobrar", exact: true });
  await expect(pay).toHaveClass(/bg-primary /);
  await expect(edit).toHaveClass(/bg-surface/);
  await expect(
    page.getByRole("button", { name: "Anular", exact: true }),
  ).toHaveCount(0);
  const editBox = (await edit.boundingBox())!;
  const payBox = (await pay.boundingBox())!;
  expect(editBox.width).toBe(payBox.width);
  expect(editBox.height).toBeGreaterThanOrEqual(48);
  expect(payBox.y).toBe(editBox.y);
  const total = page.getByText("Total: $10,00", { exact: true });
  const totalBox = (await total.boundingBox())!;
  expect(totalBox.y + totalBox.height).toBeLessThan(editBox.y);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "/private/tmp/pos-0177-mobile.png" });
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.screenshot({ path: "/private/tmp/pos-0177-desktop.png" });
  await page.emulateMedia({ media: "print" });
  const ticket = page.getByRole("region", { name: "Ticket de la orden" });
  await expect(
    ticket.getByRole("heading", { name: "Café de prueba", exact: true }),
  ).toBeVisible();
  await expect(
    ticket.getByRole("heading", { name: "Mesa 4 · Precuenta", exact: true }),
  ).toBeVisible();
  await expect(ticket.getByText("Centro", { exact: true })).toBeVisible();
});

test("wizard POS: tres pasos, revisión sin importes, añadir, quitar/deshacer y guardar con precio cero", async ({
  page,
}) => {
  await setup(page);
  const reads = trackedReads(page);
  await page.route("**/api/pos/catalog**", (route) =>
    route.fulfill({
      json: {
        products: [
          product,
          { ...product, id: "zero", name: "Agua de cortesía", unitPrice: 0 },
        ],
        categories: [],
        bestSellingProductIds: [],
      },
    }),
  );
  const writes: unknown[] = [];
  await page.route("**/api/pos/orders", (route) => {
    if (route.request().method() !== "POST")
      return route.fulfill({ json: { open: [], closedToday: [] } });
    const body = route.request().postDataJSON();
    writes.push(body);
    return route.fulfill({
      status: 201,
      json: {
        ...baseOrder,
        tableLabel: body.tableLabel,
        items: body.items.map(
          (item: { productId: string; quantity: number }, index: number) => ({
            lineId: `saved-${index}`,
            productId: item.productId,
            name: item.productId === "zero" ? "Agua de cortesía" : "Café",
            quantity: item.quantity,
            unitPrice: item.productId === "zero" ? "0.00" : "15.00",
            lineTotal:
              item.productId === "zero"
                ? "0.00"
                : (item.quantity * 15).toFixed(2),
          }),
        ),
        total: "90.00",
      },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(harness.url);
  await page.getByRole("button", { name: "Nueva orden", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Mesa sin nombre", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tomar pedido", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Nombre de mesa" })
    .fill("Mesa wizard");
  await page.getByRole("button", { name: /Local/ }).click();
  await page.getByRole("option", { name: "Centro" }).click();
  await expect(
    page.getByRole("button", { name: "Tomar pedido", exact: true }),
  ).toBeEnabled();
  expect(
    reads.filter((url) => url === "/api/pos/catalog?locationId=local-1"),
  ).toHaveLength(1);
  const beforeTaking = [...reads];
  await page.getByRole("button", { name: "Tomar pedido", exact: true }).click();
  expect(reads).toEqual(beforeTaking);
  await expect(
    page.getByText("Cargando catálogo…", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Mesa wizard", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Catálogo", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("button", { name: "Volver a mesa", exact: true })
      .locator("svg"),
  ).toBeVisible();

  await expect(
    page.getByRole("textbox", { name: "Nombre de mesa" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Agregar Café", exact: true }).click();
  for (let index = 0; index < 4; index++)
    await page
      .getByRole("button", { name: "Agregar un Café", exact: true })
      .click();
  await page
    .getByRole("button", { name: "Revisar pedido", exact: true })
    .click();
  const lines = page.getByRole("region", { name: "Productos del pedido" });
  await expect(lines.getByText("5", { exact: true })).toBeVisible();
  await expect(page.locator("main").getByText(/\$/)).toHaveCount(0);
  await expect(page.getByRole("spinbutton")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Quitar producto Café", exact: true })
    .click();
  await expect(lines.getByText("Café", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(lines.getByText("5", { exact: true })).toBeVisible();
  const search = page.getByRole("searchbox", {
    name: "Buscar producto para añadir",
  });
  await search.fill("café");
  await page.getByRole("button", { name: "Agregar Café", exact: true }).click();
  await expect(search).toHaveValue("");
  await expect(lines.getByText("6", { exact: true })).toBeVisible();
  await search.fill("agua");
  await page
    .getByRole("button", { name: "Agregar Agua de cortesía", exact: true })
    .click();
  await expect(
    lines.getByText("Agua de cortesía", { exact: true }),
  ).toBeVisible();
  const firstReads = [...reads];
  await page
    .getByRole("button", { name: "Volver a tomar pedido", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Volver a mesa", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Nombre de mesa" }),
  ).toHaveValue("Mesa wizard");
  await page.getByRole("button", { name: "Tomar pedido", exact: true }).click();
  await page
    .getByRole("button", { name: "Revisar pedido", exact: true })
    .click();
  expect(reads).toEqual(firstReads);
  expect(writes).toHaveLength(0);
  await page
    .getByRole("button", { name: "Guardar pedido", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mesa wizard", exact: true }),
  ).toBeVisible();
  expect(writes).toEqual([
    {
      tableLabel: "Mesa wizard",
      locationId: "local-1",
      items: [
        { productId: "coffee", quantity: 6 },
        { productId: "zero", quantity: 1 },
      ],
    },
  ]);
});
