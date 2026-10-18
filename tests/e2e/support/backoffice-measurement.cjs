/* Opt-in local-only 0238 measurement. No login, fixtures, writes, or response dumps.
 * Required: BASE_URL, COOKIE_FILE (Playwright cookies JSON array), MANIFEST, OUT,
 * RUN_TAG. Optional: RELOADS=5, TIMEOUT_MS=30000,
 * SETTLE_TIMEOUT_MS=5000, CPU_TRACE=0. CPU_TRACE is diagnostic, outside A/B timing.
 * Manifest: {case:'ready-empty'|'ready-five', cards:[{id,title,
 *   decisions:[{key,label}], action?:{label,href}}]}.
 * DOM has no card IDs: exact IDs come from validated Inbox response; titles and
 * actions identify the same synthetic cards in DOM. Only IDs leave this harness.
 */
(async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { createRequire } = await import("node:module");
  const { createHash } = await import("node:crypto");
  const root = path.resolve(__dirname, "../../..");
  const { chromium } = createRequire(path.join(root, "package.json"))(
    "@playwright/test",
  );

  function required(name) {
    if (!process.env[name]) throw new Error(`Missing ${name}`);
    return process.env[name];
  }
  function integer(name, fallback, min, max) {
    const n = Number(process.env[name] ?? fallback);
    if (!Number.isInteger(n) || n < min || n > max)
      throw new Error(`Invalid ${name}`);
    return n;
  }
  function hash(value) {
    return createHash("sha256").update(value).digest("hex");
  }
  function privateWrite(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", {
      mode: 0o600,
    });
    fs.chmodSync(file, 0o600);
  }
  function safeLocation(raw, origin) {
    try {
      const url = new URL(raw);
      // Never serialize query strings, fragments, credentials or external hosts.
      return url.origin === origin ? url.pathname : "[external]";
    } catch {
      return "[invalid]";
    }
  }

  async function main() {
    const base = new URL(required("BASE_URL"));
    if (
      !["http:", "https:"].includes(base.protocol) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      base.pathname !== "/"
    )
      throw new Error("BASE_URL must be a bare localhost origin");
    const runTag = required("RUN_TAG");
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(runTag))
      throw new Error("Invalid RUN_TAG");
    const out = path.resolve(required("OUT"));
    const manifestRaw = fs.readFileSync(required("MANIFEST"), "utf8");
    const manifest = JSON.parse(manifestRaw);
    const count =
      manifest.case === "ready-empty"
        ? 0
        : manifest.case === "ready-five"
          ? 5
          : -1;
    if (
      !Array.isArray(manifest.cards) ||
      manifest.cards.length !== count ||
      new Set(manifest.cards.map((c) => c.id)).size !== count ||
      new Set(manifest.cards.map((c) => c.title)).size !== count ||
      manifest.cards.some(
        (c) =>
          typeof c.id !== "string" ||
          !c.id ||
          typeof c.title !== "string" ||
          !c.title ||
          !Array.isArray(c.decisions) ||
          c.decisions.some(
            (d) => typeof d.key !== "string" || typeof d.label !== "string",
          ) ||
          (c.action &&
            (typeof c.action.label !== "string" ||
              typeof c.action.href !== "string")),
      )
    )
      throw new Error("Invalid synthetic Inbox manifest");
    const cookieFile = required("COOKIE_FILE");
    if ((fs.statSync(cookieFile).mode & 0o077) !== 0)
      throw new Error("COOKIE_FILE must be private (chmod 600)");
    const cookies = JSON.parse(fs.readFileSync(cookieFile, "utf8"));
    if (!Array.isArray(cookies) || !cookies.length)
      throw new Error("Expected Playwright cookie array");
    if (
      cookies.some(
        (c) => !["localhost", "127.0.0.1", "::1", "[::1]"].includes(c.domain),
      )
    )
      throw new Error("Cookie domain must be localhost");
    const reloads = integer("RELOADS", 5, 1, 30);
    const timeoutMs = integer("TIMEOUT_MS", 30000, 1000, 120000);
    const settleTimeoutMs = integer("SETTLE_TIMEOUT_MS", 5000, 500, 30000);
    const cpuTrace = process.env.CPU_TRACE === "1";
    const report = {
      formatVersion: 1,
      runTag,
      createdAt: new Date().toISOString(),
      harnessSha256: hash(fs.readFileSync(__filename)),
      manifestSha256: hash(manifestRaw),
      origin: base.origin,
      case: manifest.case,
      expectedIds: manifest.cards.map((c) => c.id),
      config: {
        reloads,
        timeoutMs,
        settleTimeoutMs,
        cpuTrace,
        viewport: { width: 1280, height: 900 },
        cache:
          "Chromium default HTTP cache enabled; one new context then retained across reloads",
        serviceWorkers: "blocked",
        prefetch: "application default unchanged",
        firstEntry: true,
        clock: "browser performance.now",
        byteAccounting:
          "CDP encodedDataLength transfer; dataReceived.dataLength decoded; document includes embedded RSC",
        ready:
          "DOM observer before commit, independently validated against Inbox response; not DCL/load/EOF",
      },
      attempts: [],
      limitations: [
        "Synthetic fixture manifest is required. This runner neither prepares nor restores DB/session state.",
        "Local browser/network measurements do not establish PostgreSQL execution time or PROD performance.",
        "DOM has no card IDs. IDs/versions/actions are validated independently from response; DOM matches synthetic titles/buttons.",
        "CDP decoded bytes can be zero/unavailable for disk cache and some redirects; never interpreted as zero work.",
        "No hydration completion or full JS CPU estimate is inferred; long tasks are diagnostic only.",
        "Server trace must correlate x-inbox-measurement; cookie/session renewal counts require server evidence.",
        "RSC embedded in document is not counted separately; seed bytes need additional server/build evidence.",
        "A/B block order, fixture restoration, uncertainty estimates and source SHAs are coordinator responsibilities.",
      ],
    };
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      report.browserVersion = browser.version();
      const context = await browser.newContext({
        viewport: report.config.viewport,
        serviceWorkers: "block",
      });
      await context.addCookies(cookies);
      await context.addInitScript(
        ({ cards }) => {
          const normalize = (text) => (text ?? "").replace(/\s+/g, " ").trim();
          const measurement = (window.__backofficeMeasurement = {
            readyAt: null,
            sectionFirstSeenAt: null,
            inboxFetchInvocationAt: [],
            domValidated: false,
            fcpAt: null,
            dclAt: null,
            loadAt: null,
            longTasks: [],
            resolutionMs: null,
            clockProbeDurationMs: null,
          });
          const clockProbeStartedAt = performance.now();
          let previous = clockProbeStartedAt;
          let resolution = Infinity;
          for (let i = 0; i < 10000; i++) {
            const now = performance.now();
            if (now > previous)
              resolution = Math.min(resolution, now - previous);
            previous = now;
          }
          measurement.resolutionMs = Number.isFinite(resolution)
            ? resolution
            : null;
          measurement.clockProbeDurationMs =
            performance.now() - clockProbeStartedAt;
          const originalFetch = window.fetch;
          window.fetch = function (...args) {
            const invocationAt = performance.now();
            try {
              const input = args[0];
              const raw =
                typeof input === "string"
                  ? input
                  : input instanceof URL
                    ? input.href
                    : input instanceof Request
                      ? input.url
                      : null;
              if (
                raw !== null &&
                new URL(raw, location.href).pathname === "/api/analytics/inbox"
              )
                measurement.inboxFetchInvocationAt.push(invocationAt);
            } catch {
              // Instrumentation must not change fetch validation/return behavior.
            }
            return Reflect.apply(originalFetch, this, args);
          };
          try {
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries())
                if (entry.name === "first-contentful-paint")
                  measurement.fcpAt = entry.startTime;
            }).observe({ type: "paint", buffered: true });
          } catch {
            /* browser support recorded as null */
          }
          try {
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries())
                measurement.longTasks.push({
                  startTime: entry.startTime,
                  duration: entry.duration,
                });
            }).observe({ type: "longtask", buffered: true });
          } catch {
            /* browser support recorded as empty */
          }
          document.addEventListener("DOMContentLoaded", () => {
            measurement.dclAt = performance.now();
          });
          window.addEventListener("load", () => {
            measurement.loadAt = performance.now();
          });
          function inspect() {
            if (measurement.readyAt !== null) return;
            const heading = document.getElementById("analytics-inbox-title");
            const section = heading?.closest("section");
            if (!section) return;
            // First observed DOM section, including skeleton; not React mount
            // or completion of hydration elsewhere in the document.
            if (measurement.sectionFirstSeenAt === null)
              measurement.sectionFirstSeenAt = performance.now();
            const articles = [...section.querySelectorAll("article")];
            let matches = articles.length === cards.length;
            if (!cards.length) {
              matches &&= normalize(section.textContent).includes(
                "Hoy no tengo nada para avisarte.",
              );
            } else {
              matches &&= cards.every((expected) => {
                const article = articles.find(
                  (item) =>
                    normalize(item.querySelector("h3")?.textContent) ===
                    normalize(expected.title),
                );
                if (!article) return false;
                const buttons = [...article.querySelectorAll("button")];
                if (
                  !expected.decisions.every((decision) =>
                    buttons.some(
                      (button) =>
                        normalize(button.textContent) ===
                          normalize(decision.label) &&
                        !button.disabled &&
                        button.getAttribute("aria-disabled") !== "true" &&
                        button.getAttribute("aria-busy") !== "true",
                    ),
                  )
                )
                  return false;
                return (
                  !expected.action ||
                  [...article.querySelectorAll("a")].some(
                    (link) =>
                      normalize(link.textContent) ===
                        normalize(expected.action.label) &&
                      link.getAttribute("href") === expected.action.href,
                  )
                );
              });
            }
            if (matches) {
              measurement.readyAt = performance.now();
              measurement.domValidated = true;
            }
          }
          new MutationObserver(inspect).observe(document, {
            childList: true,
            subtree: true,
            attributes: true,
          });
          inspect();
        },
        { cards: manifest.cards },
      );
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: false });
      let current = null;
      const responses = new Set();
      const pageResponse = async (response) => {
        const attempt = current;
        if (
          !attempt ||
          new URL(response.url()).pathname !== "/api/analytics/inbox"
        )
          return;
        const observed = {
          status: response.status(),
          valid: false,
          state: null,
          cardIds: [],
          cardVersions: [],
        };
        attempt.inboxResponses.push(observed);
        try {
          const payload = await response.json();
          const cards = Array.isArray(payload.cards) ? payload.cards : [];
          observed.state = ["ready", "preparing"].includes(payload.state)
            ? payload.state
            : "[invalid]";
          // Whitelist known synthetic IDs; unknown IDs are never written to artifacts.
          observed.cardIds = cards.map((c) =>
            manifest.cards.some((m) => m.id === c.id) ? c.id : "[unexpected]",
          );
          observed.cardVersions = cards.map((c) =>
            typeof c.version === "number" ? c.version : null,
          );
          observed.valid =
            response.ok() &&
            payload.contractVersion === 2 &&
            payload.state === "ready" &&
            cards.length === manifest.cards.length &&
            manifest.cards.every((expected) =>
              cards.some(
                (card) =>
                  card.id === expected.id &&
                  card.title === expected.title &&
                  JSON.stringify(
                    card.decisions?.map((d) => ({
                      key: d.key,
                      label: d.label,
                    })),
                  ) === JSON.stringify(expected.decisions) &&
                  (expected.action
                    ? card.action?.label === expected.action.label &&
                      card.action?.href === expected.action.href
                    : !card.action),
              ),
            );
        } catch {
          observed.readError = true;
        }
      };
      page.on("response", (response) => {
        const task = pageResponse(response).finally(() =>
          responses.delete(task),
        );
        responses.add(task);
      });
      page.on("pageerror", () => {
        if (current) current.pageErrors += 1;
      });
      const entries = new Map();
      cdp.on("Network.requestWillBeSent", (event) => {
        if (!current) return;
        const row = {
          id: event.requestId,
          path: safeLocation(event.request.url, base.origin),
          type: event.type,
          method: event.request.method,
          startMs: null,
          status: null,
          encodedBytes: null,
          decodedBytes: 0,
          cache: null,
          endMs: null,
          failed: false,
        };
        if (current.networkOrigin === null && event.type === "Document") {
          current.networkOrigin = event.timestamp;
          current.networkWallTime = event.wallTime;
        }
        row.startMs =
          current.networkOrigin === null
            ? null
            : (event.timestamp - current.networkOrigin) * 1000;
        entries.set(event.requestId, { attempt: current, row });
        current.network.push(row);
      });
      cdp.on("Network.responseReceived", (event) => {
        const entry = entries.get(event.requestId);
        if (!entry) return;
        entry.row.status = event.response.status;
        entry.row.mime = event.response.mimeType;
        entry.row.cache = event.response.fromDiskCache
          ? "disk"
          : event.response.fromServiceWorker
            ? "service-worker"
            : "network-or-memory";
        entry.row.responseMs =
          (event.timestamp - entry.attempt.networkOrigin) * 1000 +
          (entry.attempt.clockOffsetMs ?? 0);
        const mime = event.response.mimeType ?? "";
        entry.row.category = mime.includes("text/x-component")
          ? "rsc"
          : entry.row.type === "Document"
            ? "document"
            : entry.row.type === "Script"
              ? "js"
              : entry.row.type === "Stylesheet"
                ? "css"
                : "other";
      });
      cdp.on("Network.dataReceived", (event) => {
        const entry = entries.get(event.requestId);
        if (entry) entry.row.decodedBytes += event.dataLength;
      });
      cdp.on("Network.loadingFinished", (event) => {
        const entry = entries.get(event.requestId);
        if (!entry) return;
        entry.row.encodedBytes = event.encodedDataLength;
        entry.row.endMs =
          (event.timestamp - entry.attempt.networkOrigin) * 1000 +
          (entry.attempt.clockOffsetMs ?? 0);
        entries.delete(event.requestId);
      });
      cdp.on("Network.loadingFailed", (event) => {
        const entry = entries.get(event.requestId);
        if (!entry) return;
        entry.row.failed = true;
        entry.row.cancelled = event.canceled === true;
        entry.row.error = event.errorText;
        entry.row.endMs =
          (event.timestamp - entry.attempt.networkOrigin) * 1000 +
          (entry.attempt.clockOffsetMs ?? 0);
        entries.delete(event.requestId);
      });
      // Diagnostic profiler records CPU timing only, not raw JS/source/heap or URLs.
      if (cpuTrace) await cdp.send("Profiler.enable");
      const total = reloads + 1;
      for (let index = 0; index < total; index++) {
        const first = index === 0;
        const attempt = (current = {
          tag: `${runTag}-${first ? "first" : "reload"}-${index}`,
          kind: first ? "first-entry" : "reload",
          networkOrigin: null,
          network: [],
          inboxResponses: [],
          pageErrors: 0,
          readyTimeout: false,
          settleTimeout: false,
          navigationError: null,
        });
        report.attempts.push(attempt);
        await page.setExtraHTTPHeaders({ "x-inbox-measurement": attempt.tag });
        if (cpuTrace) await cdp.send("Profiler.start");
        try {
          // Preserve context/cache; reloads use actual browser reload semantics.
          if (first) {
            await page.goto(`${base.origin}/backoffice`, {
              waitUntil: "commit",
              timeout: timeoutMs,
            });
          } else {
            await page.reload({ waitUntil: "commit", timeout: timeoutMs });
          }
          await page.waitForFunction(
            () =>
              window.__backofficeMeasurement?.readyAt !== null &&
              window.__backofficeMeasurement?.readyAt !== undefined,
            null,
            { timeout: timeoutMs },
          );
        } catch (error) {
          attempt.readyTimeout = error.name === "TimeoutError";
          attempt.navigationError = error.name; // no URL, body, auth or response text
        }
        try {
          // This is AFTER observing ready; DCL/load/EOF never gate the ready clock.
          await page.waitForFunction(
            () =>
              performance.getEntriesByType("navigation")[0]?.responseEnd > 0 &&
              window.__backofficeMeasurement?.loadAt !== null,
            null,
            { timeout: settleTimeoutMs },
          );
          const deadline = Date.now() + settleTimeoutMs;
          while (
            responses.size ||
            [...entries.values()].some((entry) => entry.attempt === attempt)
          ) {
            if (Date.now() >= deadline) throw new Error("settle-timeout");
            await new Promise((resolve) => setTimeout(resolve, 25));
          }
        } catch {
          attempt.settleTimeout = true;
        }
        try {
          const metrics = await page.evaluate(() => {
            const nav = performance.getEntriesByType("navigation")[0];
            return {
              ...window.__backofficeMeasurement,
              timeOrigin: performance.timeOrigin,
              navigation: nav
                ? {
                    ttfbMs: nav.responseStart - nav.startTime,
                    responseEnd: nav.responseEnd,
                    domContentLoaded: nav.domContentLoadedEventEnd,
                    loadEnd: nav.loadEventEnd,
                    transferSize: nav.transferSize,
                    encodedBodySize: nav.encodedBodySize,
                    decodedBodySize: nav.decodedBodySize,
                  }
                : null,
              resources: performance
                .getEntriesByType("resource")
                .map((resource) => ({
                  path:
                    new URL(resource.name).origin === location.origin
                      ? new URL(resource.name).pathname
                      : "[external]",
                  initiator: resource.initiatorType,
                  startTime: resource.startTime,
                  responseStart: resource.responseStart,
                  responseEnd: resource.responseEnd,
                  duration: resource.duration,
                  transferSize: resource.transferSize,
                  encodedBodySize: resource.encodedBodySize,
                  decodedBodySize: resource.decodedBodySize,
                })),
            };
          });
          attempt.metrics = metrics;
          // CDP wallTime anchors its monotonic clock to this document's timeOrigin.
          attempt.clockOffsetMs =
            attempt.networkWallTime * 1000 - metrics.timeOrigin;
          for (const row of attempt.network) {
            for (const key of ["startMs", "responseMs", "endMs"])
              if (typeof row[key] === "number")
                row[key] += attempt.clockOffsetMs;
          }
          attempt.valid =
            metrics.domValidated === true &&
            attempt.inboxResponses.some((r) => r.valid) &&
            !attempt.readyTimeout &&
            !attempt.navigationError &&
            attempt.pageErrors === 0;
          attempt.inboxTimings = metrics.resources.filter(
            (r) => r.path === "/api/analytics/inbox",
          );
          const aggregate = (until) =>
            Object.fromEntries(
              ["document", "rsc", "js", "css", "other"].map((category) => {
                const rows = attempt.network.filter(
                  (row) =>
                    row.category === category &&
                    row.endMs !== null &&
                    row.endMs <= until,
                );
                return [
                  category,
                  {
                    completed: rows.length,
                    transferredBytes: rows.reduce(
                      (sum, row) => sum + (row.encodedBytes ?? 0),
                      0,
                    ),
                    decodedBytes: rows.reduce(
                      (sum, row) => sum + row.decodedBytes,
                      0,
                    ),
                  },
                ];
              }),
            );
          attempt.bytes = {
            untilReadyCompletedResources: aggregate(metrics.readyAt ?? -1),
            totalCompletedResources: aggregate(Infinity),
            note: "Resources still streaming at ready are not included in completed-resource totals; inspect network start/end.",
          };
        } catch {
          attempt.metricsUnavailable = true;
          attempt.valid = false;
        }
        if (cpuTrace) {
          const { profile } = await cdp.send("Profiler.stop");
          attempt.cpuDiagnostic = {
            startTime: profile.startTime,
            endTime: profile.endTime,
            samples: profile.samples?.length ?? 0,
            sampledTimeUs:
              profile.timeDeltas?.reduce((a, b) => a + b, 0) ?? null,
          };
        }
        attempt.networkClockOrigin = attempt.networkOrigin; // CDP monotonic origin; not wall time
        privateWrite(out, report); // retain every completed/failed attempt immediately
      }
      await context.close();
      report.completed = true;
      report.valid = report.attempts.every(
        (attempt) => attempt.valid && !attempt.settleTimeout,
      );
      if (!report.valid) process.exitCode = 2;
    } catch (error) {
      report.completed = false;
      report.fatal = error.name; // never dump potentially private browser exceptions
      process.exitCode = 1;
    } finally {
      if (browser) await browser.close();
      privateWrite(out, report);
    }
  }
  await main();
})().catch((error) => {
  // Configuration failure occurs before browser/server contact; only class emitted.
  process.stderr.write(`Measurement setup failed (${error.name}).\n`);
  process.exitCode = 1;
});
