/** P3b native development smoke. No API interception, screenshots or M0 writes. */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  lstatSync,
  realpathSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
const run = process.env.POS_MASS_NATIVE_RUN;
if (run !== undefined && !/^[a-z0-9-]{1,48}$/.test(run))
  throw Error(
    "POS_MASS_NATIVE_RUN must contain 1–48 lowercase letters, digits or hyphens",
  );
const directory = `/private/tmp/checkpass-pos-0242/mass-native${run === undefined ? "" : `-${run}`}`;
mkdirSync(directory, { recursive: true, mode: 0o700 });
const directoryStat = lstatSync(directory);
if (
  !directoryStat.isDirectory() ||
  directoryStat.isSymbolicLink() ||
  realpathSync(directory) !== directory ||
  directoryStat.mode & 0o077
)
  throw Error("Private owned output directory required");
const selected = "/private/tmp/checkpass-pos-0242/private/selected.json";
const config = JSON.parse(readFileSync(selected, "utf8"));
const hash = (v) => createHash("sha256").update(v).digest("hex");
const blocked = readFileSync("packages/db/src/local.ts", "utf8").match(
  /PROD_DB_ENDPOINT_SHA12 = "([a-f0-9]{12})"/,
)[1];
for (const key of ["NEON_CI_DATABASE_URL", "NEON_CI_DATABASE_URL_UNPOOLED"]) {
  const host = new URL(config[key]).hostname;
  if (!/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(host))
    throw Error("Protected CI host required");
  let endpoint = host.split(".")[0],
    before;
  do {
    before = endpoint;
    endpoint = endpoint.replace(/-(pooler|rvr)$/, "");
  } while (before !== endpoint);
  const digest = hash(endpoint).slice(0, 12);
  if (digest === blocked || digest !== config.POS_MEASUREMENT_ENDPOINT_SHA12)
    throw Error("Protected CI endpoint mismatch");
}
if (
  config.BETTER_AUTH_URL !== "http://localhost:43242" ||
  config.BETTER_AUTH_SECRET.length < 32
)
  throw Error("Unexpected selected auth configuration");
