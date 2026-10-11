import { expect, test } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import path from "node:path";

// Una sola instancia de Next para las cuatro revisiones; CI la levanta sin DB.
// Para QA contra el dev abierto: PUBLIC_LANDING_TEST_URL=http://localhost:3003.
test.describe.configure({ mode: "serial" });
let landingURL: string;
let server: ChildProcess | undefined;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  if (process.env.PUBLIC_LANDING_TEST_URL) {
    landingURL = process.env.PUBLIC_LANDING_TEST_URL;
    return;
  }
  const reservation = createServer();
  await new Promise<void>((resolve) =>
    reservation.listen(0, "127.0.0.1", resolve),
  );
  const address = reservation.address();
  if (!address || typeof address === "string")
    throw new Error("Missing landing test port");
  const port = address.port;
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  landingURL = `http://localhost:${port}`;
  const publicDir = path.resolve("apps/public");
  const publicRequire = createRequire(path.join(publicDir, "package.json"));
  server = spawn(
    process.execPath,
    [
      publicRequire.resolve("next/dist/bin/next"),
      "dev",
      "--hostname",
      "localhost",
      "--port",
      String(port),
    ],
    {
      cwd: publicDir,
      env: {
        ...process.env,
        NODE_ENV: "development",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let startup = "";
  const capture = (chunk: Buffer) => {
    startup = (startup + chunk.toString()).slice(-6000);
  };
  server.stdout?.on("data", capture);
  server.stderr?.on("data", capture);
  server.on("error", (error) => {
    startup += error.message;
  });
  await expect
    .poll(
      async () => {
        if (server?.exitCode != null)
          throw new Error(`Landing server stopped: ${startup}`);
        try {
          return (
            await fetch(landingURL, { signal: AbortSignal.timeout(2000) })
          ).status;
        } catch {
          return 0;
        }
      },
      { timeout: 100_000, message: "Public landing server must start" },
    )
    .toBe(200);
});

test.afterAll(async () => {
  if (!server || server.exitCode != null) return;
  const stopped = new Promise<void>((resolve) =>
    server!.once("exit", () => resolve()),
  );
  server.kill("SIGTERM");
  await stopped;
});

for (const width of [390, 1440]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`home consumidores ${width}px ${colorScheme}: explicación, ejemplos y accesos`, async ({
      page,
    }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 960 });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      const response = await page.goto(landingURL);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Descubre lugares. Encuentra motivos para volver.",
      );
      await expect(page).toHaveTitle(/Descubre lugares y beneficios/);
      await expect(
        page.getByText("Ejemplo ilustrativo. No es una oferta vigente.", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator(".plan-card")).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: /descargar la app/i }),
      ).toHaveCount(0);
      const commercial = page
        .locator("header")
        .getByRole("link", { name: "Para tu negocio", exact: true });
      await expect(commercial).toHaveAttribute("href", "/negocios");
      await expect(
        page.getByRole("link", { name: "Conoce CheckPass para tu negocio" }),
      ).toHaveAttribute("href", "/negocios");
      await expect(
        page
          .locator("header")
          .getByRole("link", { name: "Mi pase", exact: true }),
      ).toHaveAttribute("href", /\/wallet$/);
      await expect(
        page.getByRole("link", { name: "Ver cómo funciona", exact: true }),
      ).toHaveAttribute("href", "#como-funciona");
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        /^https?:\/\/[^/]+\/?$/,
      );
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
        "content",
        /^https?:\/\/[^/]+\/?$/,
      );
      await page
        .getByRole("link", { name: "Ver cómo funciona", exact: true })
        .click();
      await expect(page).toHaveURL(/#como-funciona$/);
      await expect(
        page.getByRole("heading", { name: "Así funciona tu pase." }),
      ).toBeInViewport();
      await expect(page.locator(".consumer-how")).toContainText("compras");
      await page
        .getByText("¿Los puntos sirven en otros negocios?", { exact: true })
        .click();
      await expect(page.locator("details[open]")).toContainText("solo allí");
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: testInfo.outputPath(`consumer-${width}-${colorScheme}.png`),
        fullPage: true,
        animations: "disabled",
      });
      await page.locator(".consumer-hero").screenshot({
        path: testInfo.outputPath(`consumer-hero-${width}-${colorScheme}.png`),
      });
      await commercial.click();
      await expect(page).toHaveURL(landingURL + "/negocios");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Dale a tu próximo cliente un motivo para entrar.",
      );
      expect(errors).toEqual([]);
    });

    test(`landing ${width}px ${colorScheme}: red, planes, FAQ y diseño`, async ({
      page,
    }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 960 });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      const response = await page.goto(landingURL + "/negocios");
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Dale a tu próximo cliente un motivo para entrar.",
      );
      await expect(page).toHaveTitle(
        /Fidelización, marketing y punto de venta \| CheckPass Club/,
      );
      await expect(
        page.getByText("Descubre el programa de recompensas para tu negocio"),
      ).toBeVisible();
      await expect(page.locator("main > section")).toHaveCount(9);
      await expect(page.locator(".business-hero")).toContainText(
        "Llega a personas que compran cerca.",
      );
      await expect(
        page
          .locator(".business-hero")
          .getByRole("link", { name: "Pruébalo gratis 3 meses" }),
      ).toHaveAttribute("href", /\/es\/business\/onboarding$/);
      await expect(page.locator(".business-hero")).toContainText(
        "Ejemplo ilustrativo. No es una oferta vigente.",
      );
      const photo = page.locator(
        '.business-hero img[src*="negocios-bienvenida"]',
      );
      await expect(photo).toBeVisible();
      await expect
        .poll(() =>
          photo.evaluate((img) => (img as HTMLImageElement).naturalWidth > 0),
        )
        .toBe(true);
      expect(
        await page
          .locator("main > section[id]")
          .evaluateAll((sections) => sections.map((section) => section.id)),
      ).toEqual([
        "red",
        "programa",
        "beneficios",
        "como-funciona",
        "planes",
        "preguntas",
      ]);

      await expect(page.locator(".moment-card")).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "Escanea y se une" }),
      ).toBeVisible();
      await expect(page.locator(".plan-card").first()).toContainText("Conecta");
      await expect(page.locator(".plan-card").first()).toContainText("$20");
      await expect(page.locator(".plan-card").first()).toContainText(
        "Bienvenida y Venta cruzada",
      );
      await expect(page.locator(".plan-card").nth(1)).toContainText("Impulso");
      await expect(page.locator(".plan-card").nth(1)).toContainText("$45");
      await expect(page.locator(".plan-card").nth(1)).toContainText(
        "Hasta 3 locales",
      );
      await expect(
        page.getByRole("heading", { name: /^(Gratis|Plus)$/ }),
      ).toHaveCount(0);
      for (const link of await page
        .getByRole("link", { name: /Pruébalo gratis 3 meses/ })
        .all()) {
        await expect(link).toHaveAttribute(
          "href",
          /\/es\/business\/onboarding$/,
        );
      }
      await expect(page.locator(".trial-banner")).toContainText(
        "3 meses gratis · todo incluido",
      );
      await page
        .locator("summary")
        .filter({
          hasText: "¿Los puntos y sellos pueden usarse en otro negocio?",
        })
        .click();
      await expect(page.locator("details[open]")).toContainText(
        "se canjean solo allí",
      );
      await page
        .locator("summary")
        .filter({ hasText: "¿Qué pasa cuando termina la prueba?" })
        .click();
      await expect(
        page.locator("details[open]").filter({ hasText: "prueba" }),
      ).toContainText("los datos de tu negocio y tus clientes se conservan");
      await page
        .locator("summary")
        .filter({ hasText: "¿Mis clientes necesitan descargar una app?" })
        .click();
      await expect(
        page.locator("details[open]").filter({ hasText: "descargar" }),
      ).toContainText("No.");
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
      for (const selector of [".network-preview", ".pos-platform-preview"]) {
        const box = await page.locator(selector).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        if (width === 390) expect(box!.width).toBeGreaterThan(width * 0.75);
      }
      const background = await page
        .locator(".site-shell")
        .evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(background).toBe(
        colorScheme === "dark" ? "rgb(16, 35, 27)" : "rgb(250, 249, 245)",
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: testInfo.outputPath(`hero-${width}-${colorScheme}.png`),
        animations: "disabled",
      });
      await page.locator(".network-section").screenshot({
        path: testInfo.outputPath(`red-${width}-${colorScheme}.png`),
      });
      await page.locator(".feature-section").screenshot({
        path: testInfo.outputPath(`pos-${width}-${colorScheme}.png`),
      });
      await page.locator(".plans-section").screenshot({
        path: testInfo.outputPath(`planes-${width}-${colorScheme}.png`),
      });
      await page
        .locator("#contenido")
        .getByRole("link", { name: "Cómo funciona", exact: true })
        .click();
      await expect(page).toHaveURL(/#como-funciona$/);
      await expect(
        page.getByRole("heading", { name: "Prepara tu local" }),
      ).toBeInViewport();
      await expect(page).toHaveURL(/\/negocios#como-funciona$/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        /\/negocios$/,
      );
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
        "content",
        /\/negocios$/,
      );
      expect(errors).toEqual([]);
    });
  }
}

