import { expect, test, type Page } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
import {
  detailKey,
  historyKey,
  DiscardedPosRead,
  PosCache,
} from "../../apps/merchant/src/app/backoffice/pos/pos-cache";
import type {
  ResolveResponse,
  CounterCouponState,
} from "../../apps/merchant/src/app/backoffice/counter/types";
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
  id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
  name: "Café",
  unitPrice: 15,
  categoryId: null,
  imagePath: null,
};
const baseOrder: PosOrder = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  tableLabel: "Mesa 4",
  status: "open",
  version: 1,
  location: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1", name: "Centro" },
  business: { name: "Café de prueba", currencyCode: "USD" },
  items: [
    {
      lineId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
      productId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
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
const coupon: CounterCouponState = {
  status: "selected",
  verdict: { valid: true },
  coupon: {
    couponId: "77777777-7777-4777-8777-777777777777",
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
const resolved: ResolveResponse = {
  consumer: { displayName: "Cliente de prueba" },
  membership: {
    id: "99999999-9999-4999-8999-999999999999",
    pointsBalance: 10,
    stampsCount: 0,
    justEnrolled: false,
  },
  program: {
    id: "c99fb0bf-6542-400a-abf0-3308925a6862",
    kind: "points",
    redeemAllowInsufficient: false,
    accrual: { mode: "per_amount", grant: 1, blockAmount: 3 },
    cardDesign: {
      backgroundColor: null,
      backgroundColor2: null,
      gradientAngle: null,
      borderColor: null,
    },
  },
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
  await page.route(
    "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    (route) => route.fulfill({ json: baseOrder }),
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
async function fillTable(page: Page, name: string) {
  await page.getByRole("textbox", { name: "Nombre de mesa" }).fill(name);
  const done = page.getByRole("button", { name: "Listo", exact: true });
  if (await done.isVisible()) await done.click();
}
async function editContext(page: Page) {
  await page.getByRole("button", { name: /^Cambiar mesa:/ }).click();
}
async function scan(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { posCameraToken: string | null }).posCameraToken =
      null;
  });
  await page.getByRole("button", { name: "QR", exact: true }).click();
  await page.evaluate(() => {
    (window as unknown as { posCameraToken: string | null }).posCameraToken =
      "qa-token";
  });
  await expect(
    page.getByRole("dialog", { name: "Escanear pase", exact: true }),
  ).toBeHidden();
  await page.evaluate(() => {
    (window as unknown as { posCameraToken: string | null }).posCameraToken =
      null;
  });
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
  await page.route(
    "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    (route) => {
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
    },
  );
  const closeBodies: unknown[] = [];
  await page.route(
    "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/close",
    (route) => {
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
    },
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(harness.url);
  await expect(page.getByRole("link", { name: "Abrir mostrador" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Nueva orden" }).click();
  await fillTable(page, "Mesa 4");
  await expect(
    page.getByRole("radio", { name: "Editar", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Guardar orden", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Tomar pedido", exact: true }),
  ).toBeEnabled();
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
    locationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    items: [{ productId: "custom", quantity: 1 }],
  });
  await page.getByRole("radio", { name: "Editar", exact: true }).click();
  await page.getByRole("radio", { name: /^Pedido/ }).click();
  await expect(
    page
      .getByRole("region", { name: "Productos del pedido" })
      .getByText("$10,00 por unidad"),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Editar", exact: true }).click();
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
    locationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    items: [
      {
        lineId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
        productId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
        quantity: 2,
      },
    ],
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
  await page
    .getByRole("button", { name: "Confirmar cobro", exact: true })
    .click();
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
  await page.route(
    "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    (route) =>
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
  await page.route(
    "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/void",
    (route) => {
      voided = true;
      return route.fulfill({
        json: {
          ...baseOrder,
          version: 5,
          tableLabel: "Mesa actual",
          status: "voided",
        },
      });
    },
  );
  await open(page);
  await page.getByRole("radio", { name: "Editar", exact: true }).click();
  await page
    .getByRole("button", { name: "Agregar un Café", exact: true })
    .click();
  await page
    .getByRole("button", { name: /^Guardar (pedido|orden|cambios)$/ })
    .click();
  await expect(
    page.getByRole("heading", { name: /^(?:Cambiar mesa: )?Mesa 4$/ }),
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
    page.getByRole("heading", { name: /^(?:Cambiar mesa: )?Mesa actual$/ }),
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
      locationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    });
    return route.fulfill({ json: resolved });
  });
  await page.route("**/api/pos/coupon-state**", (route) =>
    route.fulfill({ json: { couponState: coupon } }),
  );
  const bodies: unknown[] = [];
  await page.route(
    "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/close",
    (route) => {
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
    },
  );
  await open(page);
  await scan(page);
  await expect(
    page.getByRole("heading", { name: "Cupón válido", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirmar cobro", exact: true })
    .click();
  await page.getByRole("button", { name: "Reintentar cobro" }).click();
  await page.getByRole("button", { name: "Reintentar cobro" }).click();
  await expect(page.getByText("+3 puntos acreditados")).toBeVisible();
  await expect(page.getByText("Saldo: 13 puntos")).toBeVisible();
  await expect(page.getByText("Total: $9,00")).toBeVisible();
  expect(bodies).toHaveLength(3);
  expect(bodies[1]).toEqual(bodies[0]);
  expect(bodies[2]).toEqual(bodies[0]);
  expect(bodies[0]).toMatchObject({
    membershipId: "99999999-9999-4999-8999-999999999999",
    coupon: { couponId: "77777777-7777-4777-8777-777777777777" },
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
  await page.route(
    "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/close",
    (route) =>
      route.fulfill({
        status: 409,
        json: { error: "El cupón venció.", code: "coupon_expired" },
      }),
  );
  await open(page);
  await scan(page);
  await expect(
    page.getByRole("heading", { name: "Cupón no válido" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Quitar beneficio", exact: true })
    .click();
  expect(removed).toBeUndefined();
  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirmar cobro", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Confirmar cobro", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Cobrar Mesa 4", exact: true }),
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
        bestSellingProductIds: [
          "juice",
          "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
        ],
      },
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(harness.url);
  await page.getByRole("button", { name: "Nueva orden" }).click();
  await fillTable(page, "Mesa prueba");
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
  await page.getByRole("textbox", { name: "Buscar producto" }).fill("zumo");
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
    await fillTable(page, "Mesa ranking");
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
  await page.route(
    "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    (route) => {
      if (route.request().method() === "PUT")
        body = route.request().postDataJSON();
      return route.fulfill({ json: { ...baseOrder, items, total: "32.00" } });
    },
  );
  await open(page);
  await page.getByRole("radio", { name: "Editar", exact: true }).click();
  await page.getByRole("radio", { name: /^Pedido/ }).click();
  const detail = page.getByRole("region", { name: "Productos del pedido" });
  await expect(detail.getByText("$10,00 por unidad")).toBeVisible();
  await expect(detail.getByText("$15,00 por unidad")).toBeVisible();
  await expect(
    detail.getByText("Producto retirado", { exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Editar", exact: true }).click();
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
      {
        lineId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
        productId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
        quantity: 1,
      },
      {
        lineId: "line-2",
        productId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
        quantity: 2,
      },
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
  await page.route(
    "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    (route) => {
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
    },
  );
  await page.goto(harness.url);
  await page.getByRole("button", { name: "Nueva orden" }).click();
  await fillTable(page, "Mesa 4");
  await page.getByRole("button", { name: "Tomar pedido", exact: true }).click();
  await page.getByRole("button", { name: "Agregar Café", exact: true }).click();
  await page
    .getByRole("button", { name: "Revisar pedido", exact: true })
    .click();
  await page
    .getByRole("button", { name: /^Guardar (pedido|orden|cambios)$/ })
    .click();
  await expect(
    page.getByRole("radio", { name: "Editar", exact: true }),
  ).toBeVisible();
  const firstReads = [...reads];
  expect(reads.filter((url) => url === "/api/pos/orders")).toHaveLength(1);
  expect(
    reads.filter(
      (url) => url === "/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    ),
  ).toHaveLength(0);
  await page
    .getByRole("button", { name: "Volver al listado de órdenes" })
    .click();
  await page.getByRole("button", { name: "Abrir Mesa 4" }).click();
  await page.getByRole("radio", { name: "Editar", exact: true }).click();
  await page
    .getByRole("button", { name: "Agregar un Café", exact: true })
    .click();
  await page
    .getByRole("button", { name: /^Guardar (pedido|orden|cambios)$/ })
    .click();
  await expect(
    page.getByRole("radio", { name: "Editar", exact: true }),
  ).toBeVisible();
  expect(body).toMatchObject({
    version: 1,
    items: [{ lineId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1", quantity: 2 }],
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
    page.getByRole("radio", { name: "Editar", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Volver al listado de órdenes" })
    .click();
  await page.getByRole("button", { name: "Abrir Mesa 4" }).click();
  await expect(
    page.getByRole("radio", { name: "Editar", exact: true }),
  ).toBeVisible();
  expect(
    reads.filter(
      (url) => url === "/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    ),
  ).toHaveLength(1);
  await page.route(
    "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    (route) =>
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
  expect(
    reads.filter(
      (url) => url === "/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    ),
  ).toHaveLength(2);
  expect(reads.filter((url) => url === "/api/pos/orders")).toHaveLength(2);
});

test("caché POS: catálogo por local reutilizado conserva el borrador", async ({
  page,
}) => {
  await setup(page);
  const reads = trackedReads(page);
  await page.route("**/api/pos/catalog**", (route) =>
    route.fulfill({
      json: {
        products:
          new URL(route.request().url()).searchParams.get("locationId") ===
          "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2"
            ? [
                {
                  ...product,
                  id: "north-water",
                  name: "Agua Norte",
                  unitPrice: 5,
                },
              ]
            : [product],
        categories: [],
        bestSellingProductIds: [],
      },
    }),
  );
  await open(page);
  await page.getByRole("radio", { name: "Editar", exact: true }).click();
  await editContext(page);
  await fillTable(page, "Mesa escrita");
  await page.getByRole("radio", { name: /^Pedido/ }).click();
  await page.getByRole("radio", { name: "Editar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /^(?:Cambiar mesa: )?Mesa escrita$/ }),
  ).toBeVisible();
  await page.getByRole("radio", { name: /^Pedido/ }).click();
  await expect(
    page
      .getByRole("region", { name: "Productos del pedido" })
      .getByText("$10,00 por unidad"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Volver al listado de órdenes", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Descartar cambios", exact: true })
    .click();
  for (const [local, productName] of [
    ["Norte", "Agua Norte"],
    ["Centro", "Café"],
    ["Norte", "Agua Norte"],
  ]) {
    await page.getByRole("button", { name: /Seleccionar local:/ }).click();
    await page
      .getByRole("dialog", { name: "Seleccionar local", exact: true })
      .getByRole("button")
      .click();
    await page.getByRole("option", { name: local, exact: true }).click();
    await page
      .getByRole("button", { name: "Nueva orden", exact: true })
      .click();
    await fillTable(page, `Mesa ${local}`);
    await page
      .getByRole("button", { name: "Tomar pedido", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: `Agregar ${productName}`, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: `Agregar ${local === "Norte" ? "Café" : "Agua Norte"}`,
        exact: true,
      }),
    ).toHaveCount(0);
    await page
      .getByRole("button", {
        name: "Volver al listado de órdenes",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Descartar cambios", exact: true })
      .click();
  }
  expect(
    reads.filter(
      (url) =>
        url ===
        "/api/pos/catalog?locationId=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    ),
  ).toHaveLength(1);
  expect(
    reads.filter(
      (url) =>
        url ===
        "/api/pos/catalog?locationId=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
    ),
  ).toHaveLength(1);
});

test("caché POS: una respuesta de A no desplaza la mesa B seleccionada", async ({
  page,
}) => {
  await setup(page);
  const other = {
    ...baseOrder,
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    tableLabel: "Mesa dos",
  };
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
  await page.route(
    "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    async (route) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      await route.fulfill({ json: baseOrder });
    },
  );
  await page.route(
    "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    (route) => route.fulfill({ json: other }),
  );
  await page.goto(harness.url);
  await page.getByRole("button", { name: "Abrir Mesa 4" }).click();
  await expect.poll(() => typeof release).toBe("function");
  await page.getByRole("button", { name: "Abrir Mesa dos" }).click();
  await expect(page.getByRole("heading", { name: "Mesa dos" })).toBeVisible();
  const response = page.waitForResponse(
    "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  );
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
      page.getByRole("radio", { name: "Editar", exact: true }),
    ).toBeVisible();
    await page.route(
      "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      (route) =>
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
    await page.route(
      `**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/${action}`,
      (route) => {
        finished = {
          ...baseOrder,
          version: 2,
          status: action === "close" ? "closed" : "voided",
          closedAt: "2026-10-08T14:00:00Z",
          closedBy: "Ana",
        };
        return route.fulfill({ json: finished });
      },
    );
    await open(page);
    if (action === "close") {
      await page.getByRole("button", { name: "Cobrar", exact: true }).click();
      await page
        .getByRole("button", { name: "Confirmar cobro", exact: true })
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
      reads.filter(
        (url) => url === "/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      ),
    ).toHaveLength(action === "close" ? 1 : 2);
  });
}

test("caché POS: anulación relee y exige revisar una orden que cambió", async ({
  page,
}) => {
  await setup(page);
  let calls = 0;
  let voided = false;
  await page.route(
    "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    (route) => {
      calls += 1;
      return route.fulfill({
        json:
          calls === 1
            ? baseOrder
            : { ...baseOrder, version: 2, tableLabel: "Mesa cambiada" },
      });
    },
  );
  await page.route(
    "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/void",
    (route) => {
      voided = true;
      return route.fulfill({
        json: {
          ...baseOrder,
          version: 3,
          status: "voided",
          tableLabel: "Mesa cambiada",
        },
      });
    },
  );
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
    await page.getByRole("radio", { name: "Editar", exact: true }).click();
    await editContext(page);
    await fillTable(page, "Borrador privado");
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
    await page.getByRole("radio", { name: "Editar", exact: true }).click();
    await editContext(page);
    await expect(
      page.getByRole("textbox", { name: "Nombre de mesa" }),
    ).toHaveValue("Mesa 4");
    expect(
      reads.filter(
        (url) => url === "/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      ),
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
    detailKey("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"),
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
  expect(
    cache.peek(detailKey("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"), true),
  ).toBeNull();
});

test("caché POS: conflicto sin snapshot bloquea acciones hasta releer la versión actual", async ({
  page,
}) => {
  await setup(page);
  let reads = 0;
  let release!: () => void;
  await page.route(
    "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    async (route) => {
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
    },
  );
  await open(page);
  await page.getByRole("radio", { name: "Editar", exact: true }).click();
  await page
    .getByRole("button", { name: "Agregar un Café", exact: true })
    .click();
  await page
    .getByRole("button", { name: /^Guardar (pedido|orden|cambios)$/ })
    .click();
  await expect.poll(() => typeof release).toBe("function");
  await expect(
    page.getByRole("radio", { name: "Editar", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Guardar cambios", exact: true }),
  ).toBeDisabled();
  release();
  await page.getByRole("button", { name: "Revisar versión actual" }).click();
  await page.getByRole("button", { name: "Usar versión actual" }).click();
  await expect(
    page.getByRole("heading", { name: /^(?:Cambiar mesa: )?Mesa actual$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "Editar", exact: true }),
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
    {
      ...baseOrder,
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
      tableLabel: "Terraza",
      total: "25.00",
    },
    {
      ...baseOrder,
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
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
  await page.route(
    "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    (route) => route.fulfill({ json: orders[1] }),
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
  await page.getByRole("radio", { name: "Editar", exact: true }).click();
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
    reads.filter(
      (url) =>
        url !==
        "/api/pos/catalog?locationId=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    ),
  ).toEqual(firstReads);
});

test("orden abierta prioriza mesa y acciones; conserva ticket impreso", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(
    page.getByRole("heading", {
      name: /^(?:Cambiar mesa: )?Mesa 4$/,
      level: 1,
    }),
  ).toBeVisible();
  await expect(
    page.locator("main").getByRole("heading", { name: "POS", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .locator("main")
      .getByRole("heading", { name: "Café de prueba", exact: true }),
  ).toHaveCount(0);
  const edit = page.getByRole("radio", { name: "Editar", exact: true });
  const pay = page.getByRole("button", { name: "Cobrar", exact: true });
  await expect(pay).toHaveClass(/bg-primary /);
  await expect(edit).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Anular", exact: true }),
  ).toHaveCount(0);
  const editBox = (await edit.boundingBox())!;
  const payBox = (await pay.boundingBox())!;
  expect(editBox.width).toBeGreaterThan(0);
  expect(payBox.height).toBeGreaterThanOrEqual(48);
  expect(editBox.height).toBe(40);
  expect(payBox.y).toBeGreaterThan(editBox.y);
  const total = page
    .locator(".counter-detailed-footer")
    .getByText("$10,00", { exact: true });
  const totalBox = (await total.boundingBox())!;
  expect(totalBox.y + totalBox.height).toBeLessThan(payBox.y);
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
  await fillTable(page, "Mesa wizard");
  await expect(
    page.getByRole("button", { name: "Tomar pedido", exact: true }),
  ).toBeEnabled();
  expect(
    reads.filter(
      (url) =>
        url ===
        "/api/pos/catalog?locationId=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    ),
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
  const search = page.getByRole("textbox", {
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
      locationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
      items: [
        { productId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1", quantity: 6 },
        { productId: "zero", quantity: 1 },
      ],
    },
  ]);
});

test("0183 Dialog móvil: contenido largo y acciones alcanzables con teclado", async ({
  page,
}) => {
  await setup(page);
  const long = {
    ...coupon,
    status: "selected",
    verdict: {
      valid: false,
      code: "coupon_expired",
      message:
        "El cupón venció. Revisa la vigencia del beneficio antes de cobrar. ".repeat(
          6,
        ),
    },
  } as CounterCouponState;
  await page.route("**/api/pos/resolve", (route) =>
    route.fulfill({ json: { ...resolved, couponState: long } }),
  );
  await page.route("**/api/pos/coupon-state**", (route) =>
    route.fulfill({ json: { couponState: long } }),
  );
  await page.setViewportSize({ width: 320, height: 400 });
  await open(page);
  await scan(page);
  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Cobrar Mesa 4" });
  await expect(dialog).toBeVisible();
  await page.screenshot({
    path: "/private/tmp/0183-dialog-320-keyboard.png",
    animations: "disabled",
  });
  const geometry = await dialog.evaluate((element) => ({
    top: element.getBoundingClientRect().top,
    bottom: element.getBoundingClientRect().bottom,
    height: element.getBoundingClientRect().height,
    viewport: innerHeight,
    scroll: element.scrollHeight,
    client: element.clientHeight,
  }));
  console.log("0183 Dialog geometry", JSON.stringify(geometry));
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).focus();
  await expect(
    dialog.getByRole("button", { name: "Cancelar", exact: true }),
  ).toBeInViewport();
});

async function customerRoutes(
  page: Page,
  state: CounterCouponState = coupon,
  program = resolved.program,
) {
  await page.route("**/api/pos/resolve", (route) =>
    route.fulfill({ json: { ...resolved, program, couponState: state } }),
  );
  await page.route("**/api/pos/coupon-state**", (route) =>
    route.fulfill({ json: { couponState: state } }),
  );
}
async function scanAndPay(page: Page) {
  await scan(page);
  await expect(
    page.getByText("Cliente de prueba", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Cobrar Mesa 4" }),
  ).toBeVisible();
}

test("0183 cancelar/reabrir conserva cliente beneficio y cambio; confirmar doble cierra una sola vez", async ({
  page,
}) => {
  const counterCalls = await setup(page);
  await customerRoutes(page);
  let closes = 0,
    removes = 0;
  const bodies: unknown[] = [];
  let release!: () => void;
  await page.route("**/api/pos/coupon-remove", (route) => {
    removes++;
    return route.abort();
  });
  await page.route(
    "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/close",
    async (route) => {
      closes++;
      bodies.push(route.request().postDataJSON());
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      await route.fulfill({
        json: {
          ...baseOrder,
          status: "closed",
          version: 2,
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
    },
  );
  await open(page);
  await scanAndPay(page);
  let dialog = page.getByRole("dialog", { name: "Cobrar Mesa 4" });
  await dialog.getByRole("textbox", { name: "Recibido" }).fill("20");
  await dialog.getByRole("textbox", { name: "Recibido" }).press("Tab");
  await expect(dialog.getByText("Cambio: $11,00")).toBeVisible();
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(closes).toBe(0);
  expect(removes).toBe(0);
  expect(counterCalls).toEqual([]);
  await expect(
    page.getByRole("button", { name: "Cobrar", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Cobrar Mesa 4" });
  await expect(dialog.getByText("Cambio: $11,00")).toBeVisible();
  await dialog
    .getByRole("button", { name: "Confirmar cobro", exact: true })
    .dblclick();
  await expect.poll(() => closes).toBe(1);
  await expect(
    dialog.getByRole("button", { name: "Cancelar", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  release();
  await expect(page.getByText("+3 puntos acreditados")).toBeVisible();
  expect(bodies).toHaveLength(1);
});

for (const state of [
  { status: "none" },
  { status: "hint", count: 2 },
  { status: "used_today", label: "Bienvenida" },
] as CounterCouponState[]) {
  test(`0183 cliente ${state.status} acredita base y no envía cupón`, async ({
    page,
  }) => {
    await setup(page);
    await customerRoutes(page, state);
    let body: Record<string, unknown> | null = null;
    await page.route(
      "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/close",
      (route) => {
        body = route.request().postDataJSON();
        return route.fulfill({
          json: {
            ...baseOrder,
            status: "closed",
            sale: {
              consumer: "Cliente de prueba",
              total: "10.00",
              grossTotal: "10.00",
              unitsGranted: 3,
              balanceAfter: 13,
              kind: "points",
              coupon: null,
            },
          },
        });
      },
    );
    await open(page);
    await scanAndPay(page);
    const dialog = page.getByRole("dialog", { name: "Cobrar Mesa 4" });
    await expect(dialog.getByText("1 punto por cada $3,00")).toBeVisible();
    await expect(dialog.getByText("Se acreditarán: 3 puntos")).toBeVisible();
    await dialog
      .getByRole("button", { name: "Confirmar cobro", exact: true })
      .click();
    await expect(page.getByText("+3 puntos acreditados")).toBeVisible();
    expect(body).toMatchObject({ membershipId: resolved.membership.id });
    expect(body).not.toHaveProperty("coupon");
  });
}

for (const benefit of [
  {
    name: "amount",
    patch: {
      kind: "discount",
      discountUnit: "amount",
      discountValue: "2.00",
      currencyCode: "USD",
    },
    net: "$8,00",
  },
  {
    name: "free fixed",
    patch: { kind: "free_product", productId: product.id },
    net: "$0,00",
  },
  {
    name: "free selected",
    patch: { kind: "free_product", productId: null },
    net: "$0,00",
    select: true,
  },
  {
    name: "2x1 fixed",
    patch: { kind: "two_for_one", productId: product.id },
    net: "$10,00",
    quantity: 2,
  },
  {
    name: "2x1 selected",
    patch: { kind: "two_for_one", productId: null },
    net: "$10,00",
    quantity: 2,
    select: true,
  },
  {
    name: "custom",
    patch: { kind: "custom", rule: "Saludo de bienvenida" },
    net: "$10,00",
  },
  {
    name: "extra points",
    patch: { kind: "extra_points", extraUnits: 2 },
    net: "$10,00",
  },
  {
    name: "extra stamps",
    patch: { kind: "extra_stamps", extraUnits: 2 },
    net: "$10,00",
    stamps: true,
  },
] as const) {
  test(`0183 beneficio ${benefit.name} usa snapshot y muestra base/extras`, async ({
    page,
  }) => {
    await setup(page);
    const selected = {
      ...coupon,
      status: "selected",
      coupon: {
        ...(coupon.status === "selected" ? coupon.coupon : {}),
        ...benefit.patch,
      },
    } as CounterCouponState;
    const stamp = "stamps" in benefit;
    await customerRoutes(
      page,
      selected,
      stamp
        ? {
            ...resolved.program,
            kind: "stamps",
            accrual: { mode: "per_purchase", grant: 1, blockAmount: null },
          }
        : resolved.program,
    );
    const quantity = "quantity" in benefit ? benefit.quantity : 1;
    if (quantity === 2)
      await page.route(
        "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        (route) =>
          route.fulfill({
            json: {
              ...baseOrder,
              total: "20.00",
              items: [
                { ...baseOrder.items[0], quantity: 2, lineTotal: "20.00" },
              ],
            },
          }),
      );
    let closes = 0;
    await page.route(
      "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/close",
      (route) => {
        closes++;
        return route.fulfill({
          json: {
            ...baseOrder,
            status: "closed",
            sale: stamp
              ? {
                  consumer: "Cliente de prueba",
                  total: "10.00",
                  grossTotal: "10.00",
                  unitsGranted: 1,
                  balanceAfter: 3,
                  kind: "stamps",
                  coupon: {
                    label: "Extras",
                    discountAmount: "0.00",
                    extraUnits: 2,
                  },
                }
              : null,
          },
        });
      },
    );
    await open(page);
    await scan(page);
    if ("select" in benefit) {
      await page.getByRole("button", { name: "Producto de la oferta" }).click();
      await page.getByRole("option", { name: "Café", exact: true }).click();
    }
    await page.getByRole("button", { name: "Cobrar", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Cobrar Mesa 4" });
    await expect(
      dialog.getByRole("heading", {
        name: `Importe: ${benefit.net}`,
        exact: true,
      }),
    ).toBeVisible();
    if ("stamps" in benefit) {
      await expect(dialog.getByText("Se acreditarán: 3 sellos")).toBeVisible();
      await expect(
        dialog.getByText("1 de la compra + 2 del cupón"),
      ).toBeVisible();
      await dialog
        .getByRole("button", { name: "Confirmar cobro", exact: true })
        .click();
      await expect(page.getByText("+3 sellos acreditados")).toBeVisible();
      await expect(
        page.getByText("1 de la compra + 2 del cupón"),
      ).toBeVisible();
    } else {
      await dialog
        .getByRole("button", { name: "Cancelar", exact: true })
        .click();
      expect(closes).toBe(0);
    }
  });
}

test("0183 nueva selección externa exige revisión y limpia recibido; exclusión mismo id persiste", async ({
  page,
}) => {
  await setup(page);
  await customerRoutes(page);
  await open(page);
  await scanAndPay(page);
  let dialog = page.getByRole("dialog", { name: "Cobrar Mesa 4" });
  await dialog.getByRole("textbox", { name: "Recibido" }).fill("20");
  await dialog.getByRole("textbox", { name: "Recibido" }).press("Tab");
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page
    .getByRole("button", { name: "Quitar beneficio", exact: true })
    .click();
  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Cobrar Mesa 4" });
  await expect(
    dialog.getByRole("heading", { name: "Importe: $10,00", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Confirmar cobro", exact: true }),
  ).toBeEnabled();
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  const replacement = {
    ...coupon,
    status: "selected",
    coupon: {
      ...(coupon.status === "selected" ? coupon.coupon : {}),
      couponId: "88888888-8888-4888-8888-888888888888",
      discountValue: "20",
    },
  } as CounterCouponState;
  await page.route("**/api/pos/coupon-state**", (route) =>
    route.fulfill({ json: { couponState: replacement } }),
  );
  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Cobrar Mesa 4" });
  await expect(
    dialog.getByRole("heading", { name: "Importe: $8,00", exact: true }),
  ).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Recibido" })).toHaveValue(
    "",
  );
  await expect(
    dialog.getByRole("button", { name: "Confirmar cobro", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("button", { name: "He revisado la actualización" })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Confirmar cobro", exact: true }),
  ).toBeEnabled();
});

test("0183 recibido insuficiente, negativo y más de dos decimales bloquean; vacío opcional", async ({
  page,
}) => {
  await setup(page);
  await open(page);
  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Cobrar Mesa 4" });
  const field = dialog.getByRole("textbox", { name: "Recibido" });
  const confirm = dialog.getByRole("button", {
    name: "Confirmar cobro",
    exact: true,
  });
  for (const value of ["9", "-1", "1.234"]) {
    await field.fill(value);
    await field.press("Tab");
    await expect(confirm).toBeDisabled();
  }
  await field.fill("");
  await field.press("Tab");
  await expect(confirm).toBeEnabled();
  await field.fill("10");
  await field.press("Tab");
  await expect(dialog.getByText("Cambio: $0,00")).toBeVisible();
  await expect(confirm).toBeEnabled();
});

test("0183 capturas de Pedido y modal de cobro normales", async ({ page }) => {
  await setup(page);
  await customerRoutes(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await scan(page);
  await page.screenshot({
    path: "/private/tmp/0183-pedido-390.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Cobrar Mesa 4" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("dialog", { name: "Cobrar Mesa 4" })
      .getByRole("button", { name: "Confirmar cobro", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText("Actualizando beneficio…", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("dialog", { name: "Cobrar Mesa 4" })
      .getByRole("button", { name: "Quitar cliente", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: "/private/tmp/0183-cobro-390.png",
    animations: "disabled",
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.screenshot({
    path: "/private/tmp/0183-cobro-320.png",
    animations: "disabled",
  });
  const confirm320 = page
    .getByRole("dialog", { name: "Cobrar Mesa 4" })
    .getByRole("button", { name: "Confirmar cobro", exact: true });
  await confirm320.focus();
  await expect(confirm320).toBeInViewport();
  await page.screenshot({
    path: "/private/tmp/0183-cobro-320-actions.png",
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("dialog", { name: "Cobrar Mesa 4" })
    .getByRole("button", { name: "Cancelar", exact: true })
    .click();
  const extra = {
    ...coupon,
    status: "selected",
    coupon: {
      ...(coupon.status === "selected" ? coupon.coupon : {}),
      kind: "extra_stamps",
      extraUnits: 2,
    },
  } as CounterCouponState;
  await customerRoutes(page, extra, {
    ...resolved.program,
    kind: "stamps",
    accrual: { mode: "per_purchase", grant: 1, blockAmount: null },
  });
  await scanAndPay(page);
  await expect(
    page
      .getByRole("dialog", { name: "Cobrar Mesa 4" })
      .getByRole("button", { name: "Confirmar cobro", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: "/private/tmp/0183-extra-390.png",
    animations: "disabled",
  });
});

test("0183 escáner cámara: lectura duplicada resuelve una vez y detiene tracks al detectar/cancelar", async ({
  page,
}) => {
  await setup(page);
  let resolves = 0;
  await page.route("**/api/pos/resolve", (route) => {
    resolves++;
    return route.fulfill({ json: resolved });
  });
  await open(page);
  await scan(page);
  await expect(
    page.getByText("Cliente de prueba", { exact: true }),
  ).toBeVisible();
  expect(resolves).toBe(1);
  const counts = () =>
    page.evaluate(() => {
      const data = window as unknown as {
        posCameraStarts: number;
        posCameraStops: number;
      };
      return { starts: data.posCameraStarts, stops: data.posCameraStops };
    });
  await expect
    .poll(async () => {
      const data = await counts();
      return data.starts > 0 && data.starts === data.stops;
    })
    .toBe(true);
  await page.getByRole("button", { name: "QR", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Escanear pase" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Código del pase" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Leer pase" })).toHaveCount(0);
  await page
    .getByRole("dialog", { name: "Escanear pase" })
    .getByRole("button", { name: "Cancelar", exact: true })
    .click();
  await expect
    .poll(async () => {
      const data = await counts();
      return data.starts > 0 && data.starts === data.stops;
    })
    .toBe(true);
  await expect(
    page.getByRole("button", { name: "QR", exact: true }),
  ).toBeFocused();
  expect(resolves).toBe(1);
});

test("0183 resolve tarde cancelado de A no pinta B ni reemplaza cliente nuevo", async ({
  page,
}) => {
  await setup(page);
  let release!: () => void;
  await page.route("**/api/pos/resolve", async (route) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fulfill({ json: resolved });
  });
  const other = {
    ...baseOrder,
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    tableLabel: "Mesa B",
  };
  await page.route("**/api/pos/orders", (route) =>
    route.fulfill({
      json: {
        open: [baseOrder, other].map((o) => ({
          ...o,
          itemCount: 1,
          saleTotal: null,
        })),
        closedToday: [],
      },
    }),
  );
  await page.route(
    "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    (route) => route.fulfill({ json: other }),
  );
  await open(page);
  await page.getByRole("button", { name: "QR", exact: true }).click();
  await page.evaluate(() => {
    (window as unknown as { posCameraToken: string | null }).posCameraToken =
      "old-token";
  });
  await expect.poll(() => typeof release).toBe("function");
  await page
    .getByRole("dialog", { name: "Escanear pase" })
    .getByRole("button", { name: "Cancelar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Volver al listado de órdenes", exact: true })
    .click();
  await page.getByRole("button", { name: "Abrir Mesa B", exact: true }).click();
  const response = page.waitForResponse("**/api/pos/resolve");
  release();
  await response;
  await expect(
    page.getByText("Cliente de prueba", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Cambiar mesa: Mesa B", exact: true }),
  ).toBeVisible();
  await customerRoutes(page, { status: "none" });
  await scan(page);
  await expect(
    page.getByText("Cliente de prueba", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Volver al listado de órdenes", exact: true })
    .click();
  await page.getByRole("button", { name: "Abrir Mesa B", exact: true }).click();
  await expect(
    page.getByText("Cliente de prueba", { exact: true }),
  ).toHaveCount(0);
});

test("0183 revalidación tarde cancelada no pisa cliente reemplazado", async ({
  page,
}) => {
  await setup(page);
  await customerRoutes(page);
  await open(page);
  await scan(page);
  let release!: () => void;
  await page.route("**/api/pos/coupon-state**", async (route) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fulfill({
      json: { couponState: { status: "used_today", label: "Anterior" } },
    });
  });
  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  await expect.poll(() => typeof release).toBe("function");
  await page
    .getByRole("dialog", { name: "Cobrar Mesa 4" })
    .getByRole("button", { name: "Cancelar", exact: true })
    .click();
  await page.route("**/api/pos/resolve", (route) =>
    route.fulfill({
      json: {
        ...resolved,
        consumer: { displayName: "Cliente nuevo" },
        couponState: { status: "none" },
      },
    }),
  );
  await scan(page);
  const response = page.waitForResponse("**/api/pos/coupon-state**");
  release();
  await response;
  await expect(page.getByText("Cliente nuevo", { exact: true })).toBeVisible();
  await expect(page.getByText("Anterior", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("0183 guardar misma orden conserva cliente y recalcula; dirty bloquea QR y cobro", async ({
  page,
}) => {
  await setup(page);
  await customerRoutes(page);
  await page.route(
    "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    (route) =>
      route.fulfill({
        json:
          route.request().method() === "PUT"
            ? {
                ...baseOrder,
                version: 2,
                total: "20.00",
                items: [
                  { ...baseOrder.items[0], quantity: 2, lineTotal: "20.00" },
                ],
              }
            : baseOrder,
      }),
  );
  await open(page);
  await scanAndPay(page);
  let dialog = page.getByRole("dialog", { name: "Cobrar Mesa 4" });
  await dialog.getByRole("textbox", { name: "Recibido" }).fill("20");
  await dialog.getByRole("textbox", { name: "Recibido" }).press("Tab");
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("radio", { name: "Editar", exact: true }).click();
  await page
    .getByRole("button", { name: "Agregar un Café", exact: true })
    .click();
  await page.getByRole("radio", { name: /^Pedido/ }).click();
  await expect(
    page.getByRole("button", { name: "QR", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Cobrar", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(
    page.getByText("Cliente de prueba", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".counter-detailed-footer")
      .getByText("$18,00", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cobrar", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Cobrar Mesa 4" });
  await expect(dialog.getByRole("textbox", { name: "Recibido" })).toHaveValue(
    "",
  );
});

for (const failure of [
  { status: 404, code: "not_found", invalidates: true },
  { status: 403, code: "foreign_membership", invalidates: true },
  { status: 404, code: "no_program", invalidates: false },
  { status: 503, code: "unavailable", invalidates: false },
  { status: 401, code: "unauthorized", auth: true },
  { status: 403, code: "missing_permission", auth: true },
] as const) {
  test(`0183 coupon-state ${failure.code} clasifica operación y conserva orden o revoca`, async ({
    page,
  }) => {
    await setup(page);
    await customerRoutes(page);
    await open(page);
    await scan(page);
    let closes = 0;
    await page.route(
      "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/close",
      (route) => {
        closes++;
        return route.abort();
      },
    );
    await page.route("**/api/pos/coupon-state**", (route) =>
      route.fulfill({
        status: failure.status,
        json: { code: failure.code, error: "No se pudo revisar el beneficio." },
      }),
    );
    await page.getByRole("button", { name: "Cobrar", exact: true }).click();
    if ("auth" in failure) {
      await expect(
        page.getByRole("heading", { name: "POS no disponible" }),
      ).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    } else {
      const dialog = page.getByRole("dialog", { name: "Cobrar Mesa 4" });
      await expect(
        dialog.getByRole("button", { name: "Confirmar cobro", exact: true }),
      ).toBeDisabled();
      await expect(
        dialog.getByText("No se pudo revisar el beneficio.", { exact: true }),
      ).toBeVisible();
      await dialog
        .getByRole("button", { name: "Cancelar", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Cambiar mesa: Mesa 4", exact: true }),
      ).toBeVisible();
    }
    expect(closes).toBe(0);
  });
}

for (const failure of [
  { status: 409, code: "version_conflict", recover: "open" },
  { status: 409, code: "request_reused", recover: "open" },
  { status: 409, code: "pos_order_not_open", recover: "closed" },
  { status: 404, code: "unknown_pos_order" },
  { status: 404, code: "no_program" },
  { status: 422, code: "empty_cart" },
  { status: 401, code: "unauthorized" },
  { status: 403, code: "missing_permission" },
] as const) {
  test(`0183 close ${failure.code} no muestra éxito falso ni reenvío automático`, async ({
    page,
  }) => {
    await setup(page);
    await customerRoutes(page, { status: "none" });
    await open(page);
    await scanAndPay(page);
    let closes = 0;
    let gets = 0;
    await page.route(
      "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      (route) => {
        gets++;
        return route.fulfill({
          json: {
            ...baseOrder,
            version: 2,
            status:
              "recover" in failure && failure.recover === "closed"
                ? "closed"
                : "open",
          },
        });
      },
    );
    await page.route(
      "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/close",
      (route) => {
        closes++;
        return route.fulfill({
          status: failure.status,
          json: { code: failure.code, error: "El cierre fue rechazado." },
        });
      },
    );
    await page
      .getByRole("dialog", { name: "Cobrar Mesa 4" })
      .getByRole("button", { name: "Confirmar cobro", exact: true })
      .click();
    if ("recover" in failure) {
      await expect.poll(() => gets).toBe(1);
      if (failure.recover === "closed")
        await expect(page.getByText("Venta cerrada sin pase.")).toBeVisible();
      else
        await expect(
          page.getByRole("button", { name: "Cobrar", exact: true }),
        ).toBeVisible();
    } else if (failure.code === "unknown_pos_order")
      await expect(
        page.getByRole("heading", { name: "Abiertas", exact: true }),
      ).toBeVisible();
    else if (failure.status === 401 || failure.status === 403)
      await expect(
        page.getByRole("heading", { name: "POS no disponible" }),
      ).toBeVisible();
    else {
      await expect(
        page
          .getByRole("dialog", { name: "Cobrar Mesa 4" })
          .getByRole("button", { name: "Confirmar cobro", exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole("heading", { name: "Venta cerrada", exact: true }),
      ).toHaveCount(0);
    }
    expect(closes).toBe(1);
  });
}

test("0183 timeout después del commit congela UUID/cuerpo, bloquea navegación y reintenta resultado", async ({
  page,
}) => {
  await setup(page);
  await customerRoutes(page);
  let release!: () => void;
  const bodies: Record<string, unknown>[] = [];
  let sales = 0;
  const closed = {
    ...baseOrder,
    status: "closed",
    version: 2,
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
  };
  await page.route(
    "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/close",
    async (route) => {
      bodies.push(route.request().postDataJSON());
      if (bodies.length === 1) {
        sales++;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      await route.fulfill({ json: closed });
    },
  );
  await page.clock.install();
  await open(page);
  await scanAndPay(page);
  const dialog = page.getByRole("dialog", { name: "Cobrar Mesa 4" });
  await dialog
    .getByRole("button", { name: "Confirmar cobro", exact: true })
    .click();
  await expect.poll(() => typeof release).toBe("function");
  await page.clock.fastForward(15_001);
  await expect(
    dialog.getByRole("button", { name: "Reintentar cobro", exact: true }),
  ).toBeEnabled();
  const beforeUnload = await page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(beforeUnload).toBe(true);
  const url = page.url();
  await page.evaluate(() => {
    window.history.pushState({}, "", "/attempted-leave");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page).toHaveURL(url);
  await page.evaluate(() => {
    const anchor = document.querySelector<HTMLAnchorElement>(
      "a[href='/backoffice']",
    );
    anchor?.click();
  });
  await expect(page).toHaveURL(url);
  await expect(
    dialog.getByRole("button", { name: "Cancelar", exact: true }),
  ).toBeDisabled();
  await page.route("**/api/pos/coupon-state**", (route) =>
    route.fulfill({ json: { couponState: { status: "none" } } }),
  );
  await dialog
    .getByRole("button", { name: "Reintentar cobro", exact: true })
    .click();
  await expect(page.getByText("+3 puntos acreditados")).toBeVisible();
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toEqual(bodies[0]);
  expect(sales).toBe(1);
  release();
});

for (const problem of [
  "currency",
  "missing_product",
  "quantity",
  "malformed_program",
] as const) {
  test(`0183 ${problem} bloquea incluir beneficio hasta corregir o excluir`, async ({
    page,
  }) => {
    await setup(page);
    const selected = {
      ...coupon,
      status: "selected",
      coupon: {
        ...(coupon.status === "selected" ? coupon.coupon : {}),
        ...(problem === "currency"
          ? {
              kind: "discount",
              discountUnit: "amount",
              discountValue: "2.00",
              currencyCode: "EUR",
            }
          : problem === "missing_product"
            ? {
                kind: "free_product",
                productId: "33333333-3333-4333-8333-333333333333",
              }
            : problem === "quantity"
              ? { kind: "two_for_one", productId: product.id }
              : {}),
      },
    } as CounterCouponState;
    await customerRoutes(
      page,
      selected,
      problem === "malformed_program"
        ? {
            ...resolved.program,
            accrual: { mode: "unknown", grant: 1, blockAmount: 1 },
          }
        : resolved.program,
    );
    let closes = 0;
    await page.route(
      "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/close",
      (route) => {
        closes++;
        return route.abort();
      },
    );
    await open(page);
    await scanAndPay(page);
    const dialog = page.getByRole("dialog", { name: "Cobrar Mesa 4" });
    await expect(
      dialog.getByRole("button", { name: "Confirmar cobro", exact: true }),
    ).toBeDisabled();
    expect(closes).toBe(0);
    if (problem === "malformed_program")
      await dialog
        .getByRole("button", { name: "Quitar cliente", exact: true })
        .click();
    else
      await dialog
        .getByRole("button", { name: "Quitar beneficio", exact: true })
        .click();
    await expect(
      dialog.getByRole("button", { name: "Confirmar cobro", exact: true }),
    ).toBeEnabled();
  });
}

test("0183 cupón expira al confirmar: rollback, revisión y exclusión explícita antes de nuevo intento", async ({
  page,
}) => {
  await setup(page);
  await customerRoutes(page);
  await open(page);
  await scanAndPay(page);
  const expired = {
    ...coupon,
    status: "selected",
    verdict: {
      valid: false,
      code: "coupon_expired",
      message: "El cupón venció.",
    },
  } as CounterCouponState;
  await page.route("**/api/pos/coupon-state**", (route) =>
    route.fulfill({ json: { couponState: expired } }),
  );
  const bodies: Record<string, unknown>[] = [];
  await page.route(
    "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/close",
    (route) => {
      bodies.push(route.request().postDataJSON());
      return bodies.length === 1
        ? route.fulfill({
            status: 409,
            json: { code: "coupon_expired", error: "El cupón venció." },
          })
        : route.fulfill({
            json: {
              ...baseOrder,
              status: "closed",
              sale: {
                consumer: "Cliente de prueba",
                total: "10.00",
                grossTotal: "10.00",
                unitsGranted: 3,
                balanceAfter: 13,
                kind: "points",
                coupon: null,
              },
            },
          });
    },
  );
  const dialog = page.getByRole("dialog", { name: "Cobrar Mesa 4" });
  await dialog
    .getByRole("button", { name: "Confirmar cobro", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Cupón no válido", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Confirmar cobro", exact: true }),
  ).toBeDisabled();
  expect(bodies).toHaveLength(1);
  await dialog
    .getByRole("button", { name: "Quitar beneficio", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "He revisado la actualización", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Confirmar cobro", exact: true }),
  ).toBeEnabled();
  await dialog
    .getByRole("button", { name: "Confirmar cobro", exact: true })
    .click();
  await expect(page.getByText("+3 puntos acreditados")).toBeVisible();
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).not.toHaveProperty("coupon");
  expect(bodies[1].membershipId).toBe(resolved.membership.id);
  expect(bodies[1].clientRequestId).not.toBe(bodies[0].clientRequestId);
});

test("0183 scanner error conserva cliente; cancelar resolución evita respuestas tardías tras auth revocada", async ({
  page,
}) => {
  await setup(page);
  await customerRoutes(page);
  await open(page);
  await scan(page);
  await page.route("**/api/pos/resolve", (route) =>
    route.fulfill({
      status: 422,
      json: { code: "invalid_qr", error: "El pase no es válido." },
    }),
  );
  await page.getByRole("button", { name: "QR", exact: true }).click();
  await page.evaluate(() => {
    (window as unknown as { posCameraToken: string | null }).posCameraToken =
      "bad-token";
  });
  await expect(
    page.getByRole("heading", { name: "El pase no es válido.", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: "Escanear pase" })
    .getByRole("button", { name: "Cancelar", exact: true })
    .click();
  await expect(
    page.getByText("Cliente de prueba", { exact: true }),
  ).toBeVisible();
  await page.route("**/api/pos/resolve", (route) =>
    route.fulfill({
      status: 401,
      json: { code: "unauthorized", error: "Sesión revocada" },
    }),
  );
  await page.getByRole("button", { name: "QR", exact: true }).click();
  await page.evaluate(() => {
    (window as unknown as { posCameraToken: string | null }).posCameraToken =
      "revoked-token";
  });
  await expect(
    page.getByRole("heading", { name: "POS no disponible" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Cliente de prueba", { exact: true }),
  ).toHaveCount(0);
});

for (const failure of [
  "request_reused",
  "version_conflict",
  "pos_order_not_open",
]) {
  for (const via of ["cancel-reopen", "retry-review"]) {
    test(`0183 recuperación fallida ${failure} ${via} blocks fresh close until snapshot recovered`, async ({
      page,
    }) => {
      await setup(page);
      await customerRoutes(page, { status: "none" });
      await open(page);
      await scanAndPay(page);
      let gets = 0,
        closes = 0;
      let recovered = false;
      const bodies: Record<string, unknown>[] = [];
      await page.route(
        "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        (route) => {
          gets++;
          return recovered
            ? route.fulfill({
                json: {
                  ...baseOrder,
                  version: 4,
                  total: "20.00",
                  items: [
                    { ...baseOrder.items[0], quantity: 2, lineTotal: "20.00" },
                  ],
                },
              })
            : route.fulfill({
                status: 503,
                json: { error: "Temporary recovery failure" },
              });
        },
      );
      await page.route(
        "**/api/pos/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/close",
        (route) => {
          closes++;
          bodies.push(route.request().postDataJSON());
          return route.fulfill({
            status: 409,
            json: { code: failure, error: "Rejected" },
          });
        },
      );
      let dialog = page.getByRole("dialog", { name: "Cobrar Mesa 4" });
      await dialog
        .getByRole("button", { name: "Confirmar cobro", exact: true })
        .click();
      await expect.poll(() => gets).toBe(1);
      await expect(
        dialog.getByRole("button", {
          name: "Reintentar revisión",
          exact: true,
        }),
      ).toBeVisible();
      if (via === "cancel-reopen") {
        await dialog
          .getByRole("button", { name: "Cancelar", exact: true })
          .click();
        await page.getByRole("button", { name: "Cobrar", exact: true }).click();
      } else
        await dialog
          .getByRole("button", { name: "Reintentar revisión", exact: true })
          .click();
      dialog = page.getByRole("dialog", { name: "Cobrar Mesa 4" });
      await expect.poll(() => gets).toBe(2);
      await expect(
        dialog.getByRole("button", {
          name: "Reintentar revisión",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText("Actualizando beneficio…", { exact: true }),
      ).toBeHidden();
      await expect(
        dialog.getByRole("button", { name: "Confirmar cobro", exact: true }),
      ).toBeDisabled();
      await dialog
        .getByRole("button", { name: "Quitar cliente", exact: true })
        .click();
      await expect(
        dialog.getByRole("button", { name: "Confirmar cobro", exact: true }),
      ).toBeDisabled();
      expect(closes).toBe(1);
      recovered = true;
      await dialog
        .getByRole("button", { name: "Reintentar revisión", exact: true })
        .click();
      await expect(dialog).toBeHidden();
      await page.getByRole("button", { name: "Cobrar", exact: true }).click();
      await expect(
        dialog.getByRole("heading", { name: "Importe: $20,00", exact: true }),
      ).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Confirmar cobro", exact: true }),
      ).toBeDisabled();
      await dialog
        .getByRole("button", {
          name: "He revisado la actualización",
          exact: true,
        })
        .click();
      await dialog
        .getByRole("button", { name: "Confirmar cobro", exact: true })
        .click();
      await expect.poll(() => closes).toBe(2);
      expect(bodies[1].version).toBe(4);
      expect(bodies[1].clientRequestId).not.toBe(bodies[0].clientRequestId);
    });
  }
}

test("0183 identificación muestra C animada y toast solo al encontrar cliente", async ({
  page,
}) => {
  await setup(page);
  await customerRoutes(page);
  let release!: () => void;
  await page.route("**/api/pos/resolve", async (route) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fulfill({ json: resolved });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.getByRole("button", { name: "QR", exact: true }).click();
  await page.evaluate(() => {
    (window as unknown as { posCameraToken: string | null }).posCameraToken =
      "qa-token";
  });
  const dialog = page.getByRole("dialog", {
    name: "Escanear pase",
    exact: true,
  });
  const loading = dialog.getByRole("status", {
    name: "Identificando cliente",
    exact: true,
  });
  await expect(loading).toBeVisible();
  await expect(loading).toHaveAttribute("aria-busy", "true");
  const logo = loading.locator("svg");
  await expect(logo).toBeInViewport();
  expect(
    await logo.evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("pulse");
  await expect(loading.locator("span")).toHaveClass("sr-only");
  await expect(
    page.getByText("Cliente identificado", { exact: true }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Cancelar", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: "/private/tmp/0183-identificando-cliente.png",
    animations: "disabled",
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await logo.evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  release();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByText("Cliente de prueba", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Cliente identificado", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "/private/tmp/0183-cliente-identificado-toast.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "QR", exact: true }).click();
  await expect(
    page.getByText("Cliente identificado", { exact: true }),
  ).toHaveCount(0);
});

test("0183 cancelar loading de identificación ignora éxito tardío sin toast", async ({
  page,
}) => {
  await setup(page);
  let release!: () => void;
  await page.route("**/api/pos/resolve", async (route) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fulfill({ json: resolved });
  });
  await open(page);
  await page.getByRole("button", { name: "QR", exact: true }).click();
  await page.evaluate(() => {
    (window as unknown as { posCameraToken: string | null }).posCameraToken =
      "qa-token";
  });
  const dialog = page.getByRole("dialog", {
    name: "Escanear pase",
    exact: true,
  });
  await expect(
    dialog.getByRole("status", { name: "Identificando cliente", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  const response = page.waitForResponse("**/api/pos/resolve");
  release();
  await response;
  await expect(dialog).toBeHidden();
  await expect(
    page.getByText("Cliente identificado", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Cliente de prueba", { exact: true }),
  ).toHaveCount(0);
});
