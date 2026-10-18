import { expect, test } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
import type { BackofficeFixtureApi } from "./support/backoffice-context-fixture";
import type { AnalyticsInboxResponse } from "../../packages/domain/src/analytics/types";
import { businessModules } from "./support/modules-fixture";

let harness: Awaited<ReturnType<typeof startCatalogHarness>>;
test.beforeAll(async () => {
  harness = await startCatalogHarness(
    "tests/e2e/support/backoffice-context-fixture.tsx",
    "analytics",
  );
});
test.afterAll(async () => {
  await harness.close();
});
test.beforeEach(async ({ page }) => {
  await page.route("**/api/merchant/session", (route) =>
    route.fulfill({
      json: {
        authenticated: true,
        user: {
          id: "fixture-user",
          name: "Fixture",
          email: "fixture@example.invalid",
          emailVerified: true,
        },
        business: {
          id: "fixture-business",
          name: "Comercio sintético",
          status: "active",
          slug: "fixture",
          suspensionReason: null,
          timezone: "America/Guayaquil",
          currencyCode: "USD",
          enabledModules: ["stock"],
        },
        membership: {
          role: "owner",
          status: "active",
          permissions: ["analytics", "stock"],
        },
        billing: { access: "trial", trialDaysLeft: 10, trialEndsAt: null },
      },
    }),
  );
  await page.route("**/api/modules", (route) =>
    route.fulfill({ status: 503, json: { error: "Synthetic unavailable" } }),
  );
  const emptyInbox: AnalyticsInboxResponse = {
    contractVersion: 2,
    policyVersion: "synthetic-0238",
    state: "ready",
    preparedAt: "2026-10-18T00:00:00.000Z",
    cards: [],
    timezone: "UTC",
    nextReminderAt: null,
    refreshAfterMs: null,
  };
  await page.route("**/api/analytics/inbox", (route) =>
    route.fulfill({
      json: emptyInbox,
    }),
  );
});

