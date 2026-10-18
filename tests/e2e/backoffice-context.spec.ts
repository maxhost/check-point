import { expect, test } from "@playwright/test";
import { startCatalogHarness } from "./support/catalog-harness-server";
import type { BackofficeFixtureApi } from "./support/backoffice-context-fixture";
import type { AnalyticsInboxResponse } from "../../packages/domain/src/analytics/types";

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
  test(`módulos ${result} preservan el core sin GET ad hoc`, async ({
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
      requests.filter(
        (path) => path === "/api/modules" || path === "/api/merchant/session",
      ),
    ).toHaveLength(0);
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
  });
}
