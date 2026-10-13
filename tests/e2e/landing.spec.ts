import { expect, test, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import path from "node:path";
// Spec 0205: el destino del alta sale de la MISMA config que arma los enlaces de la landing.
import { onboardingUrl } from "../../apps/public/src/app/site-config";

// Una sola instancia de Next para las cuatro revisiones; CI la levanta sin DB.
// Para QA contra el dev abierto: PUBLIC_LANDING_TEST_URL=http://localhost:3003.
test.describe.configure({ mode: "serial" });
test.beforeEach(() => {
  // El presupuesto incluye preparación en frío; las comprobaciones conservan sus umbrales.
  test.setTimeout(120_000);
});
let landingURL: string;
let server: ChildProcess | undefined;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  if (process.env.PUBLIC_LANDING_TEST_URL) {
    landingURL = process.env.PUBLIC_LANDING_TEST_URL;
    await warmUp(landingURL);
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
  await warmUp(landingURL);
});

/**
 * `next dev` compila cada pagina y optimiza cada imagen en su PRIMER pedido. En un arbol frio
 * (worktree nuevo, pre-push) la primera visita a `/negocios` paso los 30 s del test esperando
 * `load` (rojo en el pre-push, 2026-10-11). Se paga aca, dentro del `beforeAll` (240 s), y no
 * dentro del primer test que la toque.
 */
