import { expect, type Page } from "@playwright/test";
import {
  test,
  loyaltyFixture,
  storedProgram,
  next,
} from "./support/loyalty-fixture";

test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

async function fixture(page: Page, existing = true, kind = "points") {
  const api = await loyaltyFixture(page, existing);
  if (existing)
    api.program = {
      ...storedProgram,
      kind,
      configuration:
        kind === "points"
          ? { unitSingular: "Punto", unitPlural: "Puntos" }
          : storedProgram.configuration,
    };
  const expiry = {
    writes: [] as (number | null)[],
    status: 200,
    code: "state_changed",
    error: "Otro cambio entró en el medio. Consulta el programa.",
  };
  await page.route("**/api/loyalty-program/expiry", async (route) => {
    expect(route.request().method()).toBe("PUT");
    const { months } = route.request().postDataJSON() as {
      months: number | null;
    };
    expect(route.request().postDataJSON()).toEqual({ months });
    expiry.writes.push(months);
    if (expiry.status !== 200)
      await route.fulfill({
        status: expiry.status,
        json: { error: expiry.error, code: expiry.code },
      });
    else {
      expect(api.program).not.toBeNull();
      api.program = { ...api.program, balanceExpiryMonths: months };
      await route.fulfill({
        json: {
          balanceExpiryMonths: months,
          balanceExpirySince: months === null ? null : "2026-10-11T12:00:00Z",
        },
      });
    }
  });
  return { api, expiry };
}

