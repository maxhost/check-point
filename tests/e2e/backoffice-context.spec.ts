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
  await expect.poll(() => moduleReads.length).toBe(1);
  expect(moduleReads).toEqual(["a".repeat(64)]);
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
  await expect.poll(() => moduleReads.length).toBe(2);
  expect(moduleReads).toEqual(["a".repeat(64), "a".repeat(64)]);
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

const checklistEnvelope = (done = false, verify = false) => ({
  locale: "es",
  items: [
    {
      id: verify ? "verify" : "brand",
      anchor: verify ? "verify-email" : "brand",
      position: 0,
      required: verify,
      done,
      title: verify ? "Verifica tu email" : "Configura tu marca",
      body: "Paso sintético",
    },
  ],
});
const ended = "checkpass:onboarding-tour-ended";

test("0238 checklist comparte GET scoped entre dos lectores y soltar uno no cancela al otro", async ({
  page,
}) => {
  const reads: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  await page.route("**/api/onboarding/checklist", async (route) => {
    reads.push(route.request().headers()["x-backoffice-scope"]);
    await gate;
    await route.fulfill({ json: checklistEnvelope() });
  });
  await page.goto(
    `${harness.url}?modules=ready&checklist&checklistReaders=2&strict&fixturePath=/backoffice`,
  );
  await expect.poll(() => reads.length).toBe(1);
  await page.evaluate(() =>
    (
      window as unknown as { backofficeFixture: BackofficeFixtureApi }
    ).backofficeFixture.setChecklistReaders(1),
  );
  release();
  await expect(
    page.getByText("Configura tu marca", { exact: true }),
  ).toHaveCount(1);
  expect(reads).toEqual(["a".repeat(64)]);
});

test("0238 counter no adquiere checklist; END y reintento fuera de counter pasan por propietario", async ({
  page,
}) => {
  let reads = 0;
  await page.route("**/api/onboarding/checklist", (route) => {
    reads += 1;
    return route.fulfill({ json: checklistEnvelope() });
  });
  await page.goto(
    `${harness.url}?modules=ready&checklist&fixturePath=/backoffice/counter`,
  );
  await expect(page.getByText("Contenido privado sintético")).toBeVisible();
  await page.evaluate((event) => window.dispatchEvent(new Event(event)), ended);
  await expect(
    page.getByRole("heading", { name: "Hoy en tu negocio" }),
  ).toBeVisible();
  expect(reads).toBe(0);
  await page.goto(
    `${harness.url}?modules=ready&checklist&fixturePath=/backoffice`,
  );
  await expect(
    page.getByText("Configura tu marca", { exact: true }),
  ).toBeVisible();
  expect(reads).toBe(1);
  await page.evaluate((event) => {
    for (let i = 0; i < 5; i++) window.dispatchEvent(new Event(event));
  }, ended);
  await expect.poll(() => reads).toBe(2);
  await expect(
    page.getByText("Configura tu marca", { exact: true }),
  ).toBeVisible();
});

test("0238 checklist operativo falla y reintenta con HTTP nueva sin navegación", async ({
  page,
}) => {
  let reads = 0;
  await page.route("**/api/onboarding/checklist", (route) => {
    reads += 1;
    return reads === 1
      ? route.fulfill({ status: 503, json: { error: "offline" } })
      : route.fulfill({ json: checklistEnvelope() });
  });
  await page.goto(
    `${harness.url}?modules=ready&checklist&fixturePath=/backoffice`,
  );
  await expect(
    page.getByText("No pudimos cargar los pasos de configuración"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(
    page.getByText("Configura tu marca", { exact: true }),
  ).toBeVisible();
  expect(reads).toBe(2);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { backofficeFixture: BackofficeFixtureApi })
          .backofficeFixture.navigations,
    ),
  ).toEqual([]);
});

