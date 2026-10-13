import { expect, test } from "@playwright/test";
import { startWalletEntryHarness } from "./support/wallet-entry-server";

const ios =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const android =
  "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36";
const fixture = test.extend<{
  entry: Awaited<ReturnType<typeof startWalletEntryHarness>>;
}>({
  entry: async ({ browserName }, use) => {
    void browserName;
    const server = await startWalletEntryHarness();
    await use(server);
    await server.close();
  },
});

fixture(
  "login puro conserva proveedores y no inscribe",
  async ({ page, entry }) => {
    let posts = 0;
    page.on("request", (r) => {
      if (r.method() === "POST") posts++;
    });
    await page.goto(`${entry.url}/?surface=access&error=auth`);
    await expect(
      page.getByText(
        "Iniciar sesión en la wallet para acceder al pase y los beneficios.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("Intentar de nuevo");
    await expect(page.locator('[data-provider="google"]')).toHaveAttribute(
      "href",
      "/api/public/auth/google/start",
    );
    await expect(page.locator('[data-provider="apple"]')).toHaveAttribute(
      "href",
      "/api/public/auth/apple/start",
    );
    expect(posts).toBe(0);
  },
);

fixture(
  "invitación conserva programa/local y logo real",
  async ({ page, entry }) => {
    await page.goto(
      `${entry.url}/?surface=guest&loc=local%20uno&logo=1&welcome=1`,
    );
    await expect(
      page.getByRole("heading", { name: "Programa de Café del Barrio" }),
    ).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "Regalo de bienvenida" }),
    ).toContainText("sujeto a disponibilidad");
    await expect(page.locator("img")).toHaveAttribute(
      "src",
      "/api/public/brands/business-demo/logo?v=4",
    );
    await expect(page.locator('[data-provider="google"]')).toHaveAttribute(
      "href",
      "/api/public/auth/google/start?programId=demo-program&loc=local+uno",
    );
  },
);

fixture(
  "unirse es explícito, bloquea doble envío y navega con documento nuevo en201",
  async ({ page, entry }) => {
    let posts = 0;
    let release!: () => void;
    const pending = new Promise<void>((r) => {
      release = r;
    });
    await page.route("**/api/public/enroll/demo-program", async (route) => {
      posts++;
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toEqual({ loc: "local-1" });
      await pending;
      await route.fulfill({ status: 201, json: {} });
    });
    await page.goto(`${entry.url}/?surface=signed&loc=local-1`);
    expect(posts).toBe(0);
    const join = page.getByRole("button", { name: "Unirme al programa" });
    await join.click();
    await expect(page.getByRole("button", { name: "Uniendo…" })).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "No soy yo" }),
    ).toBeDisabled();
    expect(posts).toBe(1);
    release();
    await expect(page).toHaveURL(/\/enroll\/demo-program\/ready$/);
    await expect(
      page.getByRole("heading", { name: "¡Inscripción lista!" }),
    ).toBeVisible();
  },
);

for (const status of [401, 409, 503])
  fixture(`inscripción maneja${status}`, async ({ page, entry }) => {
    await page.route("**/api/public/enroll/demo-program", (route) =>
      route.fulfill({
        status,
        json: { error: "No pudimos registrar tu inscripción." },
      }),
    );
    await page.goto(`${entry.url}/?surface=signed&loc=local-1`);
    await page.getByRole("button", { name: "Unirme al programa" }).click();
    if (status === 401) {
      await expect(
        page.getByRole("heading", { name: "Programa de Café del Barrio" }),
      ).toBeVisible();
      await expect(page.locator('[data-provider="google"]')).toHaveAttribute(
        "href",
        /loc=local-1/,
      );
    } else if (status === 409) await expect(page).toHaveURL(/\/wallet$/);
    else {
      await expect(page.getByRole("alert")).toHaveText(
        "No pudimos registrar tu inscripción.",
      );
      await expect(
        page.getByRole("button", { name: "Unirme al programa" }),
      ).toBeEnabled();
    }
  });