async function edit(page: Page, url: string) {
  await page.goto(url);
  await expect(
    page.getByRole("switch", { name: /Los (puntos|sellos) vencen/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Editar programa" }).click();
}
async function toggle(page: Page, name = "Los puntos vencen") {
  await page.getByRole("switch", { name, exact: true }).focus();
  await page.keyboard.press("Space");
}
async function confirm(page: Page) {
  await expect(page.getByRole("dialog")).toContainText(
    "Empieza a contar hoy para todos tus clientes",
  );
  await page.getByRole("button", { name: "Confirmar vencimiento" }).click();
}
async function select(page: Page, months: number) {
  await page
    .getByRole("button", { name: /Plazo sin compras ni canjes/ })
    .click();
  await page
    .getByRole("option", { name: `${months} meses`, exact: true })
    .click();
}

test("activar confirma 6; alargar y apagar guardan directamente por la ruta propia", async ({
  page,
  loyaltyHarness,
}) => {
  const { api, expiry } = await fixture(page);
  await edit(page, loyaltyHarness);
  await toggle(page);
  expect(expiry.writes).toEqual([]);
  await confirm(page);
  await expect(
    page.getByRole("switch", { name: "Los puntos vencen" }),
  ).toBeChecked();
  expect(expiry.writes).toEqual([6]);
  await select(page, 12);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => expiry.writes).toEqual([6, 12]);
  await expect(
    page.getByRole("button", { name: /Plazo sin compras ni canjes/ }),
  ).toContainText("12 meses");
  await toggle(page);
  await expect.poll(() => expiry.writes).toEqual([6, 12, null]);
  await expect(
    page.getByRole("switch", { name: "Los puntos vencen" }),
  ).not.toBeChecked();
  expect(api.writes).toEqual([]);
});

test("cancelar no guarda y acortar requiere confirmación", async ({
  page,
  loyaltyHarness,
}) => {
  const { api, expiry } = await fixture(page);
  api.program = { ...api.program, balanceExpiryMonths: 12 };
  await edit(page, loyaltyHarness);
  await select(page, 3);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(expiry.writes).toEqual([]);
  await expect(
    page.getByRole("button", { name: /Plazo sin compras ni canjes/ }),
  ).toContainText("12 meses");
  await select(page, 3);
  await confirm(page);
  await expect.poll(() => expiry.writes).toEqual([3]);
});

test("state_changed muestra el mensaje del servidor y relee sin perder el borrador", async ({
  page,
  loyaltyHarness,
}) => {
  const { api, expiry } = await fixture(page);
  expiry.status = 409;
  await edit(page, loyaltyHarness);
  await page
    .getByRole("textbox", { name: "Nombre singular", exact: true })
    .fill("Crédito");
  const reads = api.reads;
  api.program = { ...api.program, balanceExpiryMonths: 9 };
  await toggle(page);
  await confirm(page);
  await expect(page.getByRole("alert")).toContainText(expiry.error);
  await expect.poll(() => api.reads).toBeGreaterThan(reads);
  await expect(
    page.getByRole("button", { name: /Plazo sin compras ni canjes/ }),
  ).toContainText("9 meses");
  await expect(
    page.getByRole("textbox", { name: "Nombre singular", exact: true }),
  ).toHaveValue("Crédito");
});

test("403 bloquea cambios con el manejo de permisos existente", async ({
  page,
  loyaltyHarness,
}) => {
  const { expiry } = await fixture(page);
  expiry.status = 403;
  expiry.code = "missing_permission";
  expiry.error = "No tienes permiso para gestionar el programa.";
  await edit(page, `${loyaltyHarness}?staff`);
  await toggle(page);
  await confirm(page);
  await expect(page.getByRole("alert")).toContainText(expiry.error);
  await expect(
    page.getByRole("switch", { name: "Los puntos vencen" }),
  ).toBeDisabled();
});

async function createReview(page: Page, url: string) {
  await page.goto(url);
  await next(page);
  await toggle(page);
  await confirm(page);
  await next(page);
  await page
    .getByRole("textbox", { name: "Texto de términos" })
    .fill("Condiciones del programa");
  await page.getByRole("textbox", { name: "Monto por bloque" }).fill("5");
  await next(page);
  await page
    .getByRole("textbox", { name: "Nombre del premio" })
    .fill("Café gratis");
  await next(page);
}

test("crear aplica la regla después de activar; no la incluye en el PUT del programa", async ({
  page,
  loyaltyHarness,
}) => {
  const { api, expiry } = await fixture(page, false);
  await createReview(page, loyaltyHarness);
  expect(expiry.writes).toEqual([]);
  await page.getByRole("button", { name: "Activar programa" }).click();
  await expect(
    page.getByRole("button", { name: "Editar programa" }),
  ).toBeVisible();
  expect(expiry.writes).toEqual([6]);
  expect(api.writes).toHaveLength(1);
  expect(api.writes[0].body).not.toHaveProperty("balanceExpiryMonths");
  await page.getByRole("button", { name: "Editar programa" }).click();
  await expect(
    page.getByRole("switch", { name: "Los puntos vencen" }),
  ).toBeChecked();
});

test("si falla la regla al crear se reintenta solo vencimiento", async ({
  page,
  loyaltyHarness,
}) => {
  const { api, expiry } = await fixture(page, false);
  expiry.status = 503;
  expiry.code = "program_unavailable";
  expiry.error = "No pudimos guardar el vencimiento. Intenta de nuevo.";
  await createReview(page, loyaltyHarness);
  await page.getByRole("button", { name: "Activar programa" }).click();
  await expect(page.getByRole("alert")).toContainText(expiry.error);
  await expect(
    page.getByRole("button", { name: "Reintentar vencimiento" }),
  ).toBeVisible();
  expiry.status = 200;
  await page.getByRole("button", { name: "Reintentar vencimiento" }).click();
  await expect(
    page.getByRole("switch", { name: "Los puntos vencen" }),
  ).toBeChecked();
  expect(expiry.writes).toEqual([6, 6]);
  expect(api.writes).toHaveLength(1);
});

for (const kind of ["points", "stamps"])
  for (const theme of ["light", "dark"]) {
    test(`configuración ${kind} a 390px: ${theme}`, async ({
      page,
      loyaltyHarness,
    }, info) => {
      const { api } = await fixture(page, true, kind);
      api.program = { ...api.program, balanceExpiryMonths: 6 };
      await edit(page, loyaltyHarness);
      await page.evaluate(
        (value) => document.documentElement.setAttribute("data-theme", value),
        theme,
      );
      await expect(
        page.getByRole("switch", {
          name: kind === "points" ? "Los puntos vencen" : "Los sellos vencen",
        }),
      ).toBeChecked();
      await info.attach(`${kind}-${theme}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(390);
    });
  }
