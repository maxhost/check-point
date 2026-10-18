// Opt-in build/start preload; validates CI even when NODE_ENV=production.
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { appendFileSync, readFileSync, realpathSync, statSync } from "node:fs";
import http from "node:http";
import { resolve, dirname } from "node:path";
const directory = realpathSync(process.env.POS_MEASUREMENT_DIR ?? "");
if (
  !directory.startsWith("/private/tmp/checkpass-pos-0242/") ||
  statSync(directory).mode & 0o077
)
  throw Error("Private measurement directory required");
const root = resolve(dirname(new URL(import.meta.url).pathname), "../../..");
let host;
try {
  host = new URL(process.env.DATABASE_URL).hostname;
} catch {
  throw Error("Invalid protected URL");
}
if (!/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(host))
  throw Error("Protected Neon host required");
let id = host.split(".")[0];
for (;;) {
  const next = id.replace(/-(pooler|rvr)$/, "");
  if (next === id) break;
  id = next;
}
const fingerprint = createHash("sha256").update(id).digest("hex").slice(0, 12);
const blocked = readFileSync(
  resolve(root, "packages/db/src/local.ts"),
  "utf8",
).match(/PROD_DB_ENDPOINT_SHA12 = "([a-f0-9]{12})"/)[1];
if (
  !/^ep-[a-z0-9-]+$/.test(id) ||
  fingerprint === blocked ||
  fingerprint !== process.env.POS_MEASUREMENT_ENDPOINT_SHA12 ||
  process.env.BETTER_AUTH_URL !== "http://localhost:43242"
)
  throw Error("Protected measurement configuration required");
const context = new AsyncLocalStorage(),
  salt = randomBytes(32),
  output = resolve(directory, "server-trace.jsonl");
function record(event) {
  const scope = context.getStore();
  if (scope)
    appendFileSync(
      output,
      JSON.stringify({
        at: performance.timeOrigin + performance.now(),
        ...scope,
        ...event,
      }) + "\n",
      { mode: 0o600 },
    );
}
function queryStart(text, transport) {
  const start = performance.now();
  const query = createHmac("sha256", salt)
    .update(String(text))
    .digest("hex")
    .slice(0, 20);
  const verb = String(text).trim().split(/\s/)[0].toUpperCase();
  record({
    kind: "sql-start",
    query,
    transport,
    verb: /^(SELECT|INSERT|UPDATE|DELETE|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)$/.test(
      verb,
    )
      ? verb
      : "OTHER",
  });
  let done = false;
  return (ok) => {
    if (!done) {
      done = true;
      record({
        kind: "sql-end",
        query,
        transport,
        ms: performance.now() - start,
        ok,
      });
    }
  };
}
globalThis.__posMeasurement = { record, queryStart };
const emit = http.Server.prototype.emit;
http.Server.prototype.emit = function (event, ...args) {
  if (event !== "request") return emit.call(this, event, ...args);
  const [req, res] = args;
  const tag = req.headers["x-pos-measurement"];
  if (typeof tag !== "string" || !/^pos-[a-z0-9-]{1,100}$/.test(tag))
    return emit.call(this, event, ...args);
  return context.run(
    {
      run: tag,
      path: req.url.split("?")[0],
      rid: randomBytes(8).toString("hex"),
    },
    () => {
      const start = performance.now();
      record({ kind: "request-start" });
      res.once("finish", () =>
        record({
          kind: "request-end",
          ms: performance.now() - start,
          status: res.statusCode,
        }),
      );
      return emit.call(this, event, ...args);
    },
  );
};
const fetch = globalThis.fetch;
globalThis.fetch = async function (input, init) {
  let finish;
  try {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (
      new Headers(init?.headers).get("Neon-Connection-String") ===
        process.env.DATABASE_URL &&
      new URL(url).pathname === "/sql" &&
      typeof init?.body === "string"
    ) {
      const body = JSON.parse(init.body);
      finish = queryStart(
        body.query ?? JSON.stringify(body.queries?.map((q) => q.query)),
        "http",
      );
    }
  } catch {
    /* Unrecognized driver call is not instrumented; never alter its result. */
  }
  try {
    const response = await Reflect.apply(fetch, this, [input, init]);
    finish?.(response.ok);
    return response;
  } catch (error) {
    finish?.(false);
    throw error;
  }
};