test("0238 tour POST capturado y END final invalidan checklist anterior aún montado", async ({
  page,
}) => {
  let reads = 0,
    saved = false;
  const writes: string[] = [];
  let releaseRead!: () => void, releaseWrite!: () => void;
  const readGate = new Promise<void>((done) => {
    releaseRead = done;
  });
  const writeGate = new Promise<void>((done) => {
    releaseWrite = done;
  });
  await page.route("**/api/onboarding/checklist", async (route) => {
    reads += 1;
    const count = reads;
    const value = checklistEnvelope(saved);
    if (count === 2) await readGate;
    await route.fulfill({ json: value });
  });
  await page.route("**/api/onboarding/tours/brand", async (route) => {
    writes.push(route.request().headers()["x-backoffice-scope"]);
    await writeGate;
    saved = true;
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto(
    `${harness.url}?modules=ready&checklist&fixturePath=/backoffice`,
  );
  await expect(
    page.getByText("Configura tu marca", { exact: true }),
  ).toBeVisible();
  const persisted = page.evaluate(() =>
    (
      window as unknown as { backofficeFixture: BackofficeFixtureApi }
    ).backofficeFixture.persistTour(),
  );
  await expect.poll(() => reads).toBe(2);
  await expect.poll(() => writes.length).toBe(1);
  releaseWrite();
  expect(await persisted).toBe(true);
  await expect.poll(() => reads).toBe(3);
  await expect(page.getByLabel("Estado checklist")).toHaveText("ready:1");
  releaseRead();
  await expect(
    page.getByText("Configura tu marca", { exact: true }),
  ).toHaveCount(0);
  expect(writes).toEqual(["a".repeat(64)]);
  expect(reads).toBe(3);
});

test("0238 verify auth exento confirma checklist sólo por GET scoped", async ({
  page,
}) => {
  let reads = 0;
  const scopes: string[] = [];
  const authScopes: (string | undefined)[] = [];
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  await page.route("**/api/onboarding/checklist", async (route) => {
    reads += 1;
    scopes.push(route.request().headers()["x-backoffice-scope"]);
    if (reads === 2) await gate;
    await route.fulfill({ json: checklistEnvelope(reads >= 2, true) });
  });
  await page.route("**/api/merchant/auth/verify-email", (route) => {
    authScopes.push(route.request().headers()["x-backoffice-scope"]);
    return route.fulfill({ json: { verified: true } });
  });
  await page.goto(
    `${harness.url}?modules=ready&checklist&unverified&fixturePath=/backoffice`,
  );
  await page
    .getByRole("button", { name: "Verificar mi email", exact: true })
    .click();
  await expect.poll(() => reads).toBe(2);
  await expect(
    page.getByText("Verifica tu email", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Estado checklist")).toHaveText("loading:0");
  release();
  await expect(page.getByLabel("Estado checklist")).toHaveText("ready:1");
  await expect(
    page.getByText("Verifica tu email", { exact: true }),
  ).toHaveCount(0);
  expect(authScopes).toEqual([undefined]);
  expect(scopes).toEqual(["a".repeat(64), "a".repeat(64)]);
});

for (const outcome of ["sent", "error"] as const) {
  test(`0238 verify ${outcome} tardío tras retirada no cambia UI ni revalida`, async ({
    page,
  }) => {
    let reads = 0;
    let auth = 0;
    let release!: () => void;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    await page.route("**/api/onboarding/checklist", (route) => {
      reads += 1;
      return route.fulfill({ json: checklistEnvelope(false, true) });
    });
    await page.route("**/api/merchant/auth/verify-email", async (route) => {
      auth += 1;
      await gate;
      await route.fulfill({
        status: outcome === "error" ? 503 : 200,
        json: { sent: true },
      });
    });
    await page.goto(
      `${harness.url}?modules=ready&checklist&unverified&fixturePath=/backoffice`,
    );
    await page
      .getByRole("button", { name: "Verificar mi email", exact: true })
      .click();
    await expect.poll(() => auth).toBe(1);
    await page.evaluate(() =>
      (
        window as unknown as { backofficeFixture: BackofficeFixtureApi }
      ).backofficeFixture.retire(),
    );
    await expect(page.getByText("Contenido privado sintético")).toHaveCount(0);
    const completed = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/merchant/auth/verify-email",
    );
    release();
    await (await completed).finished();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(
      page.getByText("Te enviamos el enlace. Revisa tu correo para continuar."),
    ).toHaveCount(0);
    expect(reads).toBe(1);
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { backofficeFixture: BackofficeFixtureApi })
            .backofficeFixture.navigations,
      ),
    ).toEqual(["/backoffice"]);
  });
}