async function warmUp(base: string) {
  for (const route of [
    "/",
    "/negocios",
    "/marketing-para-comercios",
    "/programa-de-fidelizacion",
    "/explorar",
    "/punto-de-venta",
    "/es/privacy",
  ]) {
    const html = await (
      await fetch(base + route, { signal: AbortSignal.timeout(60_000) })
    ).text();
    // Todo `/_next/image?...` del HTML: `src` y cada entrada del `srcset`.
    const images = new Set(
      [...html.matchAll(/\/_next\/image\?[^"\s,]+/g)].map((match) =>
        match[0].replaceAll("&amp;", "&"),
      ),
    );
    await Promise.all(
      [...images].map((image) =>
        fetch(base + image, { signal: AbortSignal.timeout(60_000) }).catch(
          () => undefined,
        ),
      ),
    );
  }
}

/** Espera el documento y su presentación, sin depender del evento load de imágenes. */
async function gotoReady(page: Page, url: string) {
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          [
            ...document.querySelectorAll<HTMLLinkElement>(
              'link[rel="stylesheet"]',
            ),
          ].every((link) => link.sheet !== null),
        ),
      { message: "Los estilos de la página deben estar cargados" },
    )
    .toBe(true);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  return response;
}

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
      const response = await gotoReady(page, landingURL);
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
      await expect(page.locator(".consumer-content > section")).toHaveCount(5);
      const passPreview = page.getByRole("group", {
        name: "Ejemplo ilustrativo de un pase",
      });
      await expect(passPreview).toContainText("Café de ejemplo");
      await expect(passPreview).toContainText(
        "Cada comercio lleva su propio saldo",
      );
      await expect(page.locator(".consumer-example")).toContainText(
        "Ejemplo: 6 sellos → un café",
      );
      await expect(page.locator(".consumer-example-stamps > span")).toHaveCount(
        6,
      );
      await expect(
        page.getByRole("link", { name: "Ir a mi pase", exact: true }),
      ).toHaveAttribute("href", /\/wallet$/);

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
      const response = await gotoReady(page, landingURL + "/negocios");
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
      await expect(page.locator("main > section")).toHaveCount(8);
      await expect(page.locator(".business-hero")).toContainText(
        "Llega a personas que compran cerca.",
      );
      await expect(
        page
          .locator(".business-hero")
          .getByRole("link", { name: "Pruébalo gratis 3 meses" }),
      ).toHaveAttribute("href", onboardingUrl);
      await expect(page.locator("body")).not.toContainText(/ejemplo/i);
      await expect(page.locator(".barrio-shop")).toHaveCount(4);
      await expect(
        page.locator(".barrio-shop").filter({ hasText: "Café" }),
      ).toContainText("Café");
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
        page.getByRole("heading", { name: "Dales razones para volver." }),
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
      const planPresentation = await page
        .locator(".barrio-plan")
        .evaluateAll((plans) =>
          plans.map((plan) => ({
            background: getComputedStyle(plan).backgroundColor,
            priceColor: getComputedStyle(
              plan.querySelector(".barrio-plan-price strong")!,
            ).color,
            items: [...plan.querySelectorAll("li")].map((item) => ({
              x: item.getBoundingClientRect().x,
              y: item.getBoundingClientRect().y,
            })),
          })),
        );
      expect(planPresentation[0].background).not.toBe(
        planPresentation[1].background,
      );
      expect(planPresentation[0].priceColor).not.toBe(
        planPresentation[1].priceColor,
      );
      for (const plan of planPresentation) {
        expect(new Set(plan.items.map((item) => item.x)).size).toBe(1);
        expect(
          plan.items.every(
            (item, index, items) => index === 0 || item.y > items[index - 1].y,
          ),
        ).toBe(true);
      }
      const heroCopy = await page.locator(".business-hero-copy").boundingBox();
      const heroScene = await page
        .locator(".business-hero-scene")
        .boundingBox();
      expect(heroCopy).not.toBeNull();
      expect(heroScene).not.toBeNull();
      if (width === 390) {
        expect(heroCopy!.y + heroCopy!.height).toBeLessThanOrEqual(
          heroScene!.y,
        );
      } else {
        expect(heroCopy!.x + heroCopy!.width).toBeLessThanOrEqual(heroScene!.x);
      }
      await expect(
        page.getByRole("heading", { name: /^(Gratis|Plus)$/ }),
      ).toHaveCount(0);
      for (const link of await page
        .getByRole("link", { name: /Pruébalo gratis 3 meses/ })
        .all()) {
        await expect(link).toHaveAttribute("href", onboardingUrl);
      }
      await expect(page.locator(".business-assurance")).toContainText(
        "Todo incluido durante la prueba.",
      );
      await page
        .locator("summary")
        .filter({
          hasText: "¿Quién decide los premios y beneficios?",
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
      for (const selector of [".barrio-map", ".barrio-service-visual"]) {
        const element = page.locator(selector);
        await expect(element).toBeVisible();
        await expect
          .poll(async () => (await element.boundingBox())?.x ?? -1)
          .toBeGreaterThanOrEqual(0);
        await expect
          .poll(async () => {
            const box = await element.boundingBox();
            return box ? box.x + box.width : Infinity;
          })
          .toBeLessThanOrEqual(width);
        if (width === 390)
          await expect
            .poll(async () => (await element.boundingBox())?.width ?? 0)
            .toBeGreaterThan(width * 0.75);
      }
      for (const scene of await page
        .locator(".barrio-map img, .barrio-reward img, .barrio-attention img")
        .all()) {
        // Next Image carga bajo demanda: activa cada imagen antes de medir su ancho natural.
        await scene.scrollIntoViewIfNeeded();
        // `next dev` optimiza cada imagen en su primer pedido: con el cache frio tarda mas que
        // los 5 s por defecto (rojo intermitente en el pre-push, 2026-10-11).
        await expect
          .poll(
            () =>
              scene.evaluate((img) => (img as HTMLImageElement).naturalWidth),
            { timeout: 60_000 },
          )
          .toBeGreaterThan(0);
      }
      await expect(page.locator(".barrio-pos-panels")).toContainText("$5");
      await expect(page.locator(".barrio-plan-notes")).toContainText(
        "Local adicional: $12",
      );
      const background = await page
        .locator(".site-shell")
        .evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(background).toBe(
        colorScheme === "dark" ? "rgb(16, 35, 27)" : "rgb(255, 255, 255)",
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: testInfo.outputPath(`hero-${width}-${colorScheme}.png`),
        animations: "disabled",
      });
      await page.locator(".barrio-network").screenshot({
        path: testInfo.outputPath(`red-${width}-${colorScheme}.png`),
      });
      await page.locator(".barrio-service").screenshot({
        path: testInfo.outputPath(`pos-${width}-${colorScheme}.png`),
      });
      await page.locator(".barrio-plans").screenshot({
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

for (const width of [390, 1440]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`marketing ${width}px ${colorScheme}: audiencia, condiciones y acceso`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 960 });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      const response = await gotoReady(
        page,
        `${landingURL}/marketing-para-comercios`,
      );
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "Invita a nuevos clientes",
      );
      expect(
        await page
          .locator("#marketing-title")
          .evaluate((e) => getComputedStyle(e).fontFamily),
      ).toMatch(/^Arial/);
      expect(
        await page
          .locator(".final-cta")
          .evaluate((e) => e.getBoundingClientRect().height),
      ).toBeLessThan(400);
      await expect(page).toHaveTitle(/Marketing automático para comercios/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        /\/marketing-para-comercios$/,
      );
      await expect(
        page.getByRole("figure", {
          name: "Ejemplo ilustrativo de una campaña de Bienvenida",
        }),
      ).toContainText("cuándo se puede canjear");
      await page
        .getByRole("link", { name: "Conoce las campañas", exact: true })
        .click();
      await expect(page).toHaveURL(/#campanas$/);
      await expect(page.locator("#campaigns-title")).toBeInViewport();
      const welcome = page.getByRole("article", {
        name: "Bienvenida",
        exact: true,
      });
      const cross = page.getByRole("article", {
        name: "Venta cruzada",
        exact: true,
      });
      await expect(welcome).toContainText(
        "personas que se inscriben en tu programa",
      );
      await expect(cross).toContainText("otros comercios participantes");
      await expect(cross).toContainText("rubros distintos");
      await expect(cross).toContainText("2 km");
      await expect(cross).toContainText("depende de las condiciones");
      await expect(page.locator(".marketing-plan-note")).toContainText(
        "Conecta e Impulso",
      );
      await expect(page.locator(".marketing-advanced")).toContainText(
        "Impulso añade campañas",
      );
      await expect(
        page.getByRole("link", { name: "Compara los planes" }),
      ).toHaveAttribute("href", "/negocios#planes");
      await expect(page.locator("details")).toHaveCount(6);
      await page
        .getByText("¿Dónde ve el cliente su beneficio?", { exact: true })
        .click();
      await expect(page.locator("details[open]")).toContainText(
        "activar las notificaciones",
      );
      await expect(page.locator("details[open]")).toContainText(
        "no envían mensajes de WhatsApp ni correos electrónicos",
      );
      await page
        .getByText("¿Necesito usar el punto de venta?", { exact: true })
        .click();
      await expect(page.locator("details[open]").last()).toContainText("No.");
      for (const link of await page
        .getByRole("link", { name: /^Pruébalo gratis/ })
        .all()) {
        await expect(link).toHaveAttribute("href", onboardingUrl);
      }
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      expect(errors).toEqual([]);
    });
  }
}

