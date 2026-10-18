/* Local real-build M0. No fixture/login writes, API interception or response body dumps.
 * CASE=empty|normal|volume ROLE=owner|staff RELOADS=30 RUN_TAG=pos-... OUT=<private.json>
 * All attempts preserved. Read-only list campaign; mutation smokes use separate fixture state.
 */
(async () => {
  const fs = await import("node:fs"),
    path = await import("node:path"),
    crypto = await import("node:crypto");
  const { execFileSync } = await import("node:child_process");
  const { chromium } = await import("@playwright/test");
  const directory = "/private/tmp/checkpass-pos-0242/private";
  const hash = (v) => crypto.createHash("sha256").update(v).digest("hex");
  const config = JSON.parse(
    fs.readFileSync(path.join(directory, "selected.json")),
  );
  const manifestRaw = fs.readFileSync(
      path.join(directory, "fixture.json"),
      "utf8",
    ),
    manifest = JSON.parse(manifestRaw);
  const which = process.env.CASE,
    role = process.env.ROLE,
    run = process.env.RUN_TAG;
  const fixture = manifest.fixtures.find((f) => f.case === which);
  if (
    !fixture ||
    !["owner", "staff"].includes(role) ||
    !/^pos-[a-z0-9-]+$/.test(run ?? "") ||
    config.BETTER_AUTH_URL !== "http://localhost:43242" ||
    manifest.endpoint !== config.POS_MEASUREMENT_ENDPOINT_SHA12 ||
    manifest.phase !== "ready"
  )
    throw Error("Invalid frozen local fixture/config");
  const cookieFile = path.join(directory, `cookies-${which}-${role}.json`);
  if (fs.statSync(cookieFile).mode & 0o077)
    throw Error("Private cookies required");
  const cookies = JSON.parse(fs.readFileSync(cookieFile));
  if (cookies.some((c) => c.domain !== "localhost"))
    throw Error("Invalid local cookies");
  const out = path.resolve(process.env.OUT ?? "");
  if (!out.startsWith(directory + "/") || fs.existsSync(out))
    throw Error("Exclusive private output required");
  const reloads = Number(process.env.RELOADS ?? 30);
  if (!Number.isInteger(reloads) || reloads < 0 || reloads > 60)
    throw Error("Invalid reload count");
  const report = {
    version: 1,
    createdAt: new Date().toISOString(),
    source: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    harnessSha256: hash(fs.readFileSync(__filename)),
    manifestSha256: hash(manifestRaw),
    case: which,
    role,
    browser: null,
    config: {
      reloads,
      viewport: { width: 1280, height: 900 },
      cache: "normal within context; first assets separate",
      ready:
        "manifest-backed list DOM plus authorized Nueva orden action, independent response assertion",
      db: "prepared/warm; no DB-cold claim",
      seed: 24220261018,
      bootstrap: 10000,
    },
    attempts: [],
  };
  const save = () =>
    fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n", {
      mode: 0o600,
    });
  save();
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    report.browser = browser.version();
    const context = await browser.newContext({
      viewport: report.config.viewport,
      serviceWorkers: "block",
    });
    await context.addCookies(cookies);
    await context.route("**/*", (route) => {
      let u = new URL(route.request().url());
      if (u.origin !== "http://localhost:43242") {
        if (current) current.externalBlocked++;
        return route.abort();
      }
      return route.continue();
    });
    await context.addInitScript(
      ({ count, labels }) => {
        const state = (window.__posMeasurement = {
          readyAt: null,
          longTasks: [],
          fcpAt: null,
          fetches: [],
        });
        const fetch = window.fetch;
        window.fetch = function (...args) {
          try {
            const input = args[0];
            const url = new URL(
              typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.href
                  : input.url,
              location.href,
            );
            state.fetches.push({ path: url.pathname, at: performance.now() });
          } catch {
            /* Observer failure is recorded as missing metrics; preserve fetch behavior. */
          }
          return Reflect.apply(fetch, this, args);
        };
        try {
          new PerformanceObserver((list) => {
            for (const e of list.getEntries())
              state.longTasks.push({ start: e.startTime, ms: e.duration });
          }).observe({ type: "longtask", buffered: true });
        } catch {
          /* Observer failure is recorded as missing metrics; preserve fetch behavior. */
        }
        try {
          new PerformanceObserver((list) => {
            for (const e of list.getEntries())
              if (e.name === "first-contentful-paint")
                state.fcpAt = e.startTime;
          }).observe({ type: "paint", buffered: true });
        } catch {
          /* Observer failure is recorded as missing metrics; preserve fetch behavior. */
        }
        function inspect() {
          if (state.readyAt !== null) return;
          const heading = [...document.querySelectorAll("h1")].find(
            (e) => e.textContent === "POS",
          );
          const create = [...document.querySelectorAll("button")].find(
            (e) => e.textContent.trim() === "Nueva orden" && !e.disabled,
          );
          if (!heading || !create) return;
          const buttons = [...document.querySelectorAll("button")].filter((e) =>
            e.getAttribute("aria-label")?.startsWith("Abrir M0 "),
          );
          const text = document.body.textContent;
          const valid = count
            ? buttons.length === count &&
              labels.every((l) =>
                buttons.some(
                  (b) => b.getAttribute("aria-label") === `Abrir ${l}`,
                ),
              )
            : text.includes("No hay órdenes abiertas.");
          if (valid) state.readyAt = performance.now();
        }
        new MutationObserver(inspect).observe(document, {
          subtree: true,
          childList: true,
          attributes: true,
        });
        inspect();
      },
      {
        count: fixture.orders.length,
        labels: fixture.orders.map(
          (_, i) => `M0 ${String(i).padStart(3, "0")}`,
        ),
      },
    );
    const page = await context.newPage(),
      cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: false });
    let current = null;
    const pending = new Set(),
      network = new Map();
    cdp.on("Network.requestWillBeSent", (e) => {
      if (!current) return;
      const u = new URL(e.request.url);
      if (u.origin !== "http://localhost:43242") return;
      const row = {
        path: u.pathname,
        type: e.type,
        start: e.timestamp,
        wall: e.wallTime,
        status: null,
        encoded: null,
        decoded: 0,
        end: null,
        failed: false,
      };
      current.network.push(row);
      network.set(e.requestId, { row, attempt: current });
    });
    cdp.on("Network.responseReceived", (e) => {
      const x = network.get(e.requestId);
      if (x) {
        x.row.status = e.response.status;
        x.row.response = e.timestamp;
        x.row.mime = e.response.mimeType;
      }
    });
    cdp.on("Network.dataReceived", (e) => {
      const x = network.get(e.requestId);
      if (x) x.row.decoded += e.dataLength;
    });
    cdp.on("Network.loadingFinished", (e) => {
      const x = network.get(e.requestId);
      if (x) {
        x.row.encoded = e.encodedDataLength;
        x.row.end = e.timestamp;
        network.delete(e.requestId);
      }
    });
    cdp.on("Network.loadingFailed", (e) => {
      const x = network.get(e.requestId);
      if (x) {
        x.row.end = e.timestamp;
        x.row.failed = true;
        x.row.cancelled = e.canceled;
        network.delete(e.requestId);
      }
    });
    page.on("pageerror", () => {
      if (current) current.pageErrors++;
    });
    page.on("response", (response) => {
      const a = current;
      if (!a || new URL(response.url()).pathname !== "/api/modules/pos/orders")
        return;
      const task = (async () => {
        const observed = { status: response.status(), valid: false };
        a.listResponses.push(observed);
        try {
          const data = await response.json();
          observed.valid =
            response.status() === 200 &&
            Array.isArray(data.open) &&
            data.open.length === fixture.orders.length &&
            data.open.every(
              (o) =>
                fixture.orders.includes(o.id) &&
                o.status === "open" &&
                o.itemCount === fixture.linesPerOrder &&
                o.total === `${fixture.linesPerOrder * 2}.00`,
            ) &&
            data.closedToday?.length === 0;
        } catch {
          observed.readError = true;
        }
      })().finally(() => pending.delete(task));
      pending.add(task);
    });
    for (let i = 0; i <= reloads; i++) {
      current = {
        tag: `${run}-${i}`,
        kind: i === 0 ? "first-assets" : "reload",
        network: [],
        listResponses: [],
        pageErrors: 0,
        externalBlocked: 0,
        readyTimeout: false,
        settleTimeout: false,
      };
      const a = current;
      report.attempts.push(a);
      await page.setExtraHTTPHeaders({ "x-pos-measurement": a.tag });
      try {
        if (i === 0)
          await page.goto("http://localhost:43242/backoffice/pos", {
            waitUntil: "commit",
            timeout: 30000,
          });
        else await page.reload({ waitUntil: "commit", timeout: 30000 });
        await page.waitForFunction(
          () =>
            window.__posMeasurement?.readyAt !== null &&
            window.__posMeasurement?.readyAt !== undefined,
          null,
          { timeout: 30000 },
        );
      } catch (error) {
        a.readyTimeout = error.name === "TimeoutError";
        a.navigationError = error.name;
      }
      const deadline = Date.now() + 10000;
      while (
        pending.size ||
        [...network.values()].some((x) => x.attempt === a)
      ) {
        if (Date.now() > deadline) {
          a.settleTimeout = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 25));
      }
      try {
        a.metrics = await page.evaluate(() => {
          const n = performance.getEntriesByType("navigation")[0];
          return {
            ...window.__posMeasurement,
            timeOrigin: performance.timeOrigin,
            navigation: n
              ? {
                  ttfb: n.responseStart,
                  responseEnd: n.responseEnd,
                  encoded: n.encodedBodySize,
                  decoded: n.decodedBodySize,
                }
              : null,
            resources: performance.getEntriesByType("resource").map((e) => ({
              path: new URL(e.name).pathname,
              start: e.startTime,
              end: e.responseEnd,
              encoded: e.encodedBodySize,
              decoded: e.decodedBodySize,
              transfer: e.transferSize,
            })),
          };
        });
      } catch {
        a.metricsUnavailable = true;
      }
      a.valid =
        typeof a.metrics?.readyAt === "number" &&
        a.listResponses.length === 1 &&
        a.listResponses.every((r) => r.valid) &&
        !a.readyTimeout &&
        !a.navigationError &&
        !a.settleTimeout &&
        a.pageErrors === 0 &&
        a.externalBlocked === 0;
      save();
    }
    await context.close();
    report.completed = true;
    report.valid = report.attempts.every((a) => a.valid);
    if (!report.valid) process.exitCode = 2;
  } catch (error) {
    report.completed = false;
    report.fatal = error.name;
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    save();
  }
})().catch((error) => {
  process.stderr.write(`Measurement setup failed (${error.name}).\n`);
  process.exitCode = 1;
});
