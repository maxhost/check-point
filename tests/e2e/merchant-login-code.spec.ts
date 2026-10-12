import { expect, test } from "@playwright/test";
import { merchantURL } from "./support/ports";

const email = "owner@example.com";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/onboarding/state", (route) =>
    route.fulfill({ json: { authenticated: false } }),
  );
  await page.route("**/api/onboarding/prefill", (route) =>
    route.fulfill({ json: { categories: [] } }),
  );
  await page.route("**/api/merchant/auth/login", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({ email });
    await route.fulfill({ json: { accepted: true } });
  });
  await page.goto(`${merchantURL}/es/business/onboarding`);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
});

async function requestCode(page: import("@playwright/test").Page) {
  await page.getByLabel("Tu email").fill(email);
  await page.getByRole("button", { name: "Enviarme código" }).click();
  await expect(
    page.getByRole("heading", { name: `Te mandamos un código a ${email}` }),
  ).toBeVisible();
}

test("pide código, valida seis números y navega con un documento nuevo", async ({
  page,
}) => {
  await page.route("**/api/merchant/auth/login/verify", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ email, code: "012345" });
    await route.fulfill({
      json: { destination: "/backoffice?login-code-qa=1" },
    });
  });
  await page.route("**/backoffice?login-code-qa=1", (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: "<h1>Sesión iniciada</h1>",
    }),
  );
  await requestCode(page);
  const input = page.getByLabel("Código de 6 números");
  await expect(input).toHaveAttribute("inputmode", "numeric");
  await expect(input).toHaveAttribute("autocomplete", "one-time-code");
  await expect(input).toHaveAttribute("maxlength", "6");
  await expect(input).toHaveAttribute("pattern", "\\d{6}");
  const enter = page.getByRole("button", { name: "Entrar", exact: true });
  await expect(enter).toBeDisabled();
  await input.fill("12345a");
  await expect(enter).toBeDisabled();
  await input.fill("012345");
  await expect(enter).toBeEnabled();
  const navigation = page.waitForRequest(
    (request) =>
      request.isNavigationRequest() &&
      request.url().includes("login-code-qa=1"),
  );
  await enter.click();
  await navigation;
  await expect(
    page.getByRole("heading", { name: "Sesión iniciada" }),
  ).toBeVisible();
});

test("code_incorrect muestra el mensaje y permite corregir y reintentar", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/api/merchant/auth/login/verify", async (route) => {
    attempts++;
    await route.fulfill({
      status: 400,
      json: { error: "El código no es correcto.", code: "code_incorrect" },
    });
  });
  await requestCode(page);
  await page.getByLabel("Código de 6 números").fill("111111");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByText("El código no es correcto.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Código de 6 números").fill("222222");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect.poll(() => attempts).toBe(2);
  await expect(
    page.getByRole("button", { name: "Entrar", exact: true }),
  ).toBeEnabled();
});

test("too_many_failures oculta reenvío y bloquea nuevos intentos", async ({
  page,
}) => {
  await page.route("**/api/merchant/auth/login/verify", (route) =>
    route.fulfill({
      status: 429,
      json: {
        error: "Demasiados intentos. Probá de nuevo mañana.",
        code: "too_many_failures",
      },
    }),
  );
  await requestCode(page);
  await page.getByLabel("Código de 6 números").fill("111111");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByText("Demasiados intentos. Probá de nuevo mañana."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reenviar código" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Entrar", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Código de 6 números")).toBeDisabled();
});

test("Usar otro email vuelve a la pantalla de email", async ({ page }) => {
  await requestCode(page);
  await page.getByRole("button", { name: "Usar otro email" }).click();
  await expect(
    page.getByRole("heading", { name: "Entra a tu cuenta" }),
  ).toBeVisible();
  await expect(page.getByLabel("Tu email")).toHaveValue("");
  await expect(page.getByLabel("Código de 6 números")).toHaveCount(0);
});

test("código vencido permite reenviar al mismo email y limpia el campo", async ({
  page,
}) => {
  await page.route("**/api/merchant/auth/login/verify", (route) =>
    route.fulfill({
      status: 400,
      json: {
        error: "El código venció. Pedí uno nuevo.",
        code: "code_expired",
      },
    }),
  );
  await requestCode(page);
  await page.getByLabel("Código de 6 números").fill("111111");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByText("El código venció. Pedí uno nuevo."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reenviar código" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Te mandamos un código nuevo",
  );
  await expect(page.getByLabel("Código de 6 números")).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Entrar", exact: true }),
  ).toBeDisabled();
});

for (const theme of ["light", "dark"]) {
  test(`capturas móviles de email y código: ${theme}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(
      (value) => document.documentElement.setAttribute("data-theme", value),
      theme,
    );
    await page.getByLabel("Tu email").fill(email);
    await testInfo.attach(`email-${theme}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    await requestCode(page);
    await testInfo.attach(`code-${theme}`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  });
}
