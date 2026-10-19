/** Real build/UI/auth/DB list cut. No API routing/mocks or response body dumps. */
import {
  readFileSync,
  existsSync,
  writeFileSync,
  openSync,
  closeSync,
} from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { chromium } from "@playwright/test";
import {
  ROOT,
  hash,
  exclusive,
  privateFile,
  verifyFreeze,
  environment,
} from "./m1.mjs";

const ORIGIN = "http://localhost:43242",
  TIMEOUT = 30000;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const pathOnly = (url) => {
  try {
    return new URL(url, ORIGIN).pathname;
  } catch {
    return "[invalid-url]";
  }
};
async function listening() {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port: 43242 });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}
async function start(directory, runtime, id) {
  if (await listening())
    throw Error("Reserved port already occupied; no process touched");
  const fd = openSync(join(directory, `server-${id}.log`), "wx", 0o600);
  const env = {
    ...environment(directory),
    NODE_ENV: "production",
    NODE_OPTIONS: `--import=${join(ROOT, "tests/e2e/support/pos-measurement-preload.mjs")}`,
  };
  const child = spawn(
    process.execPath,
    [
      join(ROOT, "apps/merchant/node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "43242",
    ],
    { cwd: join(runtime, "apps/merchant"), env, stdio: ["ignore", fd, fd] },
  );
  closeSync(fd);
  let spawnError;
  child.once("error", (error) => {
    spawnError = error;
  });
  const stopped = new Promise((r) => child.once("exit", r));
  const stop = async () => {
    if (child.exitCode !== null || child.signalCode !== null || spawnError)
      return;
    child.kill("SIGTERM");
    let exited = false;
    stopped.then(() => {
      exited = true;
    });
    const deadline = Date.now() + 10000;
    while (!exited && Date.now() < deadline) await pause(25);
    if (!exited)
      throw Error(
        `Own server PID${child.pid} did not terminate; preserve and stop campaign`,
      );
  };
  try {
    const deadline = Date.now() + TIMEOUT;
    while (!(await listening())) {
      if (
        spawnError ||
        child.exitCode !== null ||
        child.signalCode !== null ||
        Date.now() > deadline
      )
        throw Error(
          "Own production server failed readiness; private server log preserved",
        );
      await pause(25);
    }
    return { child, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
function installMarker({ labels, empty }) {
  const state = (window.__m1 = { listAt: null, longTasks: [], errors: [] });
  try {
    new PerformanceObserver((entries) =>
      state.longTasks.push(
        ...entries
          .getEntries()
          .map((e) => ({ start: e.startTime, duration: e.duration })),
      ),
    ).observe({ type: "longtask", buffered: true });
  } catch {
    state.errors.push("longtask-observer-unavailable");
  }
  function visible(e) {
    return (
      !!e.getClientRects().length && getComputedStyle(e).visibility !== "hidden"
    );
  }
  function inspect() {
    if (state.listAt !== null) return;
    const headings = [...document.querySelectorAll("h1")];
    const buttons = [...document.querySelectorAll("button")].filter(visible);
    const create = buttons.find(
      (b) => b.textContent?.trim() === "Nueva orden" && !b.disabled,
    );
    if (
      !headings.some((h) =>
        ["POS", "Pedidos"].includes(h.textContent?.trim()),
      ) ||
      !create
    )
      return;
    const cards = buttons.filter((b) =>
      b.getAttribute("aria-label")?.startsWith("Abrir M1 "),
    );
    const actual = new Set(
      cards.map((b) => b.getAttribute("aria-label")?.slice(6)),
    );
    const ready = empty
      ? document.body.textContent.includes("No hay órdenes abiertas.") ||
        document.body.textContent.includes("No hay pedidos en esta vista.")
      : actual.size === labels.length &&
        labels.every((l) => actual.has(l)) &&
        cards.every((b) => !b.disabled);
    if (ready) {
      state.listAt = performance.now();
      state.labels = [...actual];
    }
  }
  new MutationObserver(inspect).observe(document, {
    childList: true,
    subtree: true,
    attributes: true,
  });
  inspect();
}
async function settle(observation, pending, network) {
  let quietSince = null;
  const deadline = Date.now() + 15000;
  while (Date.now() <= deadline) {
    if (!pending.size && !network.size) {
      quietSince ??= Date.now();
      if (Date.now() - quietSince >= 500) {
        observation.settlement = "finish";
        return;
      }
    } else quietSince = null;
    await pause(25);
  }
  observation.settlement = "timeout";
  for (const { row } of network.values()) row.termination = "timeout";
}
async function instrument(context, fixture, source, save) {
  const labels = fixture.orders
    .filter((_, i) => i % 2 === 0)
    .map((id) => `M1 ${String(fixture.orders.indexOf(id)).padStart(3, "0")}`);
  await context.addInitScript(installMarker, {
    labels,
    empty: fixture.orders.length === 0,
  });
  const page = await context.newPage(),
    cdp = await context.newCDPSession(page);
  page.setDefaultTimeout(TIMEOUT);
  page.setDefaultNavigationTimeout(TIMEOUT);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: false });
  let current;
  const network = new Map(),
    pending = new Set();
  cdp.on("Network.requestWillBeSent", (event) => {
    if (!current) return;
    const url = new URL(event.request.url);
    const row = {
      path: url.pathname,
      local: url.origin === ORIGIN,
      method: event.request.method,
      type: event.type,
      start: event.timestamp,
      status: null,
      encoded: null,
      decoded: 0,
      termination: null,
      initiator: {
        type: event.initiator.type,
        stack:
          event.initiator.stack?.callFrames?.slice(0, 8).map((f) => ({
            path: pathOnly(f.url),
            line: f.lineNumber,
            column: f.columnNumber,
          })) ?? [],
      },
    };
    current.network.push(row);
    network.set(event.requestId, { row });
  });
  cdp.on("Network.responseReceived", (event) => {
    const row = network.get(event.requestId)?.row;
    if (row)
      Object.assign(row, {
        status: event.response.status,
        response: event.timestamp,
        mime: event.response.mimeType,
        fromDiskCache: event.response.fromDiskCache === true,
        fromServiceWorker: event.response.fromServiceWorker === true,
      });
  });
  cdp.on("Network.requestServedFromCache", (e) => {
    const row = network.get(e.requestId)?.row;
    if (row) row.servedFromCache = true;
  });
  cdp.on("Network.dataReceived", (e) => {
    const row = network.get(e.requestId)?.row;
    if (row) row.decoded += e.dataLength;
  });
  cdp.on("Network.loadingFinished", (e) => {
    const row = network.get(e.requestId)?.row;
    if (row)
      Object.assign(row, {
        encoded: e.encodedDataLength,
        end: e.timestamp,
        termination: "finish",
      });
    network.delete(e.requestId);
  });
  cdp.on("Network.loadingFailed", (e) => {
    const row = network.get(e.requestId)?.row;
    if (row)
      Object.assign(row, {
        end: e.timestamp,
        termination: "error",
        cancelled: e.canceled === true,
      });
    network.delete(e.requestId);
  });
  page.on("pageerror", () => {
    if (current) current.pageErrors++;
    save();
  });
  page.on("response", (response) => {
    if (
      !current ||
      new URL(response.url()).pathname !== "/api/modules/pos/orders" ||
      response.request().method() !== "GET"
    )
      return;
    const observation = current,
      row = { status: response.status(), valid: false };
    observation.listResponses.push(row);
    const task = (async () => {
      try {
        const data = await response.json();
        row.valid =
          response.status() === 200 &&
          data.open?.length === fixture.orders.length &&
          new Set(data.open.map((r) => r.id)).size === fixture.orders.length &&
          data.open.every((r) => {
            const i = fixture.orders.indexOf(r.id);
            return (
              i >= 0 &&
              r.location?.id === fixture.locations[i % 2] &&
              r.location?.name === (i % 2 ? "Norte" : "Centro") &&
              (source === "control" ? r.tableLabel : r.orderLabel) ===
                `M1 ${String(i).padStart(3, "0")}` &&
              r.status === "open" &&
              (source === "control" ? r.itemCount : r.lineCount) ===
                fixture.linesPerOrder &&
              Number(r.total) === fixture.linesPerOrder * 2
            );
          }) &&
          data.closedToday?.length === 0;
      } catch {
        row.readError = true;
      }
    })().finally(() => pending.delete(task));
    pending.add(task);
  });
  function begin(observation) {
    current = observation;
    return page.setExtraHTTPHeaders({ "x-pos-measurement": observation.tag });
  }
  async function full(observation, reload = false) {
    await begin(observation);
    if (reload) await page.reload({ waitUntil: "commit" });
    else await page.goto(`${ORIGIN}/backoffice/pos`, { waitUntil: "commit" });
    await page.waitForFunction(() => Number.isFinite(window.__m1?.listAt));
    observation.listUsableMs = await page.evaluate(() => window.__m1.listAt);
    await settle(observation, pending, network);
    observation.browser = await page.evaluate(() => ({
      ...window.__m1,
      timeOrigin: performance.timeOrigin,
      navigation: performance.getEntriesByType("navigation").map((n) => ({
        ttfb: n.responseStart,
        end: n.responseEnd,
        encoded: n.encodedBodySize,
        decoded: n.decodedBodySize,
      })),
      resources: performance.getEntriesByType("resource").map((r) => ({
        path: new URL(r.name).pathname,
        start: r.startTime,
        end: r.responseEnd,
        encoded: r.encodedBodySize,
        decoded: r.decodedBodySize,
      })),
    }));
    const gets = (path) =>
      observation.network.filter((r) => r.path === path && r.method === "GET")
        .length;
    observation.structural = {
      listGET: gets("/api/modules/pos/orders"),
      sessionGET: gets("/api/merchant/session"),
      modulesGET: gets("/api/modules"),
      globals: observation.network.filter(
        (r) =>
          r.path.startsWith("/api/") && !r.path.startsWith("/api/modules/pos/"),
      ),
    };
    observation.functionalValid =
      observation.listResponses.length === 1 &&
      observation.listResponses.every((r) => r.valid) &&
      observation.pageErrors === 0 &&
      observation.settlement === "finish" &&
      observation.network.every(
        (r) =>
          r.local &&
          r.method === "GET" &&
          r.termination === "finish" &&
          (r.status === null || r.status < 400),
      );
    observation.structuralValid =
      observation.structural.listGET === 1 &&
      (source === "control" ||
        (observation.structural.sessionGET === 0 &&
          observation.structural.modulesGET === 0));
    observation.valid =
      observation.functionalValid && observation.structuralValid;
  }
  async function detail(observation) {
    await begin(observation);
    await page.evaluate(
      ({ names, label }) => {
        const state = (window.__m1Detail = {
          start: performance.now(),
          ready: null,
        });
        const check = () => {
          const text = document.body.textContent;
          const pay = [...document.querySelectorAll("button")].find(
            (b) =>
              b.textContent?.trim() === "Cobrar" &&
              !b.disabled &&
              b.getClientRects().length,
          );
          if (
            state.ready === null &&
            text.includes(label) &&
            names.every((n) => text.includes(n)) &&
            pay
          )
            state.ready = performance.now();
        };
        new MutationObserver(check).observe(document, {
          childList: true,
          subtree: true,
          attributes: true,
        });
        check();
      },
      {
        label: "M1 000",
        names: Array.from(
          { length: fixture.linesPerOrder },
          (_, i) => `Producto ${String(i).padStart(4, "0")}`,
        ),
      },
    );
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname ===
            `/api/modules/pos/orders/${fixture.orders[0]}` &&
          r.request().method() === "GET",
      ),
      page
        .getByRole("button", { name: "Abrir M1 000", exact: true })
        .first()
        .click(),
    ]);
    const value = await response.json();
    await page.waitForFunction(() => Number.isFinite(window.__m1Detail?.ready));
    observation.detailInteractiveMs = await page.evaluate(
      () => window.__m1Detail.ready - window.__m1Detail.start,
    );
    await settle(observation, pending, network);
    observation.valid =
      response.status() === 200 &&
      value.id === fixture.orders[0] &&
      value.items?.length === fixture.linesPerOrder &&
      Number(value.total) === fixture.linesPerOrder * 2 &&
      observation.pageErrors === 0 &&
      observation.settlement === "finish" &&
      observation.network.every(
        (r) =>
          r.local &&
          r.method === "GET" &&
          r.termination === "finish" &&
          (r.status === null || r.status < 400),
      );
  }
  async function back(observation) {
    await begin(observation);
    await page.evaluate(
      ({ labels }) => {
        const state = (window.__m1Back = {
          start: performance.now(),
          ready: null,
        });
        const inspect = () => {
          const buttons = [...document.querySelectorAll("button")].filter(
            (b) => b.getClientRects().length && !b.disabled,
          );
          const actual = new Set(
            buttons
              .filter((b) =>
                b.getAttribute("aria-label")?.startsWith("Abrir M1 "),
              )
              .map((b) => b.getAttribute("aria-label").slice(6)),
          );
          if (
            state.ready === null &&
            labels.every((l) => actual.has(l)) &&
            actual.size === labels.length &&
            buttons.some((b) => b.textContent?.trim() === "Nueva orden")
          )
            state.ready = performance.now();
        };
        new MutationObserver(inspect).observe(document, {
          childList: true,
          subtree: true,
          attributes: true,
        });
        inspect();
      },
      { labels },
    );
    await page
      .getByRole("button", {
        name:
          source === "control"
            ? "Volver al listado de órdenes"
            : "Volver al historial",
        exact: true,
      })
      .first()
      .click();
    await page.waitForFunction(() => Number.isFinite(window.__m1Back?.ready));
    observation.listUsableMs = await page.evaluate(
      () => window.__m1Back.ready - window.__m1Back.start,
    );
    await settle(observation, pending, network);
    observation.valid =
      observation.pageErrors === 0 &&
      observation.settlement === "finish" &&
      observation.network.every(
        (r) =>
          r.local &&
          r.method === "GET" &&
          r.termination === "finish" &&
          (r.status === null || r.status < 400),
      );
  }
  return { page, begin, full, detail, back };
}
function observation(tag) {
  return { tag, network: [], listResponses: [], pageErrors: 0, valid: false };
}
export async function campaign(directory) {
  const { freeze, plan } = verifyFreeze(directory),
    fixture = JSON.parse(privateFile(join(directory, "fixture.json")));
  if (fixture.kind !== "pos-m1-list-fixture-v1" || fixture.phase !== "ready")
    throw Error("Owned ready M1 fixture required");
  const file = join(directory, "list-results.json"),
    report = {
      kind: "pos-m1-list-results-v1",
      runnerSHA: freeze.runnerSHA,
      recipeSha256: freeze.recipeSha256,
      freezeSha256: hash(privateFile(join(directory, "freeze.json"))),
      startedAt: new Date().toISOString(),
      complete: false,
      attempts: [],
      plan: plan.schedule,
    };
  exclusive(file, report);
  const save = () =>
    writeFileSync(file, JSON.stringify(report, null, 2) + "\n", {
      mode: 0o600,
    });
  let browser, server;
  try {
    browser = await chromium.launch({
      headless: true,
      proxy: {
        server: "http://127.0.0.1:43243",
        bypass: "localhost,127.0.0.1",
      },
    });
    report.chromium = browser.version();
    for (const planned of plan.schedule) {
      const attempt = {
        ...planned,
        ...observation(`pos-m1-${planned.id}`),
        stage: "startup",
        startedAt: new Date().toISOString(),
      };
      report.attempts.push(attempt);
      save();
      verifyFreeze(directory);
      server = await start(directory, plan[planned.source].runtime, planned.id);
      attempt.server = {
        pid: server.child.pid,
        runtime: plan[planned.source].runtime,
      };
      const f = fixture.fixtures.find((x) => x.case === planned.case);
      const cookies = JSON.parse(
        privateFile(
          join(directory, `cookies-${planned.case}-${planned.role}.json`),
        ),
      );
      if (!cookies.length || cookies.some((c) => c.domain !== "localhost"))
        throw Error("Legitimate local fixture cookies required");
      const newContext = async () => {
        const c = await browser.newContext({
          viewport: { width: 1280, height: 900 },
          serviceWorkers: "block",
        });
        await c.addCookies(cookies);
        return c;
      };
      let context = await newContext(),
        measured = await instrument(context, f, planned.source, save);
      try {
        attempt.stage = "warmup";
        attempt.warmup = observation(`pos-warm-${planned.id}`);
        save();
        await measured.full(attempt.warmup);
        // Cold-browser provider work cannot be hidden by a subsequent warm sample.
        if (!attempt.warmup.valid)
          throw Error(
            "Fixed warmup failed functional/structural gates; no retry/measurement",
          );
        if (planned.population === "new-assets") {
          await context.close();
          context = await newContext();
          measured = await instrument(context, f, planned.source, save);
        }
        if (planned.population === "detail-to-list") {
          attempt.detailPreparation = observation(`pos-prep-${planned.id}`);
          await measured.detail(attempt.detailPreparation);
          if (!attempt.detailPreparation.valid)
            throw Error("Detail preparation failed; no return sample");
        }
        attempt.stage = "measurement";
        save();
        if (
          ["normal-full", "new-assets", "empty", "volume"].includes(
            planned.population,
          )
        ) {
          await measured.full(attempt, planned.population !== "new-assets");
        } else if (planned.population === "list-to-detail")
          await measured.detail(attempt);
        else if (planned.population === "detail-to-list")
          await measured.back(attempt);
        else throw Error("Unknown frozen population");
        if (!attempt.valid)
          throw Error(
            "Measured attempt failed functional/structural gate; preserved without retry",
          );
        attempt.stage = "complete";
      } finally {
        await context.close();
        await server.stop();
        server = null;
        save();
      }
    }
    report.complete = true;
  } catch (error) {
    // Omit arbitrary error text: provider exceptions can contain credentials/tokens.
    report.failure = {
      name: error.name,
      code: "CAMPAIGN_STOPPED",
      stage: report.attempts.at(-1)?.stage ?? "launch",
    };
    throw Error(
      "M1 campaign stopped; all attempts preserved in private report",
    );
  } finally {
    await server?.stop();
    await browser?.close();
    const tracePath = join(directory, "server-trace.jsonl");
    if (existsSync(tracePath)) {
      const raw = readFileSync(tracePath, "utf8"),
        rows = raw.trim().split("\n").filter(Boolean).map(JSON.parse);
      report.serverInstrumentation = {
        sha256: hash(raw),
        rows: rows.length,
        attempts: report.attempts.map((a) => {
          const measured = rows.filter((row) => row.run === a.tag);
          return {
            tag: a.tag,
            population: a.population,
            requests: measured.filter((row) => row.kind === "request-start")
              .length,
            sqlStart: measured.filter((row) => row.kind === "sql-start").length,
            sqlEnd: measured.filter((row) => row.kind === "sql-end").length,
            sqlFailures: measured.filter(
              (row) => row.kind === "sql-end" && !row.ok,
            ).length,
            phases: measured
              .filter((row) => row.kind === "phase-end")
              .map(({ phase, ms, path }) => ({ phase, ms, path })),
          };
        }),
      };
    }
    report.finishedAt = new Date().toISOString();
    save();
  }
  console.log(
    "M1 list cut completed; separate critical-route recipe/gates still required.",
  );
}