test("0197: enlaces entre audiencias, fichas y sitemap", async ({
  page,
  request,
}) => {
  for (const route of [
    "/programa-de-fidelizacion",
    "/marketing-para-comercios",
    "/punto-de-venta",
  ]) {
    await page.goto(landingURL + route);
    const plans = page
      .locator("header")
      .getByRole("link", { name: "Planes", exact: true });
    await expect(plans).toHaveAttribute("href", "/negocios#planes");
    await plans.click();
    await expect(page).toHaveURL(landingURL + "/negocios#planes");
    await expect(
      page.getByRole("heading", { name: /Prueba todo durante tres meses/ }),
    ).toBeInViewport();
  }
  await page.goto(landingURL + "/explorar");
  await expect(
    page.locator("header").getByRole("link", { name: "Para negocios" }),
  ).toHaveAttribute("href", "/negocios");
  await expect(
    page.getByText("Prototipo interactivo.", { exact: true }),
  ).toBeVisible();
  await page.locator(".explore-card-link").first().click();
  await expect(
    page.getByRole("link", { name: "Volver a explorar" }),
  ).toHaveAttribute("href", "/explorar#explorar");
  await expect(
    page.locator("header").getByRole("link", { name: "Para negocios" }),
  ).toHaveAttribute("href", "/negocios");
  await page.getByRole("link", { name: "Volver a explorar" }).click();
  await expect(page).toHaveURL(landingURL + "/explorar#explorar");
  await page.goto(landingURL + "/es/privacy");
  await expect(
    page.locator("header").getByRole("link", { name: "Para negocios" }),
  ).toHaveAttribute("href", "/negocios");
  const sitemap = await request.get(landingURL + "/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).toMatch(/<loc>https?:\/\/[^<]+\/negocios<\/loc>/);
  expect(xml).toMatch(/<loc>https?:\/\/[^/]+\/?<\/loc>/);
});
