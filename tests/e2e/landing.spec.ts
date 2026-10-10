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
    test(`landing ${width}px ${colorScheme}: red, planes, FAQ y diseño`, async ({
      page,
    }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 960 });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto(landingURL);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Más clientes nuevos. Más razones para volver.",
      );
      await expect(page).toHaveTitle(
        /Red de fidelización para comercios en Cuenca/,
      );
      const networkLink = page.getByRole("link", {
        name: "Explora la red en Cuenca",
      });
      await expect(networkLink).toHaveAttribute("href", "/explorar");
      await expect(page.locator("main > section")).toHaveCount(10);
      await expect(page.locator(".moment-card")).toHaveCount(6);
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
        .filter({ hasText: "¿Los puntos sirven en otros comercios?" })
        .click();
      await expect(page.locator("details[open]")).toContainText(
        "se canjean solo allí",
      );
      await page
        .locator("summary")
        .filter({ hasText: "¿Qué pasa al terminar los tres meses de prueba?" })
        .click();
      await expect(
        page.locator("details[open]").filter({ hasText: "prueba" }),
      ).toContainText("antes de contratar");
      await page
        .locator("summary")
        .filter({ hasText: "¿Mi cliente necesita descargar una app?" })
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
      for (const selector of [
        ".network-preview",
        ".dashboard-preview",
        ".customer-pass",
      ]) {
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
      await page.getByRole("link", { name: "Descubre cómo funciona" }).click();
      await expect(page).toHaveURL(/#como-funciona$/);
      await expect(
        page.getByRole("heading", { name: "Prepara tu negocio" }),
      ).toBeInViewport();
      await page.goto(`${landingURL}/negocios`);
      await expect(page).toHaveURL(`${landingURL}/`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
}