function refreshSession(staff = false, verified = true) {
  return {
    authenticated: true,
    user: {
      id: "fixture-user",
      name: "Fixture",
      email: "fixture@example.invalid",
      emailVerified: verified,
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
      role: staff ? "staff" : "owner",
      status: "active",
      permissions: staff
        ? ["business", "analytics", "stock"]
        : ["analytics", "stock"],
    },
    billing: {
      access: "trial" as "trial" | "subscribed",
      trialDaysLeft: 10,
      trialEndsAt: null,
    },
  };
}
const fireVisibleSignals = async (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("focus"));
  });

test("0238 foco/reconnect visibles coalescen por recurso y no leen recursos sin suscriptores", async ({
  page,
}) => {
  const counts = { session: 0, modules: 0, inbox: 0, checklist: 0 };
  await page.route("**/api/merchant/session", (route) => {
    counts.session += 1;
    return route.fulfill({ json: refreshSession() });
  });
  await page.route("**/api/modules", (route) => {
    counts.modules += 1;
    return route.fulfill({ json: { modules: businessModules(true, false) } });
  });
  await page.route("**/api/analytics/inbox", (route) => {
    counts.inbox += 1;
    return route.fulfill({ json: inboxEnvelope([]) });
  });
  await page.route("**/api/onboarding/checklist", (route) => {
    counts.checklist += 1;
    return route.fulfill({ json: checklistEnvelope() });
  });
  await page.goto(
    `${harness.url}?modules=ready&checklist&fixturePath=/backoffice`,
  );
  await expect(
    page.getByText("Configura tu marca", { exact: true }),
  ).toBeVisible();
  expect(counts).toEqual({ session: 0, modules: 0, inbox: 1, checklist: 1 });
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
  });
  expect(counts).toEqual({ session: 0, modules: 0, inbox: 1, checklist: 1 });
  await page.evaluate(() =>
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    }),
  );
  await fireVisibleSignals(page);
  await expect
    .poll(() => counts)
    .toEqual({ session: 1, modules: 1, inbox: 2, checklist: 2 });
  await page.evaluate(() => {
    const f = (window as unknown as { backofficeFixture: BackofficeFixtureApi })
      .backofficeFixture;
    f.setInboxReaders(0);
    f.setChecklistReaders(0);
  });
  await expect(
    page.getByRole("heading", { name: "Hoy en tu negocio" }),
  ).toHaveCount(0);
  await fireVisibleSignals(page);
  await expect.poll(() => counts.session).toBe(2);
  await expect.poll(() => counts.modules).toBe(2);
  expect(counts.inbox).toBe(2);
  expect(counts.checklist).toBe(2);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { backofficeFixture: BackofficeFixtureApi })
          .backofficeFixture.refreshes,
    ),
  ).toBe(0);
});

test("0238 nombre vivo/días/permisos ordenados actualizan presentación sin refreshRSC", async ({
  page,
}) => {
  const session = refreshSession();
  session.business.name = "Comercio renombrado";
  session.billing.trialDaysLeft = 9;
  session.membership.permissions = ["stock", "analytics"];
  await page.route("**/api/merchant/session", (route) =>
    route.fulfill({ json: session }),
  );
  await page.route("**/api/modules", (route) =>
    route.fulfill({ json: { modules: businessModules(true, false) } }),
  );
  await page.goto(
    `${harness.url}?modules=ready&live-name&fixturePath=/backoffice`,
  );
  await expect(page.getByLabel("Nombre negocio actual")).toHaveText(
    "Comercio sintético",
  );
  await fireVisibleSignals(page);
  await expect(page.getByLabel("Nombre negocio actual")).toHaveText(
    "Comercio renombrado",
  );
  await expect(
    page.getByText("Prueba de CheckPass: quedan 9 días"),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { backofficeFixture: BackofficeFixtureApi })
          .backofficeFixture.refreshes,
    ),
  ).toBe(0);
});

