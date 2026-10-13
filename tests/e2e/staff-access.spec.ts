import { expect, test, type Page } from "@playwright/test";
import { merchantURL } from "./support/ports";

const origin = process.env.STAFF_ACCESS_TEST_URL ?? merchantURL;
const identifier = "lucas@lafarmacia";
const pin = "012345";
const userId = "staff-user";
const destination = "/backoffice/pos?staff-access-qa=1";

async function session(
  page: Page,
  permissions: string[] = ["pos"],
  authenticated = true,
) {
  await page.route("**/api/merchant/session", (route) =>
    route.fulfill({
      json: authenticated
        ? {
            authenticated: true,
            user: { id: userId },
            membership: { role: "staff", status: "active", permissions },
          }
        : { authenticated: false },
    }),
  );
}
async function login(page: Page, mustChangePin = false) {
  await page.route("**/api/merchant/auth/staff", (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({ identifier, pin });
    return route.fulfill({
      json: {
        staff: {
          userId,
          name: "Lucas",
          identifier,
          mustChangePin,
          landing: destination,
        },
      },
    });
  });
}
async function fillLogin(page: Page) {
  await page
    .getByRole("textbox", { name: "Identificador", exact: true })
    .fill(` ${identifier} `);
  await page.getByRole("textbox", { name: "PIN", exact: true }).fill(pin);
}
async function fillChange(
  page: Page,
  current = pin,
  next = "098765",
  repeat = next,
) {
  await page
    .getByRole("textbox", { name: "PIN actual", exact: true })
    .fill(current);
  await page
    .getByRole("textbox", { name: "PIN nuevo", exact: true })
    .fill(next);
  await page
    .getByRole("textbox", { name: "Repetir PIN nuevo", exact: true })
    .fill(repeat);
}
async function mockDestination(page: Page, path = destination) {
  await page.route(`${origin}${path}`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<h1>Acceso confirmado</h1>",
    }),
  );
}
async function expectNavigation(
  page: Page,
  click: () => Promise<unknown>,
  path = destination,
) {
  const document = page.waitForRequest(
    (request) =>
      request.isNavigationRequest() && request.url() === `${origin}${path}`,
  );
  await click();
  await document;
  await expect(page).toHaveURL(`${origin}${path}`);
  await expect(
    page.getByRole("heading", { name: "Acceso confirmado" }),
  ).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await session(page);
  await mockDestination(page);
});

