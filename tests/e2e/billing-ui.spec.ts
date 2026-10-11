import { expect, test, type Page } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";

let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/billing-harness.tsx",
    "subscription",
  );
});
test.afterAll(async () => harness.close());

function state(plan = "trial", access = "trial", scheduled = false) {
  return {
    subscription: {
      plan,
      status: "active",
      interval: plan === "trial" ? null : "month",
      pendingPlan: scheduled ? "none" : null,
      pendingPlanAt: scheduled ? "2026-12-01T12:00:00.000Z" : null,
      trialEndsAt: "2026-12-20T12:00:00.000Z",
    },
    access,
    trialDaysLeft: access === "trial" ? 12 : null,
    activeLocations: 1,
    activeCampaignsOutsideBase: 0,
    prices: { base: { month: 20, year: 200 }, plus: { month: 49, year: 490 } },
    currency: "USD",
  };
}
async function setup(page: Page, billing = state()) {
  await page.route("**/api/billing/state", (route) =>
    route.fulfill({ json: billing }),
  );
  await page.route("**/api/merchant/session", (route) =>
    route.fulfill({ json: { billing } }),
  );
}

for (const [plan, period, amount] of [
  ["base", "month", 20],
  ["base", "year", 200],
  ["plus", "month", 49],
  ["plus", "year", 490],
] as const) {
  test(`checkout ${plan}/${period}: elección completa, precios y prueba`, async ({
    page,
  }) => {
    await setup(page);
    let body: unknown;
    await page.route("**/api/billing/checkout", (route) => {
      body = route.request().postDataJSON();
      return route.fulfill({ json: { url: `${harness.url}?stripe=checkout` } });
    });
    await page.goto(harness.url);
    await expect(page.getByText("Te quedan 12 días de prueba")).toBeVisible();
    if (plan === "plus")
      await page.getByRole("radio", { name: "Impulso", exact: true }).click();
    if (period === "year")
      await page.getByRole("radio", { name: "Anual", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: `USD ${amount} / ${period === "year" ? "año" : "mes"}`,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Elegir un plan", exact: true })
      .click();
    await expect(page).toHaveURL(/stripe=checkout/);
    expect(body).toEqual({ plan, interval: period, from: "subscription" });
  });
}

test("cambiar plan exige confirmación y muestra el 409 con su destino", async ({
  page,
}) => {
  await setup(page, state("plus", "subscribed"));
  const writes: unknown[] = [];
  await page.route("**/api/billing/plan", (route) => {
    writes.push(route.request().postDataJSON());
    return route.fulfill({
      status: 409,
      json: {
        code: "downgrade_blocked_campaigns",
        error: "Desactiva 1 campaña para cambiar a Conecta.",
      },
    });
  });
  await page.goto(`${harness.url}?plan=plus`);
  await page.getByRole("button", { name: "Cambiar a Conecta" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("no devuelve la diferencia");
  await expect(dialog).toContainText("USD 20 por mes");
  expect(writes).toEqual([]);
  await dialog.getByRole("button", { name: "Confirmar cambio" }).click();
  await expect(
    page.getByText("Desactiva 1 campaña para cambiar a Conecta.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ir a Campañas para desactivar" }),
  ).toHaveAttribute("href", "/backoffice/marketing");
  expect(writes).toEqual([{ to: "base" }]);
});

test("subir a Impulso confirma el cobro y bloquea dobles envíos", async ({
  page,
}) => {
  await setup(page, state("base", "subscribed"));
  let writes = 0;
  let release: (() => void) | undefined;
  await page.route("**/api/billing/plan", async (route) => {
    writes++;
    expect(route.request().postDataJSON()).toEqual({ to: "plus" });
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.fulfill({ json: state("plus", "subscribed") });
  });
  await page.goto(`${harness.url}?plan=base`);
  await page.getByRole("button", { name: "Cambiar a Impulso" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Se cobra la diferencia");
  const confirm = dialog.getByRole("button", { name: "Confirmar cambio" });
  await confirm.click();
  await expect(confirm).toBeDisabled();
  await expect.poll(() => writes).toBe(1);
  release?.();
  await expect(page).toHaveURL(/done=plan/);
  expect(writes).toBe(1);
});

test("fallo al leer el estado permite reintentar sin inventar precios", async ({
  page,
}) => {
  let reads = 0;
  await page.route("**/api/billing/state", (route) => {
    reads++;
    return reads === 1
      ? route.fulfill({
          status: 503,
          json: { error: "No pudimos leer tu suscripción." },
        })
      : route.fulfill({ json: state() });
  });
  await page.goto(harness.url);
  await expect(
    page.getByRole("button", { name: "Elegir un plan", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "USD 20 / mes" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Elegir un plan", exact: true }),
  ).toBeEnabled();
  expect(reads).toBe(2);
});

test("cancelar conserva acceso hasta el período y reanudar revierte la baja", async ({
  page,
}) => {
  await setup(page, state("base", "subscribed"));
  let cancels = 0;
  let resumes = 0;
  await page.route("**/api/billing/cancel", (route) => {
    cancels++;
    return route.fulfill({ json: state("base", "subscribed", true) });
  });
  await page.route("**/api/billing/resume", (route) => {
    resumes++;
    return route.fulfill({ json: state("base", "subscribed") });
  });
  await page.goto(`${harness.url}?plan=base`);
  await page
    .getByRole("button", { name: "Cancelar suscripción", exact: true })
    .click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(
    "seguirá activa hasta el final del período actual",
  );
  await expect(dialog).not.toContainText("baja es inmediata");
  expect(cancels).toBe(0);
  await dialog.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page).toHaveURL(/done=cancel/);
  expect(cancels).toBe(1);
  await setup(page, state("base", "subscribed", true));
  await page.goto(`${harness.url}?plan=base&scheduled`);
  await page
    .getByRole("button", { name: "Reanudar suscripción", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Reanudar", exact: true })
    .click();
  await expect(page).toHaveURL(/done=resume/);
  expect(resumes).toBe(1);
});

test("bloqueo, error de pago y red conservan una salida para reintentar", async ({
  page,
}) => {
  await setup(page, state("none", "blocked"));
  let attempts = 0;
  await page.route("**/api/billing/checkout", (route) => {
    attempts++;
    if (attempts === 1)
      return route.fulfill({
        status: 402,
        json: { code: "payment_failed", error: "La tarjeta fue rechazada." },
      });
    return route.abort("failed");
  });
  await page.goto(`${harness.url}?plan=none`);
  await expect(
    page.getByText("Tu negocio necesita un plan activo"),
  ).toBeVisible();
  const checkout = page.getByRole("button", {
    name: "Elegir un plan",
    exact: true,
  });
  await checkout.click();
  await expect(
    page.getByText("La tarjeta fue rechazada.", { exact: true }),
  ).toBeVisible();
  await checkout.click();
  await expect(
    page.getByText("No pudimos conectarnos. Vuelve a intentar.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(checkout).toBeEnabled();
  expect(attempts).toBe(2);
});

for (const width of [390, 1440]) {
  test(`prueba y proporciones ${width}px`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await setup(page);
    await page.setViewportSize({ width, height: 960 });
    await page.goto(`${harness.url}?banner`);
    await expect(
      page.getByText("Prueba de CheckPass: quedan 12 días"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "USD 20 / mes" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Elegir un plan", exact: true }),
    ).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await expect(page.locator("body")).not.toContainText(
      /\bFree\b|Plan Gratis|baja a Free/,
    );
    await page.screenshot({
      path: testInfo.outputPath(`billing-${width}.png`),
      fullPage: true,
      animations: "disabled",
    });
  });
}
