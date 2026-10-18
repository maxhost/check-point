// Real Next/UI/auth/DB flow measurement; deterministic synthetic camera, no HTTP mocks.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium, expect } from "@playwright/test";
const dir = "/private/tmp/checkpass-pos-0242/private",
  hash = (v) => createHash("sha256").update(v).digest("hex");
const fixture = JSON.parse(readFileSync(`${dir}/fixture.json`)),
  flowRaw = readFileSync(`${dir}/flow-fixture.json`, "utf8"),
  flow = JSON.parse(flowRaw),
  freeze = JSON.parse(readFileSync(`${dir}/freeze.json`));
if (
  flow.phase !== "ready" ||
  flow.businessId !==
    fixture.fixtures.find((f) => f.case === "normal").businessId ||
  freeze.flowFixtureSha256 !== hash(flowRaw) ||
  freeze.manifestSha256 !== hash(readFileSync(`${dir}/fixture.json`)) ||
  freeze.schemaPreflightSha256 !==
    hash(readFileSync(`${dir}/schema-preflight.json`)) ||
  freeze.lockSha256 !== hash(readFileSync("pnpm-lock.yaml")) ||
  freeze.source !==
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() ||
  execFileSync("git", ["status", "--porcelain"], {
    encoding: "utf8",
  }).trim() !== "" ||
  readFileSync("apps/merchant/.next/BUILD_ID", "utf8").trim() !==
    freeze.buildId ||
  !Object.entries(freeze.files).every(
    ([p, h]) => hash(readFileSync(p)) === h,
  ) ||
  hash(readFileSync(`${dir}/selected.json`)) !== freeze.privateConfigSha256
)
  throw Error("Frozen flow identity mismatch");
const smoke = process.env.FLOW_SMOKE === "1",
  out = `${dir}/${smoke ? "flow-smoke-01" : "m0-flows-01"}.json`;
