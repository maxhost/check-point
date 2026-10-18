// Own CP1a native smoke. Never reads/writes M0 fixtures, cookies, RAW or builds.
import { readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync, execFileSync } from "node:child_process";
const directory = "/private/tmp/checkpass-pos-0242/scope-client";
mkdirSync(directory, { recursive: true, mode: 0o700 });
chmodSync(directory, 0o700);
const selected = "/private/tmp/checkpass-pos-0242/private/selected.json";
const config = JSON.parse(readFileSync(selected));
const hash = (value) => createHash("sha256").update(value).digest("hex");
const blocked = readFileSync("packages/db/src/local.ts", "utf8").match(
  /PROD_DB_ENDPOINT_SHA12 = "([a-f0-9]{12})"/,
)[1];
for (const key of ["NEON_CI_DATABASE_URL", "NEON_CI_DATABASE_URL_UNPOOLED"]) {
  const host = new URL(config[key]).hostname;
  if (!/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(host))
    throw Error("Protected Neon host required");
  let endpoint = host.split(".")[0],
    previous;
  do {
    previous = endpoint;
    endpoint = endpoint.replace(/-(pooler|rvr)$/, "");
  } while (previous !== endpoint);
  if (
    hash(endpoint).slice(0, 12) === blocked ||
    hash(endpoint).slice(0, 12) !== config.POS_MEASUREMENT_ENDPOINT_SHA12
  )
    throw Error("Protected CI mismatch");
}
if (
  config.BETTER_AUTH_URL !== "http://localhost:43242" ||
  config.BETTER_AUTH_SECRET.length < 32
)
  throw Error("Invalid local configuration");
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  NVM_DIR: process.env.NVM_DIR,
  CI: "1",
  ...config,
  DATABASE_URL: config.NEON_CI_DATABASE_URL,
  EMAIL_PROVIDER: "console",
  AI_PROVIDER: "fake",
  CONSUMER_ORIGIN: "http://localhost:43243",
  NEON_TEST_ENV_FILE: "/private/tmp/checkpass-pos-0242/private/ci.env",
};
const run = (command, args, extra = {}) => {
  const result = spawnSync(command, args, {
    env: { ...env, ...extra },
    stdio: "inherit",
  });
  process.exitCode = result.status ?? 1;
};
const mode = process.argv[2];
if (mode === "fixture")
  run(
    "bash",
    [
      "tools/neon-test.sh",
      "src/modules/pos/server/pos-context-native.neon.integration.test.ts",
      "--no-file-parallelism",
    ],
    {
      POS_SCOPE_CLIENT_NATIVE: "true",
      POS_SCOPE_CLIENT_OPERATION: process.argv[3],
    },
  );
else if (mode === "build")
  run(
    "pnpm",
    [
      "--filter",
      "@mi-pasaporte/merchant",
      "exec",
      "next",
      "build",
      "--webpack",
    ],
    { NODE_ENV: "production" },
  );
else if (mode === "start")
  run(
    "pnpm",
    [
      "--filter",
      "@mi-pasaporte/merchant",
      "exec",
      "next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "43242",
    ],
    { NODE_ENV: "production" },
  );
else if (mode === "browser") {
  const { chromium, expect } = await import("@playwright/test");
  const fixture = JSON.parse(readFileSync(`${directory}/native-private.json`));
  if (fixture.kind !== "scope-client-0242" || fixture.worlds.length !== 2)
    throw Error("Own fixture required");
  const [a, b] = fixture.worlds;
  const cookie = (world) => {
    const pair = world.ownerCookie;
    const at = pair.indexOf("=");
    return {
      name: pair.slice(0, at),
      value: pair.slice(at + 1),
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    };
  };
  const report = {
    source: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    node: process.version,
    buildId: readFileSync("apps/merchant/.next/BUILD_ID", "utf8").trim(),
    configSha256: hash(readFileSync(selected)),
    lockSha256: hash(readFileSync("pnpm-lock.yaml")),
    endpoint: config.POS_MEASUREMENT_ENDPOINT_SHA12,
    requests: [],
    negative: null,
  };
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  try {
    await context.addCookies([cookie(a)]);
    const page = await context.newPage();
    page.on("request", (r) => {
      const path = new URL(r.url()).pathname;
      if (path.startsWith("/api/"))
        report.requests.push({
          path,
          method: r.method(),
          scoped: !!r.headers()["x-backoffice-scope"],
        });
    });
    await page.goto("http://localhost:43242/backoffice/pos");
    await expect(
      page.getByRole("button", { name: "Nueva orden", exact: true }),
    ).toBeEnabled();
    await expect
      .poll(
        () =>
          report.requests.filter((r) => r.path === "/api/modules/pos/orders")
            .length,
      )
      .toBe(1);
    expect(
      report.requests.filter(
        (r) =>
          r.path === "/api/merchant/session" ||
          r.path === "/api/business/modules",
      ),
    ).toHaveLength(0);
    expect(
      report.requests
        .filter((r) => r.path.startsWith("/api/modules/pos/"))
        .every((r) => r.scoped),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Nueva orden", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Nombre de mesa", exact: true })
      .fill("scope-client-negative-A");
    await page
      .getByRole("button", { name: "Tomar pedido", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Agregar Medialuna", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Revisar pedido", exact: true })
      .click();
    // Read the real server response before document retirement clears Chromium's
    // body cache. This observer pauses delivery only; it never replaces payloads.
    const observer = await context.newCDPSession(page);
    let observedPayload;
    await observer.send("Fetch.enable", {
      patterns: [
        { urlPattern: "*/api/modules/pos/orders", requestStage: "Response" },
      ],
    });
    observer.on("Fetch.requestPaused", async (event) => {
      try {
        if (
          event.request.method === "POST" &&
          event.responseStatusCode === 409
        ) {
          const body = await observer.send("Fetch.getResponseBody", {
            requestId: event.requestId,
          });
          observedPayload = JSON.parse(
            body.base64Encoded
              ? Buffer.from(body.body, "base64").toString("utf8")
              : body.body,
          );
        }
      } finally {
        await observer.send("Fetch.continueResponse", {
          requestId: event.requestId,
        });
      }
    });
    await context.addCookies([cookie(b)]);
    const negative = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/api/modules/pos/orders" &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: /^Guardar (pedido|orden)$/ })
      .click();
    const response = await negative;
    const payload = observedPayload;
    expect(response.status()).toBe(409);
    expect(payload?.code).toBe("backoffice_context_changed");
    await page.waitForURL("http://localhost:43242/backoffice");
    await expect(
      page.getByText("scope-client-negative-A", { exact: true }),
    ).toHaveCount(0);
    report.negative = {
      status: response.status(),
      code: payload.code,
      retiredDocument: true,
      writeCount: report.requests.filter(
        (r) => r.path === "/api/modules/pos/orders" && r.method === "POST",
      ).length,
    };
    expect(report.negative.writeCount).toBe(1);
    writeFileSync(
      `${directory}/native-browser.json`,
      JSON.stringify(report, null, 2),
      { mode: 0o600 },
    );
  } finally {
    await context.close();
    await browser.close();
  }
} else throw Error("Unknown native smoke operation");
