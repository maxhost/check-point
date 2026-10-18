import { expect, test, type Page } from "@playwright/test";
import {
  setupLifecycle,
  startAnalyticsHarness,
} from "./support/analytics-lifecycle-fixture";

let harness: Awaited<ReturnType<typeof startAnalyticsHarness>>;
test.beforeAll(async () => {
  harness = await startAnalyticsHarness();
});
test.afterAll(async () => {
  await harness.close();
});

for (const width of [390, 1280]) {
  test(`compact Dashboard with real-shaped summary and keyboard disclosure at ${width}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const { fixture, informative } = await setupLifecycle(page);
    for (let i = 2; i < 5; i++)
      fixture.inbox.cards.push({
        ...informative,
        id: `synthetic-${i}`,
        title: `Aviso sintético ${i}`,
      });
    await page.goto(harness.url);
    await expect(page.getByRole("article")).toHaveCount(5);
    await expect(
      page.getByText("Punto de equilibrio mensual", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("$456,00", { exact: true })).toBeVisible();
    const rows = page
      .getByRole("region", { name: "Hoy en tu negocio" })
      .locator("button[aria-expanded]");
    await expect(rows).toHaveCount(5);
    await expect(
      page
        .getByRole("region", { name: "Hoy en tu negocio" })
        .locator('button[aria-expanded="true"]'),
    ).toHaveCount(0);
    expect(
      await rows.evaluateAll((items) =>
        items.reduce(
          (sum, item) => sum + item.getBoundingClientRect().height,
          0,
        ),
      ),
    ).toBeLessThan(width === 390 ? 380 : 350);
    expect(fixture.writes).toHaveLength(0);
    expect(fixture.reads).toBe(1);
    expect(fixture.summaryReads).toBe(1);
    expect(
      await page.evaluate(() =>
        [...document.querySelectorAll("main *")]
          .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
          .map((el) => ({
            tag: el.tagName,
            cls: el.className,
            right: el.getBoundingClientRect().right,
            text: el.textContent?.slice(0, 50),
          })),
      ),
    ).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`dashboard-${width}.png`),
      fullPage: true,
    });
    const first = page.getByRole("button", {
      name: "Tus ventas de ayer",
      exact: true,
    });
    await first.focus();
    await page.keyboard.press("Enter");
    await expect(first).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: "Ver el día" })).toBeVisible();
    const second = page.getByRole("button", {
      name: "Queda poca harina",
      exact: true,
    });
    await second.focus();
    await page.keyboard.press("Space");
    await expect(second).toHaveAttribute("aria-expanded", "true");
    await expect(first).toHaveAttribute("aria-expanded", "false");
    await expect(
      page.getByRole("button", { name: "Recordarme luego" }),
    ).toBeVisible();
    expect(fixture.writes).toHaveLength(0);
  });
}

test("summary is independent of Inbox: slow, failed, stale, retry and focus refresh", async ({
  page,
}) => {
  const { fixture } = await setupLifecycle(page);
  let release!: () => void;
  fixture.holdSummary = new Promise<void>((done) => {
    release = done;
  });
  await page.goto(harness.url);
  await openCard(page, "Tus ventas de ayer");
  await expect(
    page.getByRole("button", { name: "Visto", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Leyendo tus números…")).toBeVisible();
  expect(fixture.reads).toBe(1);
  expect(fixture.summaryReads).toBe(1);
  release();
  fixture.holdSummary = null;
  await expect(page.getByText("$456,00", { exact: true })).toBeVisible();
  fixture.summaryError = {
    status: 503,
    code: "summary_unavailable",
    error: "No disponible",
  };
  await page.getByRole("button", { name: "Actualizar números" }).click();
  await expect(page.getByText(/Mostramos tu lectura anterior/)).toBeVisible();
  await expect(page.getByText("$456,00", { exact: true })).toBeVisible();
  expect(fixture.reads).toBe(1);
  fixture.summaryError = null;
  fixture.summary.todayRevenueMinor = 78900;
  await page.getByRole("button", { name: "Actualizar números" }).click();
  await expect(page.getByText("$789,00", { exact: true })).toBeVisible();
  const count = fixture.summaryReads;
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
  });
  await expect.poll(() => fixture.summaryReads).toBe(count + 1);
});

async function openCard(page: Page, title: string) {
  const row = page.getByRole("button", { name: title, exact: true });
  await expect(row).toBeVisible();
  if ((await row.getAttribute("aria-expanded")) === "false") await row.click();
}

async function chooseReminder(page: Page, year = "2026") {
  for (const [segment, value] of [
    [/^día,/i, "21"],
    [/^mes,/i, "10"],
    [/^año,/i, year],
    [/^hora,/i, "10"],
    [/^minuto,/i, "30"],
  ] as const) {
    const field = page.getByRole("spinbutton", { name: segment });
    await field.focus();
    await field.press("ControlOrMeta+a");
    await field.pressSequentially(value);
    await field.press("Tab");
  }
}

for (const width of [390, 1280]) {
  test(`explicit categories and decisions preserve navigation at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const { fixture, informative } = await setupLifecycle(page);
    await page.goto(harness.url);
    const summary = page.getByRole("article").filter({
      has: page.getByRole("button", { name: "Tus ventas de ayer" }),
    });
    const stock = page.getByRole("article").filter({
      has: page.getByRole("button", { name: "Queda poca harina" }),
    });
    await openCard(page, "Tus ventas de ayer");
    await expect(
      summary.getByRole("button", { name: "Visto", exact: true }),
    ).toBeVisible();
    await expect(
      summary.getByRole("button", { name: "Recordarme luego" }),
    ).toHaveCount(0);
    await expect(
      summary.getByRole("button", { name: "Solucionado" }),
    ).toHaveCount(0);
    await openCard(page, "Queda poca harina");
    await expect(
      stock.getByRole("button", { name: "Recordarme luego" }),
    ).toBeVisible();
    await expect(
      stock.getByRole("button", { name: "Solucionado" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^Descartar / })).toHaveCount(
      0,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);

    await openCard(page, "Tus ventas de ayer");
    await summary.getByRole("button", { name: "Visto", exact: true }).click();
    await expect(summary).toHaveCount(0);
    expect(fixture.writes[0]?.decision).toBe("seen");
    expect(fixture.writes[0]?.body).toMatchObject({
      expectedVersion: informative.version,
    });
    expect(fixture.writes[0]?.body.operationId).toEqual(expect.any(String));
    await openCard(page, "Queda poca harina");
    await stock.getByRole("link", { name: "Registrar compra" }).click();
    await expect(page).toHaveURL(/\/backoffice\/catalog$/);
    expect(fixture.writes).toHaveLength(1);
  });

  test(`snooze chooses commerce time and rejects beyond expiry at ${width}px`, async ({
    page,
  }, info) => {
    await page.clock.install({ time: new Date("2026-10-20T14:59:00Z") });
    await page.clock.pauseAt(new Date("2026-10-20T15:00:00Z"));
    await page.setViewportSize({ width, height: 900 });
    const { fixture, actionable } = await setupLifecycle(page);
    await page.goto(harness.url);
    await openCard(page, "Queda poca harina");
    await page.getByRole("button", { name: "Recordarme luego" }).click();
    await expect(page.getByRole("dialog")).toContainText("America/Guayaquil");
    await chooseReminder(page, "2028");
    await page
      .getByRole("button", { name: "Guardar recordatorio", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(fixture.writes).toHaveLength(0);
    await chooseReminder(page);
    await page.screenshot({
      path: info.outputPath(`snooze-${width}.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Guardar recordatorio", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(fixture.writes).toHaveLength(1);
    expect(fixture.writes[0]).toMatchObject({
      decision: "snooze",
      body: {
        expectedVersion: actionable.version,
        remindAt: "2026-10-21T15:30:00.000Z",
      },
    });
    await expect(
      page.getByRole("button", { name: "Queda poca harina" }),
    ).toHaveCount(0);
  });
}

test("stale context reloads the card without closing the new version", async ({
  page,
}) => {
  const { fixture } = await setupLifecycle(page);
  await page.goto(harness.url);
  await expect(page.getByRole("article")).toHaveCount(2);
  fixture.inbox.cards[1] = {
    ...fixture.inbox.cards[1]!,
    version: "context-2",
    body: "Ahora quedan 500 g de harina.",
  };
  fixture.nextError = {
    status: 409,
    code: "card_context_changed",
    error: "El aviso cambió. Revisa la información antes de decidir.",
  };
  await openCard(page, "Queda poca harina");
  await page.getByRole("button", { name: "Solucionado" }).click();
  await expect(
    page.getByText("Ahora quedan 500 g de harina.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(2);
  expect(fixture.writes).toHaveLength(1);
  expect(fixture.reads).toBe(2);
});

test("reminder refreshes once at due time and focus; server keeps ranking authority", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-20T14:59:00Z") });
  await page.clock.pauseAt(new Date("2026-10-20T15:00:00Z"));
  const { fixture, actionable } = await setupLifecycle(page);
  fixture.inbox.cards = [fixture.inbox.cards[0]!];
  fixture.inbox.nextReminderAt = "2026-10-20T15:01:00.000Z";
  await page.goto(harness.url);
  await expect(page.getByRole("article")).toHaveCount(1);
  fixture.inbox.nextReminderAt = null;
  // Eligibility is not a guaranteed slot: this response still excludes the reminder.
  await page.clock.fastForward(60_000);
  await expect.poll(() => fixture.reads).toBe(2);
  await expect(page.getByRole("article")).toHaveCount(1);
  fixture.inbox.cards.push(actionable);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("button", { name: "Queda poca harina" }),
  ).toBeVisible();
  expect(fixture.reads).toBe(3);
  await page.clock.fastForward(3_600_000);
  expect(fixture.reads).toBe(3);
  expect(fixture.writes).toHaveLength(0);
});

test("a reminder beyond the browser timer limit waits without request loops", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-20T14:59:00Z") });
  await page.clock.pauseAt(new Date("2026-10-20T15:00:00Z"));
  const { fixture, actionable } = await setupLifecycle(page);
  fixture.inbox.cards = [fixture.inbox.cards[0]!];
  fixture.inbox.nextReminderAt = "2026-11-19T15:00:00.000Z";
  await page.goto(harness.url);
  await expect(page.getByRole("article")).toHaveCount(1);
  // Clock-controller also has a signed 32-bit jump limit: cross it in two steps.
  await page.clock.fastForward(13 * 24 * 60 * 60 * 1000);
  await page.clock.fastForward(13 * 24 * 60 * 60 * 1000);
  expect(fixture.reads).toBe(1);
  fixture.inbox.nextReminderAt = null;
  fixture.inbox.cards.push(actionable);
  await page.clock.fastForward(4 * 24 * 60 * 60 * 1000);
  await expect(
    page.getByRole("button", { name: "Queda poca harina" }),
  ).toBeVisible();
  expect(fixture.reads).toBe(2);
  expect(fixture.writes).toHaveLength(0);
});

test("an open inbox removes content immediately after expiresAt, keeping the exact boundary", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-20T14:59:00Z") });
  await page.clock.pauseAt(new Date("2026-10-20T15:00:00Z"));
  const { fixture } = await setupLifecycle(page);
  fixture.inbox.cards[1]!.expiresAt = "2026-10-20T15:00:01.000Z";
  await page.goto(harness.url);
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.clock.fastForward(1000);
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.clock.fastForward(1);
  await expect(
    page.getByRole("button", { name: "Queda poca harina" }),
  ).toHaveCount(0);
  await expect.poll(() => fixture.reads).toBe(2);
  await page.clock.fastForward(3_600_000);
  expect(fixture.reads).toBe(2);
});

test("a reminder due during a pending read queues one fresh snapshot", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-20T14:59:00Z") });
  await page.clock.pauseAt(new Date("2026-10-20T15:00:00Z"));
  const { fixture, actionable } = await setupLifecycle(page);
  fixture.inbox.cards = [fixture.inbox.cards[0]!];
  fixture.inbox.nextReminderAt = "2026-10-20T15:01:00.000Z";
  await page.goto(harness.url);
  await expect(page.getByRole("article")).toHaveCount(1);
  let release!: () => void;
  fixture.holdRead = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => fixture.reads).toBe(2);
  await page.clock.fastForward(60_000);
  fixture.inbox.cards.push(actionable);
  fixture.inbox.nextReminderAt = null;
  fixture.holdRead = null;
  release();
  await expect(
    page.getByRole("button", { name: "Queda poca harina" }),
  ).toBeVisible();
  expect(fixture.reads).toBe(3);
  await page.clock.fastForward(3_600_000);
  expect(fixture.reads).toBe(3);
});

test("an obsolete read cannot release the newer read's focus coalescing", async ({
  page,
}) => {
  const { fixture } = await setupLifecycle(page);
  await page.goto(harness.url);
  await expect(page.getByRole("article")).toHaveCount(2);
  let releaseOld!: () => void;
  fixture.holdRead = new Promise<void>((resolve) => {
    releaseOld = resolve;
  });
  const oldRequest = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/analytics/inbox") &&
      request.method() === "GET",
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const request = await oldRequest;
  // Register BEFORE deciding: 0238 can cancel this GET before it has a response.
  const oldTerminal = new Promise<void>((resolve) => {
    const terminal = (candidate: typeof request) => {
      if (candidate !== request) return;
      page.off("requestfinished", terminal);
      page.off("requestfailed", terminal);
      resolve();
    };
    page.on("requestfinished", terminal);
    page.on("requestfailed", terminal);
  });
  await expect.poll(() => fixture.reads).toBe(2);
  let releaseNew!: () => void;
  fixture.holdRead = new Promise<void>((resolve) => {
    releaseNew = resolve;
  });
  fixture.nextError = {
    status: 409,
    code: "card_context_changed",
    error: "El aviso cambió. Revisa la información.",
  };
  await openCard(page, "Queda poca harina");
  await page.getByRole("button", { name: "Solucionado" }).click();
  await expect.poll(() => fixture.reads).toBe(3);
  releaseOld();
  await oldTerminal;
  // Let the old transport terminal and its promise chain settle before triggering focus.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("focus"));
  });
  expect(fixture.reads).toBe(3);
  fixture.holdRead = null;
  releaseNew();
  await expect.poll(() => fixture.reads).toBe(4);
  await expect(page.getByRole("article")).toHaveCount(2);
  expect(fixture.writes).toHaveLength(1);
});

test("transport retry keeps operationId and the original context", async ({
  page,
}) => {
  const { fixture } = await setupLifecycle(page);
  fixture.nextTransportFailure = true;
  await page.goto(harness.url);
  await openCard(page, "Tus ventas de ayer");
  await page.getByRole("button", { name: "Visto", exact: true }).click();
  await expect(
    page.getByText("No pudimos guardar la acción. Intenta otra vez."),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(2);
  await openCard(page, "Tus ventas de ayer");
  await page.getByRole("button", { name: "Visto", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  expect(fixture.writes).toHaveLength(2);
  expect(fixture.writes[1]!.body).toEqual(fixture.writes[0]!.body);
});

test("a reminder due during a mutation queues one read after the command", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-20T14:59:00Z") });
  await page.clock.pauseAt(new Date("2026-10-20T15:00:00Z"));
  const { fixture, actionable } = await setupLifecycle(page);
  fixture.inbox.cards = [fixture.inbox.cards[0]!];
  fixture.inbox.nextReminderAt = "2026-10-20T15:01:00.000Z";
  let release!: () => void;
  fixture.holdWrite = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.goto(harness.url);
  await openCard(page, "Tus ventas de ayer");
  await page.getByRole("button", { name: "Visto", exact: true }).click();
  await expect.poll(() => fixture.writes.length).toBe(1);
  await page.clock.fastForward(60_000);
  expect(fixture.reads).toBe(1);
  fixture.inbox.cards.push(actionable);
  fixture.inbox.nextReminderAt = null;
  release();
  await expect(
    page.getByRole("button", { name: "Queda poca harina" }),
  ).toBeVisible();
  await expect.poll(() => fixture.reads).toBe(2);
  expect(fixture.writes).toHaveLength(1);
  await page.clock.fastForward(3_600_000);
  expect(fixture.reads).toBe(2);
});

test("preparation refresh uses server cadence and stops when ready", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-20T14:59:00Z") });
  await page.clock.pauseAt(new Date("2026-10-20T15:00:00Z"));
  const { fixture } = await setupLifecycle(page);
  fixture.inbox.state = "preparing";
  fixture.inbox.refreshAfterMs = 1000;
  await page.goto(harness.url);
  await expect(
    page.getByText("Preparando lo de hoy", { exact: true }),
  ).toBeVisible();
  fixture.inbox.state = "ready";
  fixture.inbox.refreshAfterMs = null;
  await page.clock.fastForward(999);
  expect(fixture.reads).toBe(1);
  await page.clock.fastForward(1);
  await expect.poll(() => fixture.reads).toBe(2);
  await expect(
    page.getByText("Preparando lo de hoy", { exact: true }),
  ).toHaveCount(0);
  await page.clock.fastForward(3_600_000);
  expect(fixture.reads).toBe(2);
});