if (existsSync(out)) throw Error("Exclusive output required");
const report = {
  source: freeze.source,
  buildSource: freeze.buildSource,
  buildId: freeze.buildId,
  freezeSha256: hash(readFileSync(`${dir}/freeze.json`)),
  flowFixtureSha256: hash(flowRaw),
  camera:
    "deterministic synthetic BarcodeDetector/media stream; not physical decode latency",
  population:
    "normal existing24open; independent consumer/coupon/command per attempt; closed history accumulates",
  startedAt: new Date().toISOString(),
  attempts: [],
};
const save = () =>
  writeFileSync(out, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
save();
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    proxy: { server: "http://127.0.0.1:43243", bypass: "localhost,127.0.0.1" },
  });
  report.browser = browser.version();
  for (const c of smoke
    ? flow.cases.filter((c) => c.population === "smoke")
    : flow.cases.filter((c) => c.population === "campaign")) {
    // Smoke never consumes a campaign identity: campaign must use a separate designated case.
    const a = {
      index: c.index,
      role: c.role,
      variant: c.variant,
      label: c.label,
      tag: `pos-flow-${smoke ? "smoke" : "m0"}-${c.role}-${c.variant}-${c.index}`,
      stage: "setup",
      startedAt: new Date().toISOString(),
      requests: [],
      errors: 0,
      external: 0,
    };
    report.attempts.push(a);
    save();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    });
    await context.addCookies(
      JSON.parse(readFileSync(`${dir}/cookies-normal-${c.role}.json`)),
    );
    await context.addInitScript(() => {
      window.__flowLongTasks = [];
      new PerformanceObserver((entries) => {
        window.__flowLongTasks.push(
          ...entries
            .getEntries()
            .map((e) => ({ start: e.startTime, duration: e.duration })),
        );
      }).observe({ type: "longtask", buffered: true });
      window.__flowCameraToken = null;
      Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
        configurable: true,
        get: () => null,
        set: () => {},
      });
      Object.defineProperty(HTMLMediaElement.prototype, "readyState", {
        configurable: true,
        get: () => 2,
      });
      HTMLMediaElement.prototype.play = () => Promise.resolve();
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }),
        },
      });
      Object.defineProperty(window, "BarcodeDetector", {
        configurable: true,
        value: class {
          async detect() {
            return window.__flowCameraToken
              ? [{ rawValue: window.__flowCameraToken }]
              : [];
          }
        },
      });
    });
    const page = await context.newPage();
    await page.setExtraHTTPHeaders({ "x-pos-measurement": a.tag });
    const pending = new Set();
    page.on("pageerror", () => a.errors++);
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (u.origin !== "http://localhost:43242") {
        a.external++;
        return;
      }
      if (!u.pathname.startsWith("/api/")) return;
      const row = {
        path: u.pathname,
        method: r.method(),
        startedAt: new Date().toISOString(),
      };
      a.requests.push(row);
      if (u.pathname.endsWith("/close")) {
        const body = r.postDataJSON();
        row.bodySha256 = hash(r.postData());
        row.orderMatches =
          u.pathname ===
          `/api/modules/pos/orders/${received.created?.id}/close`;
        row.frozenCommand = body.clientRequestId === c.closeRequestId;
        row.paymentCount = body.payments?.length;
        row.paymentsArray = Array.isArray(body.payments);
        row.membershipMatches = body.membershipId === c.membershipId;
        row.couponMatches = (body.coupon?.couponId ?? null) === c.couponId;
      }
    });
    page.on("requestfinished", (r) => {
      const u = new URL(r.url());
      const row = a.requests.findLast(
        (x) => x.path === u.pathname && x.method === r.method() && !x.timing,
      );
      if (row) row.timing = r.timing();
    });
    const received = {};
    page.on("response", (r) => {
      const u = new URL(r.url());
      if (!u.pathname.startsWith("/api/modules/pos/")) return;
      const task = (async () => {
        if (
          r.request().method() === "POST" &&
          u.pathname === "/api/modules/pos/orders"
        ) {
          const body = await r.json();
          received.created = {
            valid:
              r.status() === 201 &&
              body.tableLabel === c.label &&
              body.items.length === 8 &&
              body.total === "16.00" &&
              body.status === "open",
            id: body.id,
          };
          a.orderId = body.id;
          save(); // Persist canonical server-generated identity before QR/payment/close.
        } else if (u.pathname.endsWith("/resolve")) {
          const body = await r.json();
          received.resolved = {
            valid:
              r.status() === 200 &&
              body.membership.id === c.membershipId &&
              (body.couponState.coupon?.couponId ?? null) === c.couponId,
          };
        } else if (u.pathname.endsWith("/close")) {
          const body = await r.json();
          received.closed = {
            valid:
              r.status() === 200 &&
              body.status === "closed" &&
              body.sale?.total ===
                (c.variant === "zero"
                  ? "0.00"
                  : c.variant === "discount"
                    ? "14.40"
                    : "16.00"),
            id: body.id,
          };
        }
      })()
        .catch(() => {
          a.responseReadError = true;
        })
        .finally(() => pending.delete(task));
      pending.add(task);
    });
    const now = () => page.evaluate(() => performance.now());
    try {
      await page.goto("http://localhost:43242/backoffice/pos", {
        waitUntil: "commit",
      });
      await expect(
        page.getByRole("button", { name: "Nueva orden", exact: true }),
      ).toBeEnabled();
      a.stage = "catalog";
      let start = await now();
      await page
        .getByRole("button", { name: "Nueva orden", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Nombre de mesa", exact: true })
        .fill(c.label);
      await page
        .getByRole("button", { name: "Tomar pedido", exact: true })
        .click();
      await expect(
        page.getByRole("button", {
          name: "Agregar Producto 0000",
          exact: true,
        }),
      ).toBeEnabled();
      a.catalogInteractiveMs = (await now()) - start;
      for (let i = 0; i < 8; i++)
        await page
          .getByRole("button", {
            name: `Agregar Producto ${String(i).padStart(4, "0")}`,
            exact: true,
          })
          .click();
      await page
        .getByRole("button", { name: "Revisar pedido", exact: true })
        .click();
      a.stage = "save";
      start = await now();
      await page
        .getByRole("button", { name: /^Guardar (pedido|orden|cambios)$/ })
        .click();
      await expect(
        page.getByRole("button", { name: "Cobrar", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(c.label, { exact: true }).first(),
      ).toBeVisible();
      const money = (amount) =>
        new Intl.NumberFormat("es-EC", {
          style: "currency",
          currency: "USD",
        }).format(amount);
      await expect(
        page.getByRole("heading", { name: money(16), exact: true }),
      ).toBeVisible();
      a.saveConfirmedMs = (await now()) - start;
      await page.getByRole("button", { name: /^Acciones de la orden/ }).click();
      a.stage = "qr";
      start = await now();
      await page
        .getByRole("dialog", { name: "Acciones de la orden", exact: true })
        .getByRole("button", { name: "Escanear QR", exact: true })
        .click();
      await page.evaluate((token) => {
        window.__flowCameraToken = token;
      }, c.qrToken);
      await expect(
        page.getByRole("dialog", { name: "Escanear pase", exact: true }),
      ).toBeHidden();
      await expect(
        page
          .getByText(`Cliente M0 ${c.role} ${c.variant} ${c.index}`, {
            exact: true,
          })
          .first(),
      ).toBeVisible();
      a.qrResolvedMs = (await now()) - start;
      await page.evaluate(() => {
        window.__flowCameraToken = null;
      });
      a.stage = "prepare";
      start = await now();
      await page.getByRole("button", { name: "Cobrar", exact: true }).click();
      const dialog = page.getByRole("dialog", {
        name: `Cobrar ${c.label}`,
        exact: true,
      });
      await expect(
        dialog.getByRole("button", { name: "Confirmar cobro", exact: true }),
      ).toBeEnabled();
      await expect(
        dialog.getByRole("heading", {
          name: `Importe: ${money(c.variant === "zero" ? 0 : c.variant === "discount" ? 14.4 : 16)}`,
          exact: true,
        }),
      ).toBeVisible();
      a.paymentReadyMs = (await now()) - start;
      await page.evaluate((id) => {
        const original = crypto.randomUUID.bind(crypto);
        Object.defineProperty(crypto, "randomUUID", {
          configurable: true,
          value: () => {
            Object.defineProperty(crypto, "randomUUID", {
              configurable: true,
              value: original,
            });
            return id;
          },
        });
      }, c.closeRequestId);
      if (!received.created?.valid || !a.orderId)
        throw Error("Canonical created order missing before close");
      a.prepareRequests = a.requests.slice();
      if (c.variant === "zero") {
        await expect(
          dialog.getByRole("button", { name: "Medio de pago" }),
        ).toHaveCount(0);
        if (a.requests.some((r) => r.path.endsWith("/payment-methods")))
          throw Error("Zero net fetched payment methods");
      }
      a.stage = "close";
      start = await now();
      await dialog
        .getByRole("button", { name: "Confirmar cobro", exact: true })
        .click();
      await expect(
        page
          .getByRole("heading", { name: "Venta cerrada", exact: true })
          .first(),
      ).toBeVisible();
      a.closeConfirmedMs = (await now()) - start;
      const deadline = Date.now() + 10000;
      while (pending.size) {
        if (Date.now() > deadline) throw Error("Response observer timeout");
        await new Promise((r) => setTimeout(r, 25));
      }
      a.browserMetrics = await page.evaluate(() => ({
        navigation: performance.getEntriesByType("navigation").map((e) => ({
          ttfb: e.responseStart - e.requestStart,
          domContentLoaded: e.domContentLoadedEventEnd,
          load: e.loadEventEnd,
        })),
        longTasks: window.__flowLongTasks,
        resources: performance.getEntriesByType("resource").map((e) => ({
          path: new URL(e.name).pathname,
          initiator: e.initiatorType,
          start: e.startTime,
          duration: e.duration,
          transfer: e.transferSize,
          encoded: e.encodedBodySize,
          decoded: e.decodedBodySize,
        })),
      }));
      a.responses = received;
      a.valid =
        received.created?.valid &&
        received.resolved?.valid &&
        received.closed?.valid &&
        received.closed.id === received.created.id &&
        a.errors === 0 &&
        a.external === 0 &&
        a.requests.filter((r) => r.path.endsWith("/close")).length === 1 &&
        a.requests
          .filter((r) => r.path.endsWith("/close"))
          .every(
            (r) =>
              r.orderMatches &&
              r.frozenCommand &&
              r.membershipMatches &&
              r.couponMatches &&
              r.paymentsArray &&
              r.paymentCount === (c.variant === "zero" ? 0 : 1),
          );
      a.stage = "complete";
    } catch (error) {
      a.valid = false;
      a.failure = error.name;
      a.failureMessage = String(error.message)
        .replaceAll(c.qrToken, "[private-token]")
        .slice(0, 800);
    }
    a.finishedAt = new Date().toISOString();
    await context.close();
    save();
    if (!a.valid) break;
  }
  report.completed = report.attempts.length === (smoke ? 3 : 18);
  report.valid =
    report.attempts.length === (smoke ? 3 : 18) &&
    report.attempts.every((a) => a.valid);
  if (!report.valid) process.exitCode = 2;
} catch (error) {
  report.completed = false;
  report.fatal = error.name;
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await browser?.close();
  save();
}