for (const width of [390, 1280]) {
  test(`login correcto reutiliza campo numérico y navega con documento nuevo (${width})`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await login(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${origin}/acceso-equipo`);
    await expect(page).toHaveTitle("Acceso del equipo | CheckPass Club");
    await expect(
      page.getByText("Para el equipo", { exact: true }),
    ).toBeVisible();
    const field = page.getByRole("textbox", { name: "PIN", exact: true });
    for (const [attribute, value] of [
      ["inputmode", "numeric"],
      ["autocomplete", "one-time-code"],
      ["maxlength", "6"],
      ["pattern", "\\d{6}"],
    ])
      await expect(field).toHaveAttribute(attribute, value);
    await page
      .getByRole("textbox", { name: "Identificador", exact: true })
      .fill(identifier);
    await field.fill("12345a");
    await expect(
      page.getByRole("button", { name: "Entrar", exact: true }),
    ).toBeDisabled();
    await fillLogin(page);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`staff-login-${width}.png`),
      fullPage: true,
    });
    await expectNavigation(page, () =>
      page.getByRole("button", { name: "Entrar", exact: true }).click(),
    );
    expect(errors).toEqual([]);
  });

  test(`PIN temporal exige coincidencia y conserva errores antes del éxito (${width})`, async ({
    page,
  }, testInfo) => {
    await login(page, true);
    await page.setViewportSize({ width, height: 900 });
    let writes = 0;
    await page.route(`**/api/staff/${userId}/pin`, (route) => {
      writes++;
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toEqual({
        currentPin: pin,
        newPin: "098765",
      });
      return route.fulfill(
        writes === 1
          ? {
              status: 401,
              json: {
                code: "invalid_credentials",
                error: "El PIN actual no es correcto.",
              },
            }
          : { json: { ok: true, mustChangePin: false } },
      );
    });
    await page.goto(`${origin}/acceso-equipo`);
    await fillLogin(page);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Elige tu PIN", exact: true }),
    ).toBeFocused();
    await fillChange(page, pin, "098765", "098764");
    const save = page.getByRole("button", { name: "Guardar PIN y entrar" });
    await expect(save).toBeDisabled();
    await expect(page.getByText("Los PIN nuevos no coinciden.")).toBeVisible();
    expect(writes).toBe(0);
    await page
      .getByRole("textbox", { name: "Repetir PIN nuevo", exact: true })
      .fill("098765");
    await save.click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "El PIN actual no es correcto.",
    );
    await expect(
      page.getByRole("textbox", { name: "PIN nuevo", exact: true }),
    ).toHaveValue("098765");
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`staff-pin-${width}.png`),
      fullPage: true,
    });
    await expectNavigation(page, () => save.click());
    expect(writes).toBe(2);
  });
}

for (const [status, code, error] of [
  [400, "invalid_body", "Revisa el identificador y el PIN."],
  [401, "invalid_credentials", "El identificador o el PIN no son correctos."],
  [403, "staff_disabled", "Tu acceso está desactivado."],
] as const) {
  test(`login ${status} ${code} muestra el error recibido sin navegar`, async ({
    page,
  }) => {
    await page.route("**/api/merchant/auth/staff", (route) =>
      route.fulfill({ status, json: { code, error } }),
    );
    await page.goto(`${origin}/acceso-equipo`);
    await fillLogin(page);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      error,
    );
    await expect(page).toHaveURL(`${origin}/acceso-equipo`);
    await expect(
      page.getByRole("textbox", { name: "Identificador", exact: true }),
    ).toHaveValue(` ${identifier} `);
  });
}

for (const direct of [false, true]) {
  test(`429 pin_locked cuenta la espera y permite reintentar (${direct ? "PIN" : "login"})`, async ({
    page,
  }) => {
    await page.clock.install();
    let writes = 0;
    await login(page, true);
    const endpoint = direct
      ? `**/api/staff/${userId}/pin`
      : "**/api/merchant/auth/staff";
    await page.route(endpoint, (route) => {
      writes++;
      return route.fulfill(
        writes === 1
          ? {
              status: 429,
              json: {
                code: "pin_locked",
                error: "Demasiados intentos. Prueba más tarde.",
                retryAfterSeconds: 3,
              },
            }
          : direct
            ? { json: { ok: true, mustChangePin: false } }
            : {
                json: {
                  staff: { userId, mustChangePin: false, landing: destination },
                },
              },
      );
    });
    await mockDestination(page, "/backoffice");
    await page.goto(`${origin}/acceso-equipo${direct ? "?cambiar-pin=1" : ""}`);
    if (direct) await fillChange(page);
    else await fillLogin(page);
    const submit = page.getByRole("button", {
      name: direct ? "Guardar PIN y entrar" : "Entrar",
      exact: true,
    });
    await submit.click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Demasiados intentos. Prueba más tarde.",
    );
    await expect(
      page.getByText("Podrás reintentar en 3 segundos."),
    ).toBeVisible();
    await expect(submit).toBeDisabled();
    expect(writes).toBe(1);
    await page.clock.fastForward(4000);
    await expect(submit).toBeEnabled();
    await expectNavigation(
      page,
      () => submit.click(),
      direct ? "/backoffice" : destination,
    );
    expect(writes).toBe(2);
  });
}

for (const code of [
  "invalid_pin_format",
  "pin_unchanged",
  "staff_disabled",
] as const) {
  test(`cambio directo ${code} muestra el error sin perder los PIN`, async ({
    page,
  }) => {
    const error = `Error de PIN: ${code}`;
    await page.route(`**/api/staff/${userId}/pin`, (route) =>
      route.fulfill({
        status: code === "staff_disabled" ? 403 : 400,
        json: { code, error },
      }),
    );
    await page.goto(`${origin}/acceso-equipo?cambiar-pin=1`);
    await fillChange(page);
    await page.getByRole("button", { name: "Guardar PIN y entrar" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      error,
    );
    await expect(
      page.getByRole("textbox", { name: "PIN actual", exact: true }),
    ).toHaveValue(pin);
    await expect(
      page.getByRole("textbox", { name: "Repetir PIN nuevo", exact: true }),
    ).toHaveValue("098765");
  });
}

for (const [code, message] of [
  ["staff_disabled", "Tu acceso no está activado."],
  ["business_suspended", "El negocio está suspendido."],
  ["business_closed", "El negocio está cerrado."],
  ["payment_required", "El acceso del negocio está pendiente de pago."],
] as const) {
  test(`aviso ${code} encima del formulario`, async ({ page }) => {
    await page.goto(`${origin}/acceso-equipo?e=${code}`);
    await expect(page.getByRole("status")).toContainText(message);
    await expect(
      page.getByRole("textbox", { name: "Identificador", exact: true }),
    ).toBeVisible();
    const noticeBox = await page.getByRole("status").boundingBox();
    const inputBox = await page
      .getByRole("textbox", { name: "Identificador", exact: true })
      .boundingBox();
    expect(noticeBox!.y + noticeBox!.height).toBeLessThan(inputBox!.y);
  });
}

for (const direct of [false, true]) {
  test(`sin permisos muestra solo no activado (${direct ? "entrada directa" : "login"})`, async ({
    page,
  }) => {
    await session(page, []);
    await login(page, true);
    let pinWrites = 0;
    await page.route(`**/api/staff/${userId}/pin`, (route) => {
      pinWrites++;
      return route.fulfill({ json: { ok: true } });
    });
    await page.goto(`${origin}/acceso-equipo${direct ? "?cambiar-pin=1" : ""}`);
    if (!direct) {
      await fillLogin(page);
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
    }
    await expect(
      page.getByRole("heading", {
        name: "Tu acceso no está activado",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("button")).toHaveCount(0);
    expect(pinWrites).toBe(0);
    await expect(page).toHaveURL(/acceso-equipo/);
  });
}

test("cambio directo sin sesión no escribe y permite volver al ingreso", async ({
  page,
}) => {
  await session(page, [], false);
  await page.goto(`${origin}/acceso-equipo?cambiar-pin=1`);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Tu sesión venció.",
  );
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Volver al ingreso" }).click();
  await expect(page).toHaveURL(`${origin}/acceso-equipo`);
  await expect(
    page.getByRole("textbox", { name: "Identificador", exact: true }),
  ).toBeVisible();
});

test("destino incoherente no navega; fallo GET de sesión permite reintentar", async ({
  page,
}) => {
  await page.route("**/api/merchant/auth/staff", (route) =>
    route.fulfill({
      json: {
        staff: { userId, mustChangePin: false, landing: "https://example.com" },
      },
    }),
  );
  await page.goto(`${origin}/acceso-equipo`);
  await fillLogin(page);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "No pudimos confirmar el acceso.",
  );
  await expect(page).toHaveURL(`${origin}/acceso-equipo`);
  await page.route("**/api/merchant/session", (route) =>
    route.fulfill({ status: 503, json: { error: "Sesión no disponible" } }),
  );
  await page.goto(`${origin}/acceso-equipo?cambiar-pin=1`);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Sesión no disponible",
  );
  await session(page);
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "PIN actual", exact: true }),
  ).toBeVisible();
});

test("una solicitud en curso bloquea dobles envíos de credenciales", async ({
  page,
}) => {
  let requests = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/merchant/auth/staff", async (route) => {
    requests++;
    await pending;
    await route.fulfill({
      json: { staff: { userId, mustChangePin: false, landing: destination } },
    });
  });
  await page.goto(`${origin}/acceso-equipo`);
  await fillLogin(page);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect.poll(() => requests).toBe(1);
  await expect(
    page.getByRole("textbox", { name: "Identificador", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Entrar", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("main")
    .locator("form")
    .evaluate((form) => {
      (form as HTMLFormElement).requestSubmit();
      (form as HTMLFormElement).requestSubmit();
    });
  expect(requests).toBe(1);
  const document = page.waitForRequest(
    (request) =>
      request.isNavigationRequest() &&
      request.url() === `${origin}${destination}`,
  );
  release();
  await document;
  await expect(
    page.getByRole("heading", { name: "Acceso confirmado" }),
  ).toBeVisible();
  expect(requests).toBe(1);
});