for (const width of [390, 1280]) {
  test(`seed directo listo evita GET auxiliares y conserva UI (${width})`, async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/"))
        requests.push(new URL(request.url()).pathname);
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${harness.url}?modules=ready&fixturePath=/backoffice`);
    await expect(
      page.getByText("Hoy no tengo nada para avisarte."),
    ).toBeVisible();
    await expect(
      page.getByText("Prueba de CheckPass: quedan 10 días"),
    ).toBeVisible();
    if (width === 390)
      await page.getByRole("button", { name: "Negocio", exact: true }).click();
    await expect(
      page.getByRole("link", { name: "Stock", exact: true }),
    ).toBeVisible();
    expect(
      requests.filter((path) => path === "/api/analytics/inbox"),
    ).toHaveLength(1);
    expect(
      requests.filter(
        (path) => path === "/api/modules" || path === "/api/merchant/session",
      ),
    ).toHaveLength(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("módulos pendientes no bloquean Inbox/core y el seed tardío se aplica", async ({
  page,
}) => {
  await page.goto(`${harness.url}?fixturePath=/backoffice`);
  await expect(
    page.getByText("Hoy no tengo nada para avisarte."),
  ).toBeVisible();
  await expect(page.getByText("Contenido privado sintético")).toBeVisible();
  await expect(page.getByLabel("Estado módulos")).toHaveText("loading");
  await expect(
    page.getByRole("link", { name: "Stock", exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() =>
    (
      window as unknown as { backofficeFixture: BackofficeFixtureApi }
    ).backofficeFixture.resolveModules("ready"),
  );
  await expect(
    page.getByRole("link", { name: "Stock", exact: true }),
  ).toBeVisible();
});

for (const result of ["unavailable", "restricted", "reject"] as const) {
  test(`módulos ${result} preservan el core con recuperación inicial acotada`, async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/"))
        requests.push(new URL(request.url()).pathname);
    });
    await page.goto(`${harness.url}?fixturePath=/backoffice`);
    await expect(
      page.getByText("Hoy no tengo nada para avisarte."),
    ).toBeVisible();
    await page.evaluate((state) => {
      const api = (
        window as unknown as { backofficeFixture: BackofficeFixtureApi }
      ).backofficeFixture;
      if (state === "reject") api.rejectModules();
      else api.resolveModules(state);
    }, result);
    await expect(page.getByLabel("Estado módulos")).toHaveText(
      result === "reject" ? "unavailable" : result,
    );
    await expect(page.getByText("Contenido privado sintético")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Stock", exact: true }),
    ).toHaveCount(0);
    expect(
      requests.filter((path) => path === "/api/merchant/session"),
    ).toHaveLength(0);
    if (result === "restricted")
      expect(requests.filter((path) => path === "/api/modules")).toHaveLength(
        0,
      );
    else
      await expect
        .poll(() => requests.filter((path) => path === "/api/modules").length)
        .toBe(1);
  });
}

for (const action of ["retire", "changeIdentity"] as const) {
  test(`retirada ${action} oculta privados y seed tardío no revive el ámbito`, async ({
    page,
  }) => {
    await page.goto(`${harness.url}?fixturePath=/backoffice`);
    await expect(page.getByText("Contenido privado sintético")).toBeVisible();
    await page.waitForFunction(
      () =>
        (window as unknown as { backofficeFixture: BackofficeFixtureApi })
          .backofficeFixture.ready,
    );
    await page.evaluate((method) => {
      (
        window as unknown as { backofficeFixture: BackofficeFixtureApi }
      ).backofficeFixture[method]();
    }, action);
    await expect(page.getByText("Contenido privado sintético")).toHaveCount(0);
    await expect(
      page.getByText("Hoy no tengo nada para avisarte."),
    ).toHaveCount(0);
    await page.evaluate(() => {
      const api = (
        window as unknown as { backofficeFixture: BackofficeFixtureApi }
      ).backofficeFixture;
      api.resolveModules("ready");
      api.lateSeed();
    });
    await expect(
      page.getByRole("link", { name: "Stock", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Comercio sintético", { exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { backofficeFixture: BackofficeFixtureApi })
            .backofficeFixture.navigations,
      ),
    ).toEqual(["/backoffice"]);
  });
}

test("0238 invalidación durante stream recupera módulos sin aceptar seed viejo ni cargar sesión", async ({
  page,
}) => {
  const scoped: string[] = [];
  await page.route("**/api/modules", (route) => {
    scoped.push(route.request().headers()["x-backoffice-scope"]);
    return route.fulfill({ json: { modules: businessModules(true, false) } });
  });
  const sessionReads: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/merchant/session")
      sessionReads.push(request.url());
  });
  await page.goto(`${harness.url}?fixturePath=/backoffice`);
  await expect(
    page.getByText("Hoy no tengo nada para avisarte."),
  ).toBeVisible();
  await page.evaluate(() =>
    (
      window as unknown as { backofficeFixture: BackofficeFixtureApi }
    ).backofficeFixture.invalidateInbox(),
  );
  await expect(
    page.getByRole("link", { name: "Stock", exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    (
      window as unknown as { backofficeFixture: BackofficeFixtureApi }
    ).backofficeFixture.resolveModules("restricted"),
  );
  await expect(page.getByLabel("Estado módulos")).toHaveText("ready");
  expect(scoped).toEqual(["a".repeat(64)]);
  expect(sessionReads).toHaveLength(0);
});

test("0238 scope409 retira privados y navega una sola vez sin repetir lecturas", async ({
  page,
}) => {
  let moduleReads = 0;
  await page.route("**/api/modules", (route) => {
    moduleReads += 1;
    expect(route.request().headers()["x-backoffice-scope"]).toBe(
      "a".repeat(64),
    );
    return route.fulfill({
      status: 409,
      json: {
        code: "backoffice_context_changed",
        error: "Tu sesión cambió. Actualiza el panel para continuar.",
      },
    });
  });
  await page.goto(`${harness.url}?modules=ready&fixturePath=/backoffice`);
  await expect(
    page.getByRole("link", { name: "Stock", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(new Event("business-modules-changed"));
    window.dispatchEvent(new Event("checkpass:modules-changed"));
  });
  await expect(page.getByText("Contenido privado sintético")).toHaveCount(0);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("business-modules-changed")),
  );
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { backofficeFixture: BackofficeFixtureApi })
          .backofficeFixture.navigations,
    ),
  ).toEqual(["/backoffice"]);
  expect(moduleReads).toBe(1);
});

const inboxCard: AnalyticsInboxResponse["cards"][number] = {
  id: "fixture-card",
  version: "c".repeat(64),
  category: "informational",
  expiresAt: "2099-01-01T00:00:00.000Z",
  period: { from: "2026-01-01", to: "2026-01-02", label: "Fixture" },
  decisions: [{ key: "seen", label: "Entendido" }],
  cardKey: "fixture",
  sender: "Fixture",
  title: "Aviso accionable sintético",
  body: "Contenido del aviso",
  amountAtStake: null,
  quality: "observed",
  action: null,
};
const inboxEnvelope = (cards = [inboxCard]): AnalyticsInboxResponse => ({
  contractVersion: 2,
  policyVersion: "synthetic-0238",
  timezone: "UTC",
  state: "ready",
  preparedAt: null,
  nextReminderAt: null,
  refreshAfterMs: null,
  cards,
});

test("0238 StrictMode y dos lectores comparten un GET Inbox scoped", async ({
  page,
}) => {
  const reads: string[] = [];
  await page.route("**/api/analytics/inbox", (route) => {
    reads.push(route.request().headers()["x-backoffice-scope"]);
    return route.fulfill({ json: inboxEnvelope() });
  });
  await page.goto(
    `${harness.url}?modules=ready&readers=2&strict&fixturePath=/backoffice`,
  );
  await expect(
    page.getByRole("heading", { name: inboxCard.title }),
  ).toHaveCount(2);
  expect(reads).toEqual(["a".repeat(64)]);
  await page.evaluate(() =>
    (
      window as unknown as { backofficeFixture: BackofficeFixtureApi }
    ).backofficeFixture.setInboxReaders(1),
  );
  await expect(
    page.getByRole("heading", { name: inboxCard.title }),
  ).toHaveCount(1);
  expect(reads).toHaveLength(1);
});

test("0238 POST Inbox scoped + foco/remount conserva una cola y recupera módulos pendientes sin seed viejo", async ({
  page,
}) => {
  const reads: string[] = [];
  const writes: { scope: string; body: Record<string, unknown> }[] = [];
  let saved = false;
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  await page.route("**/api/analytics/inbox", (route) => {
    reads.push(route.request().headers()["x-backoffice-scope"]);
    return route.fulfill({ json: inboxEnvelope(saved ? [] : [inboxCard]) });
  });
  const moduleReads: string[] = [];
  await page.route("**/api/modules", (route) => {
    moduleReads.push(route.request().headers()["x-backoffice-scope"]);
    return route.fulfill({ json: { modules: businessModules(true, false) } });
  });
  await page.route(
    "**/api/analytics/inbox/fixture-card/seen",
    async (route) => {
      writes.push({
        scope: route.request().headers()["x-backoffice-scope"],
        body: route.request().postDataJSON(),
      });
      await gate;
      saved = true;
      await route.fulfill({ json: { cards: [], nextReminderAt: null } });
    },
  );
  await page.goto(`${harness.url}?fixturePath=/backoffice`);
  await page.getByRole("button", { name: "Entendido", exact: true }).click();
  await expect.poll(() => writes.length).toBe(1);
  await page.evaluate(() => {
    const api = (
      window as unknown as { backofficeFixture: BackofficeFixtureApi }
    ).backofficeFixture;
    for (let i = 0; i < 5; i++) window.dispatchEvent(new Event("focus"));
    api.setInboxReaders(0);
  });
  await expect(
    page.getByRole("heading", { name: "Hoy en tu negocio" }),
  ).toHaveCount(0);
  await page.evaluate(() =>
    (
      window as unknown as { backofficeFixture: BackofficeFixtureApi }
    ).backofficeFixture.setInboxReaders(1),
  );
  await expect(
    page.getByRole("button", { name: "Entendido", exact: true }),
  ).toBeDisabled();
  expect(reads).toHaveLength(1);
  release();
  await expect(
    page.getByText("Hoy no tengo nada para avisarte."),
  ).toBeVisible();
  await expect.poll(() => reads.length).toBe(2);
  expect(reads).toEqual(["a".repeat(64), "a".repeat(64)]);
  expect(writes).toEqual([
    {
      scope: "a".repeat(64),
      body: {
        expectedVersion: inboxCard.version,
        operationId: expect.any(String),
      },
    },
  ]);
  expect(moduleReads).toEqual(["a".repeat(64)]);
  await page.evaluate(() =>
    (
      window as unknown as { backofficeFixture: BackofficeFixtureApi }
    ).backofficeFixture.resolveModules("restricted"),
  );
  await expect(page.getByLabel("Estado módulos")).toHaveText("ready");
  await expect(
    page.getByRole("link", { name: "Stock", exact: true }),
  ).toBeVisible();
});

test("0238 scope409 de decisión retira todos los privados y no reenvía POST", async ({
  page,
}) => {
  const writes: string[] = [];
  let reads = 0;
  await page.route("**/api/analytics/inbox", (route) => {
    reads += 1;
    return route.fulfill({ json: inboxEnvelope() });
  });
  await page.route("**/api/analytics/inbox/fixture-card/seen", (route) => {
    writes.push(route.request().headers()["x-backoffice-scope"]);
    return route.fulfill({
      status: 409,
      json: { error: "Context changed", code: "backoffice_context_changed" },
    });
  });
  await page.goto(`${harness.url}?modules=ready&fixturePath=/backoffice`);
  await page.getByRole("button", { name: "Entendido", exact: true }).click();
  await expect(page.getByText("Contenido privado sintético")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: inboxCard.title }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    (
      window as unknown as { backofficeFixture: BackofficeFixtureApi }
    ).backofficeFixture.lateSeed();
  });
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { backofficeFixture: BackofficeFixtureApi })
          .backofficeFixture.navigations,
    ),
  ).toEqual(["/backoffice"]);
  expect(writes).toEqual(["a".repeat(64)]);
  expect(reads).toBe(1);
});

test("0238 fallo ambiguo conserva operationId/version sólo para reintento explícito", async ({
  page,
}) => {
  const commands: Record<string, unknown>[] = [];
  const scopes: string[] = [];
  await page.route("**/api/analytics/inbox", (route) =>
    route.fulfill({ json: inboxEnvelope() }),
  );
  await page.route("**/api/analytics/inbox/fixture-card/seen", (route) => {
    commands.push(route.request().postDataJSON());
    scopes.push(route.request().headers()["x-backoffice-scope"]);
    return commands.length === 1
      ? route.abort("failed")
      : route.fulfill({ json: { cards: [], nextReminderAt: null } });
  });
  await page.goto(`${harness.url}?modules=ready&fixturePath=/backoffice`);
  await page.getByRole("button", { name: "Entendido", exact: true }).click();
  await expect(
    page.getByText("No pudimos guardar la acción. Intenta otra vez."),
  ).toBeVisible();
  expect(commands).toHaveLength(1);
  await page.getByRole("button", { name: "Entendido", exact: true }).click();
  await expect(
    page.getByText("Hoy no tengo nada para avisarte."),
  ).toBeVisible();
  expect(commands).toHaveLength(2);
  expect(commands[1]).toEqual(commands[0]);
  expect(scopes).toEqual(["a".repeat(64), "a".repeat(64)]);
});

test("0238 Inbox restringido oculta tarjetas sin bucle de navegación y un reintento explícito recupera", async ({
  page,
}) => {
  let reads = 0;
  let denied = false;
  await page.route("**/api/analytics/inbox", (route) => {
    reads += 1;
    return denied
      ? route.fulfill({
          status: 403,
          json: { error: "Acceso restringido", code: "email_not_verified" },
        })
      : route.fulfill({ json: inboxEnvelope() });
  });
  await page.goto(`${harness.url}?modules=ready&fixturePath=/backoffice`);
  await expect(
    page.getByRole("heading", { name: inboxCard.title }),
  ).toBeVisible();
  denied = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText("Acceso restringido")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: inboxCard.title }),
  ).toHaveCount(0);
  await expect(page.getByText("Contenido privado sintético")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { backofficeFixture: BackofficeFixtureApi })
          .backofficeFixture.navigations,
    ),
  ).toEqual([]);
  expect(reads).toBe(2);
  denied = false;
  await page.getByRole("button", { name: "Volver a intentar" }).click();
  await expect(
    page.getByRole("heading", { name: inboxCard.title }),
  ).toBeVisible();
  await expect(page.getByText("Acceso restringido")).toHaveCount(0);
  expect(reads).toBe(3);
});