for (const width of [390, 1440]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`fidelización ${width}px ${colorScheme}: reglas, previsión y autonomía`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 960 });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      const response = await gotoReady(
        page,
        `${landingURL}/programa-de-fidelizacion`,
      );
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "Puntos o sellos",
      );
      expect(
        await page
          .locator("#program-title")
          .evaluate((e) => getComputedStyle(e).fontFamily),
      ).toMatch(/^Arial/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        /\/programa-de-fidelizacion$/,
      );
      await page
        .getByRole("link", { name: "Cómo funciona", exact: true })
        .click();
      await expect(page).toHaveURL(/#tu-programa$/);
      await expect(page.locator("#story-title")).toBeInViewport();
      await expect(page.locator(".program-modes")).toContainText(
        "Por compra o por importe consumido",
      );
      await expect(page.locator(".program-modes")).toContainText(
        "cuántos vale cada recompensa",
      );
      await expect(page.locator(".program-stamps")).toHaveAccessibleName(
        "3 de 6 sellos acumulados",
      );
      const forecast = page.getByRole("figure", {
        name: "Comparación ilustrativa de consumo y precio de venta del premio",
      });
      await expect(forecast).toContainText("$30");
      await expect(forecast).toContainText("$3");
      await expect(forecast).toContainText("Precio de venta");
      await expect(forecast).not.toContainText("$27");
      await expect(forecast).not.toContainText("quedan");
      await expect(page.locator(".program-history")).toContainText(
        "Productos habituales en Mostrador",
      );
      await expect(page.locator(".program-account-map")).toContainText(
        "no se mezclan",
      );
      await expect(page.locator(".program-assurances")).toContainText(
        "Otros comercios no ven su actividad",
      );
      await expect(page.locator(".program-future")).toContainText(
        "Próximamente",
      );
      await expect(page.locator("details")).toHaveCount(7);
      await page
        .getByText("¿Qué me dice la previsión?", { exact: true })
        .click();
      await expect(page.locator("details[open]")).toContainText(
        "no predice ventas futuras ni calcula el margen",
      );
      await page
        .getByText("¿Está disponible el cashback?", { exact: true })
        .click();
      await expect(page.locator("details[open]").last()).toContainText(
        "Todavía no",
      );
      for (const link of await page
        .getByRole("link", { name: /^Pruébalo gratis/ })
        .all()) {
        await expect(link).toHaveAttribute("href", onboardingUrl);
      }
      await expect(
        page.getByRole("link", { name: "Consulta los planes", exact: true }),
      ).toHaveAttribute("href", "/negocios#planes");
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
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
    await gotoReady(page, landingURL + route);
    const plans = page
      .locator("header")
      .getByRole("link", { name: "Planes", exact: true });
    await expect(plans).toHaveAttribute("href", "/negocios#planes");
    await plans.click();
    await expect(page).toHaveURL(landingURL + "/negocios#planes");
    await expect(
      page.getByRole("heading", {
        name: /Planes para hacer crecer tu negocio/,
      }),
    ).toBeInViewport();
  }
  await gotoReady(page, landingURL + "/explorar");
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
  await gotoReady(page, landingURL + "/es/privacy");
  await expect(
    page.locator("header").getByRole("link", { name: "Para negocios" }),
  ).toHaveAttribute("href", "/negocios");
  const sitemap = await request.get(landingURL + "/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).toMatch(/<loc>https?:\/\/[^<]+\/negocios<\/loc>/);
  expect(xml).toMatch(/<loc>https?:\/\/[^/]+\/?<\/loc>/);
});