test("0238 formulario fiscal REAL conserva edición con trial→subscribed, permiso ajeno y ackRSC sin loop", async ({
  page,
}) => {
  const session = refreshSession(true);
  await page.route("**/api/merchant/session", (route) =>
    route.fulfill({ json: session }),
  );
  await page.route("**/api/modules", (route) =>
    route.fulfill({ json: { modules: businessModules(true, false) } }),
  );
  await page.goto(
    `${harness.url}?modules=ready&form&fixturePath=/backoffice/business`,
  );
  const rate = page.getByRole("textbox", { name: "Tasa de IVA de venta (%)" });
  await rate.fill("17.5");
  const field = await rate.elementHandle();
  session.billing.access = "subscribed";
  await fireVisibleSignals(page);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { backofficeFixture: BackofficeFixtureApi })
            .backofficeFixture.refreshes,
      ),
    )
    .toBe(1);
  const billingAck = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/merchant/session",
  );
  await page.evaluate(() =>
    (
      window as unknown as { backofficeFixture: BackofficeFixtureApi }
    ).backofficeFixture.ackBoot("refresh-billing"),
  );
  await expect(page.getByLabel("Boot observado")).toHaveText("refresh-billing");
  await (await billingAck).finished();
  await expect(rate).toHaveValue("17.5");
  expect(await field!.evaluate((node) => node.isConnected)).toBe(true);
  session.membership.permissions.push("catalog");
  await fireVisibleSignals(page);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { backofficeFixture: BackofficeFixtureApi })
            .backofficeFixture.refreshes,
      ),
    )
    .toBe(2);
  const permissionAck = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/merchant/session",
  );
  await page.evaluate(() =>
    (
      window as unknown as { backofficeFixture: BackofficeFixtureApi }
    ).backofficeFixture.ackBoot("refresh-permission"),
  );
  await expect(page.getByLabel("Boot observado")).toHaveText(
    "refresh-permission",
  );
  await (await permissionAck).finished();
  await expect(rate).toHaveValue("17.5");
  expect(await field!.evaluate((node) => node.isConnected)).toBe(true);
  const finalRead = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/merchant/session",
  );
  await fireVisibleSignals(page);
  await (await finalRead).finished();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(rate).toHaveValue("17.5");
  const state = await page.evaluate(() => {
    const f = (window as unknown as { backofficeFixture: BackofficeFixtureApi })
      .backofficeFixture;
    return { refreshes: f.refreshes, navigations: f.navigations };
  });
  expect(state).toEqual({ refreshes: 2, navigations: [] });
});

test("0238 PIN403 confirmado solicita guardRSC una vez, ack y foco repetido no hacen loop", async ({
  page,
}) => {
  await page.route("**/api/merchant/session", (route) =>
    route.fulfill({ json: refreshSession(true) }),
  );
  await page.route("**/api/modules", (route) =>
    route.fulfill({
      status: 403,
      json: { error: "Cambia tu PIN", code: "pin_change_required" },
    }),
  );
  await page.goto(
    `${harness.url}?modules=ready&form&readers=0&fixturePath=/backoffice/business`,
  );
  await fireVisibleSignals(page);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { backofficeFixture: BackofficeFixtureApi })
            .backofficeFixture.refreshes,
      ),
    )
    .toBe(1);
  await page.evaluate(() =>
    (
      window as unknown as { backofficeFixture: BackofficeFixtureApi }
    ).backofficeFixture.ackBoot("pin-guard"),
  );
  await fireVisibleSignals(page);
  await expect(page.getByLabel("Estado módulos")).toHaveText("restricted");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { backofficeFixture: BackofficeFixtureApi })
          .backofficeFixture.refreshes,
    ),
  ).toBe(1);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { backofficeFixture: BackofficeFixtureApi })
          .backofficeFixture.navigations,
    ),
  ).toEqual([]);
});

test("0238 email403 mantiene restricted sin pedir salida de página ni bucle de refresh", async ({
  page,
}) => {
  let reads = 0;
  await page.route("**/api/merchant/session", (route) =>
    route.fulfill({ json: refreshSession(false, false) }),
  );
  await page.route("**/api/modules", (route) => {
    reads += 1;
    return route.fulfill({
      status: 403,
      json: { error: "Verifica tu email", code: "email_not_verified" },
    });
  });
  await page.goto(
    `${harness.url}?unverified&readers=0&fixturePath=/backoffice`,
  );
  await page.evaluate(() =>
    (
      window as unknown as { backofficeFixture: BackofficeFixtureApi }
    ).backofficeFixture.resolveModules("restricted"),
  );
  await expect(page.getByLabel("Estado módulos")).toHaveText("restricted");
  expect(reads).toBe(0);
  await fireVisibleSignals(page);
  await expect.poll(() => reads).toBe(1);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { backofficeFixture: BackofficeFixtureApi })
          .backofficeFixture.refreshes,
    ),
  ).toBe(0);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { backofficeFixture: BackofficeFixtureApi })
          .backofficeFixture.navigations,
    ),
  ).toEqual([]);
});