const source = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim())
  throw Error("Frozen clean source required");
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  NVM_DIR: process.env.NVM_DIR,
  ...config,
  ...(run === undefined ? {} : { POS_MASS_NATIVE_RUN: run }),
  DATABASE_URL: config.NEON_CI_DATABASE_URL,
  BETTER_AUTH_URL: "http://localhost:43252",
  CONSUMER_ORIGIN: "http://localhost:43253",
  EMAIL_PROVIDER: "console",
  AI_PROVIDER: "fake",
  NEON_TEST_ENV_FILE: "/private/tmp/checkpass-pos-0242/private/ci.env",
};
const mode = process.argv[2];
if (["fixture", "domain", "server"].includes(mode)) {
  let command, args;
  if (mode === "server") {
    command = "pnpm";
    args = [
      "--filter",
      "@mi-pasaporte/merchant",
      "exec",
      "next",
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      "43252",
    ];
    env.NODE_ENV = "development";
    env.WATCHPACK_POLLING = "1000";
  } else {
    command = "bash";
    args = [
      "tools/neon-test.sh",
      mode === "fixture"
        ? "src/modules/pos/server/mass-native.neon.integration.test.ts"
        : "src/modules/measured-mass-0242.neon.integration.test.ts",
      "--no-file-parallelism",
    ];
    if (mode === "fixture") {
      env.POS_MASS_NATIVE = "true";
      env.POS_MASS_OPERATION = process.argv[3];
    }
  }
  const child = spawn(command, args, { env, stdio: "inherit" });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => child.kill(signal));
} else if (["browser", "history"].includes(mode)) {
  const { chromium, expect } = await import("@playwright/test");
  const fixture = JSON.parse(readFileSync(`${directory}/loyalty.json`, "utf8"));
  if (
    fixture.kind !== "mass-native-0242" ||
    fixture.phase !== "ready" ||
    fixture.endpoint !== config.POS_MEASUREMENT_ENDPOINT_SHA12 ||
    fixture.run !== run
  )
    throw Error("Own ready fixture required");
  const report = {
    source,
    run: run ?? null,
    runtime: "Next development webpack :43252",
    node: process.version,
    endpoint: fixture.endpoint,
    configSha256: hash(readFileSync(selected)),
    lockSha256: hash(readFileSync("pnpm-lock.yaml")),
    requests: [],
    responses: [],
    requestFailures: [],
    pageErrors: [],
    stage: "launch",
    valid: false,
  };
  const attemptFile = `${directory}/browser-attempt-${randomUUID()}.json`;
  writeFileSync(attemptFile, JSON.stringify(report, null, 2), {
    mode: 0o600,
    flag: "wx",
  });
  const sanitize = (value) =>
    String(value)
      .replaceAll(fixture.qrToken, "[private-token]")
      .replaceAll(fixture.cookie, "[private-cookie]")
      .replaceAll(
        fixture.cookie.slice(fixture.cookie.indexOf("=") + 1),
        "[private-cookie-value]",
      );
  const save = () =>
    writeFileSync(attemptFile, JSON.stringify(report, null, 2), {
      mode: 0o600,
    });
  let browser, context, page;
  const snapshot = async () => {
    if (!page || page.isClosed()) return;
    const state = await page.evaluate(() => ({
      buttons: [...document.querySelectorAll("button")]
        .slice(0, 120)
        .map((b) => ({
          text: b.textContent?.trim().slice(0, 160),
          label: b.getAttribute("aria-label"),
          disabled: b.disabled || b.getAttribute("aria-disabled") === "true",
          visible: !!(
            b.getClientRects().length &&
            getComputedStyle(b).visibility !== "hidden"
          ),
        })),
      dialogs: [...document.querySelectorAll('[role="dialog"]')].map((d) => ({
        label: d.getAttribute("aria-label"),
        labelledBy: d.getAttribute("aria-labelledby"),
        visible: !!d.getClientRects().length,
      })),
      alerts: [...document.querySelectorAll('[role="alert"]')].map((a) =>
        a.textContent?.slice(0, 500),
      ),
    }));
    report.snapshots ??= [];
    report.snapshots.push({
      stage: report.stage,
      at: new Date().toISOString(),
      state: JSON.parse(sanitize(JSON.stringify(state))),
    });
    save();
  };
  try {
    browser = await chromium.launch();
    context = await browser.newContext({
      viewport: { width: 1280, height: 950 },
      serviceWorkers: "block",
    });
    const at = fixture.cookie.indexOf("=");
    await context.addCookies([
      {
        name: fixture.cookie.slice(0, at),
        value: fixture.cookie.slice(at + 1),
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);
    page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);
    page.on("request", (r) => {
      const path = new URL(r.url()).pathname;
      if (path.endsWith("/close") && r.method() === "POST")
        report.closeBody = r.postDataJSON();
      if (path.startsWith("/api/modules/pos/"))
        report.requests.push({
          path,
          method: r.method(),
          scoped: !!r.headers()["x-backoffice-scope"],
          contract: r.headers()["x-pos-contract"],
        });
      save();
    });
    page.on("response", (r) => {
      const path = new URL(r.url()).pathname;
      if (path.startsWith("/api/modules/pos/"))
        report.responses.push({
          path,
          method: r.request().method(),
          status: r.status(),
        });
      save();
    });
    page.on("requestfailed", (r) => {
      report.requestFailures.push({
        path: new URL(r.url()).pathname,
        method: r.method(),
        error: sanitize(r.failure()?.errorText ?? "unknown"),
      });
      save();
    });
    page.on("pageerror", (error) => {
      report.pageErrors.push(sanitize(error.message));
      save();
    });
    const expectReceipt = async () => {
      await expect(
        page
          .getByRole("heading", { name: "Venta cerrada", exact: true })
          .first(),
      ).toBeVisible();
      await expect(
        page.getByText("Cliente: Cliente Masa nativa", { exact: true }).first(),
      ).toBeVisible();
    };
    const openClosedReceipt = async (label) => {
      await page.getByRole("button", { name: /Estado$/ }).click();
      await page
        .getByRole("option", { name: "Cerradas hoy", exact: true })
        .click();
      await page
        .getByRole("button", { name: `Abrir ${label}`, exact: true })
        .click();
      await expectReceipt();
    };
    report.stage = "navigation";
    save();
    await page.goto("http://localhost:43252/backoffice/pos");
    if (mode === "history") {
      const name = process.argv[3];
      if (!/^browser-failure-\d+\.json$/.test(name ?? ""))
        throw Error("Explicit previous owned attempt required");
      const priorRaw = readFileSync(`${directory}/${name}`, "utf8");
      const prior = JSON.parse(priorRaw);
      if (
        prior.valid !== false ||
        prior.postWriteOrderGets !== 0 ||
        prior.closeBody?.membershipId !== fixture.membershipId
      )
        throw Error("Prior completed write evidence required");
      const closePath = prior.requests.findLast(
        (r) => r.path.endsWith("/close") && r.method === "POST",
      )?.path;
      const orderId = closePath?.match(
        /^\/api\/modules\/pos\/orders\/([a-f0-9-]+)\/close$/,
      )?.[1];
      if (!orderId) throw Error("Original canonical order required");
      const label = `Mostrador ${orderId.slice(0, 8)}`;
      await openClosedReceipt(label);
      expect(report.requests.filter((r) => r.method !== "GET")).toEqual([]);
      report.orderId = orderId;
      report.closeBody = prior.closeBody;
      report.flowSource = prior.source;
      report.flowEvidence = name;
      report.flowEvidenceSha256 = hash(priorRaw);
      report.historyConfirmed = true;
      report.valid = true;
      report.evidence =
        "Composed: original UI sale reached receipt and 0 order GET assertions, then failed history selector; this run only reopens the same closed order from history.";
      writeFileSync(
        `${directory}/browser.json`,
        JSON.stringify(report, null, 2),
        { mode: 0o600, flag: "wx" },
      );
    } else {
      report.stage = "editor";
      save();
      await page
        .getByRole("button", { name: "Nueva orden", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Mostrador", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Añadir Masa nativa", exact: true })
        .click();
      const quantity = page.getByRole("dialog", {
        name: "Cantidad de Masa nativa",
        exact: true,
      });
      await quantity
        .getByRole("textbox", { name: "Cantidad", exact: true })
        .fill("0,75");
      await quantity
        .getByRole("button", { name: "Confirmar cantidad", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Identificar cliente", exact: true })
        .click();
      const identify = page.getByRole("dialog", {
        name: "Identificar cliente",
        exact: true,
      });
      await identify
        .getByRole("textbox", { name: "Código del pase", exact: true })
        .fill(fixture.qrToken);
      report.stage = "resolve";
      await snapshot();
      const [resolveResponse] = await Promise.all([
        page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname.endsWith("/resolve") &&
            r.request().method() === "POST",
        ),
        identify
          .getByRole("button", { name: "Identificar", exact: true })
          .click(),
      ]);
      expect(resolveResponse.status()).toBe(200);
      expect(await resolveResponse.json()).toMatchObject({
        membership: { id: fixture.membershipId },
        couponState: { coupon: { couponId: fixture.couponId } },
      });
      await expect(identify).toBeHidden();
      const writeStart = report.requests.length;
      report.stage = "create";
      await snapshot();
      const [createResponse] = await Promise.all([
        page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === "/api/modules/pos/orders" &&
            r.request().method() === "POST",
        ),
        page
          .getByRole("button", { name: "Continuar al cobro", exact: true })
          .click(),
      ]);
      expect(createResponse.status()).toBe(201);
      const order = await createResponse.json();
      report.orderId = order.id;
      save();
      expect(order).toMatchObject({
        total: "3.09",
        status: "open",
        items: [
          expect.objectContaining({
            quantity: "0.75",
            unitPrice: "4.123456789",
            measure: {
              kind: "mass",
              quantityUnit: "kg",
              priceUnit: "kg",
              conversionVersion: "mass-si-1",
            },
          }),
        ],
      });
      const payment = page.getByRole("dialog", {
        name: `Cobrar ${order.orderLabel}`,
        exact: true,
      });
      report.stage = "close";
      await snapshot();
      const [closeResponse] = await Promise.all([
        page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname ===
              `/api/modules/pos/orders/${order.id}/close` &&
            r.request().method() === "POST",
        ),
        payment
          .getByRole("button", { name: "Confirmar cobro", exact: true })
          .click(),
      ]);
      expect(closeResponse.status()).toBe(200);
      expect(await closeResponse.json()).toMatchObject({
        id: order.id,
        status: "closed",
        total: "3.09",
        sale: { total: "2.78" },
      });
      expect(report.closeBody).toMatchObject({
        membershipId: fixture.membershipId,
        coupon: { couponId: fixture.couponId },
        payments: [expect.objectContaining({ amount: "2.78" })],
      });
      await expectReceipt();
      expect(report.requests.every((r) => r.scoped && r.contract === "2")).toBe(
        true,
      );
      report.postWriteOrderGets = report.requests
        .slice(writeStart)
        .filter(
          (r) =>
            r.method === "GET" && r.path.startsWith("/api/modules/pos/orders"),
        ).length;
      expect(report.postWriteOrderGets).toBe(0);
      report.stage = "history";
      save();
      await page
        .getByRole("button", { name: "Volver al historial", exact: true })
        .click();
      await openClosedReceipt(order.orderLabel);
      report.historyConfirmed = true;
      report.customerInput =
        "real opaque pass token via Código del pase; physical camera not exercised";
      report.orderId = order.id;
      report.valid = true;
      writeFileSync(
        `${directory}/browser.json`,
        JSON.stringify(report, null, 2),
        { mode: 0o600, flag: "wx" },
      );
    }
  } catch (error) {
    report.valid = false;
    report.failure = sanitize(error.message);
    try {
      await snapshot();
    } catch {
      report.failureSnapshotUnavailable = true;
    }
    save();
    writeFileSync(
      `${directory}/browser-failure-${Date.now()}.json`,
      JSON.stringify(report, null, 2),
      { mode: 0o600, flag: "wx" },
    );
    throw Error(report.failure);
  } finally {
    await context?.close();
    await browser?.close();
    report.finishedAt = new Date().toISOString();
    save();
  }
} else throw Error("Unknown mass smoke operation");