fixture(
  "fallo de red permite reintentar y cambiar cuenta",
  async ({ page, entry }) => {
    await page.route("**/api/public/enroll/demo-program", (route) =>
      route.abort(),
    );
    await page.goto(`${entry.url}/?surface=signed`);
    await page.getByRole("button", { name: "Unirme al programa" }).click();
    await expect(page.getByRole("alert")).toContainText("problema de conexión");
    await page.getByRole("button", { name: "No soy yo" }).click();
    await expect(
      page.getByRole("heading", { name: "Programa de Café del Barrio" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Continuar con Google" }),
    ).toBeVisible();
  },
);

fixture(
  "ya miembro puede abrir pase o usar otra cuenta; programa ausente no invita",
  async ({ page, entry }) => {
    await page.goto(`${entry.url}/?surface=member`);
    await expect(
      page.getByRole("heading", {
        name: "Inscripción activa en Café del Barrio",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ver mi pase", exact: true }),
    ).toHaveAttribute("href", "/wallet");
    await expect(
      page.getByRole("button", { name: "Unirme al programa" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "No soy yo" }).click();
    await expect(
      page.getByRole("link", { name: "Continuar con Apple" }),
    ).toBeVisible();
    await page.goto(`${entry.url}/?surface=unavailable`);
    await expect(
      page.getByRole("heading", { name: "Este programa no está disponible" }),
    ).toBeVisible();
    await expect(page.locator("[data-provider]")).toHaveCount(0);
  },
);

fixture(
  "Android usa prompt real cuando está disponible y recupera rechazo/error",
  async ({ browser, entry }) => {
    const context = await browser.newContext({ userAgent: android });
    const page = await context.newPage();
    await page.goto(`${entry.url}/?surface=ready&welcome=1`);
    await page
      .getByRole("button", { name: "Cómo añadir CheckPass a mi inicio" })
      .click();
    await expect(page.getByText(/En Chrome, abrir el menú/)).toBeVisible();
    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt");
      Object.assign(event, {
        prompt: async () => {},
        userChoice: Promise.resolve({ outcome: "dismissed" }),
      });
      window.dispatchEvent(event);
    });
    await page
      .getByRole("button", {
        name: "Añadir CheckPass a mi inicio",
        exact: true,
      })
      .click();
    await expect(page.getByText(/En Chrome, abrir el menú/)).toBeVisible();
    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt");
      Object.assign(event, {
        prompt: async () => {
          throw new Error("unavailable");
        },
        userChoice: Promise.resolve({ outcome: "dismissed" }),
      });
      window.dispatchEvent(event);
    });
    await page
      .getByRole("button", {
        name: "Añadir CheckPass a mi inicio",
        exact: true,
      })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "No pudimos abrir la instalación",
    );
    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    await expect(page.getByRole("status")).toContainText(
      "ya está en la pantalla de inicio",
    );
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("button")).toHaveCount(0);
    await context.close();
  },
);

fixture(
  "iOS y standalone conservan instrucciones y enlace al pase",
  async ({ browser, entry }) => {
    const context = await browser.newContext({ userAgent: ios });
    const page = await context.newPage();
    await page.goto(`${entry.url}/?surface=ready`);
    await expect(page.getByRole("list")).toContainText("Compartir");
    await expect(
      page.getByRole("link", { name: "Ver mi pase ahora" }),
    ).toHaveAttribute("href", "/wallet");
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "standalone", { value: true });
    });
    await page.reload();
    await expect(page.getByRole("status")).toContainText(
      "ya está en la pantalla de inicio",
    );
    await expect(page.getByRole("list")).toHaveCount(0);
    await context.close();
  },
);

fixture(
  "capturas y overflow mobile first",
  async ({ browser, entry }, testInfo) => {
    const context = await browser.newContext({ userAgent: ios });
    const page = await context.newPage();
    for (const width of [320, 360, 390, 430, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      for (const surface of [
        "access",
        "guest",
        "signed",
        "ready",
        "member",
        "unavailable",
      ]) {
        await page.goto(`${entry.url}/?surface=${surface}`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${surface} ${width}`,
        ).toBe(true);
        if (width === 390 || width === 1440)
          await page.screenshot({
            path: testInfo.outputPath(`${surface}-${width}.png`),
            fullPage: true,
          });
      }
    }
    await page.goto(
      `${entry.url}/?surface=signed&business=${encodeURIComponent("Panadería y Café del Centro Histórico de la Ciudad")}&name=Mar%C3%ADa%20Fernanda`,
    );
    await page.setViewportSize({ width: 320, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await context.close();
  },
);
