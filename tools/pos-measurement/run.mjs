// Private selected environment. Never inherit a production DATABASE_URL/config file.
import {
  readFileSync,
  mkdirSync,
  writeFileSync,
  chmodSync,
  realpathSync,
} from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
const directory = "/private/tmp/checkpass-pos-0242/private";
mkdirSync(directory, { recursive: true, mode: 0o700 });
chmodSync(directory, 0o700);
const config = resolve(directory, "selected.json");
function endpoint(value) {
  let host;
  try {
    host = new URL(value).hostname;
  } catch {
    throw Error("Invalid protected CI URL");
  }
  if (!/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(host))
    throw Error("Protected Neon host required");
  let id = host.split(".")[0];
  for (;;) {
    const next = id.replace(/-(pooler|rvr)$/, "");
    if (next === id) return id;
    id = next;
  }
}
const hash = (value) =>
  createHash("sha256").update(value).digest("hex").slice(0, 12);
function validate(c) {
  const blocked = readFileSync("packages/db/src/local.ts", "utf8").match(
    /PROD_DB_ENDPOINT_SHA12 = "([a-f0-9]{12})"/,
  )[1];
  for (const key of ["NEON_CI_DATABASE_URL", "NEON_CI_DATABASE_URL_UNPOOLED"]) {
    const id = endpoint(c[key]);
    if (
      !/^ep-[a-z0-9-]+$/.test(id) ||
      hash(id) === blocked ||
      hash(id) !== c.POS_MEASUREMENT_ENDPOINT_SHA12
    )
      throw Error("CI endpoint validation failed");
  }
  if (
    c.BETTER_AUTH_URL !== "http://localhost:43242" ||
    c.BETTER_AUTH_SECRET.length < 32
  )
    throw Error("Invalid local auth configuration");
}
if (process.argv[2] === "init") {
  const source = process.argv[3];
  if (!source) throw Error("Selected CI source required");
  const raw = readFileSync(source, "utf8");
  const c = {};
  for (const key of ["NEON_CI_DATABASE_URL", "NEON_CI_DATABASE_URL_UNPOOLED"]) {
    const line = raw.split("\n").find((l) => l.startsWith(key + "="));
    if (!line) throw Error("Missing CI key");
    c[key] = line
      .slice(key.length + 1)
      .replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
  }
  Object.assign(c, {
    BETTER_AUTH_SECRET: randomBytes(48).toString("base64url"),
    BETTER_AUTH_URL: "http://localhost:43242",
    POS_MEASUREMENT_ENDPOINT_SHA12: hash(endpoint(c.NEON_CI_DATABASE_URL)),
  });
  validate(c);
  writeFileSync(config, JSON.stringify(c), { flag: "wx", mode: 0o600 });
  writeFileSync(
    resolve(directory, "ci.env"),
    Object.entries(c)
      .filter(([k]) => k.startsWith("NEON_CI_"))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n",
    { flag: "wx", mode: 0o600 },
  );
  process.stdout.write(
    "Selected private CI configuration created; no credentials emitted.\n",
  );
} else {
  const c = JSON.parse(readFileSync(config));
  validate(c);
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NVM_DIR: process.env.NVM_DIR,
    CI: "1",
    ...c,
    DATABASE_URL: c.NEON_CI_DATABASE_URL,
    EMAIL_PROVIDER: "console",
    CONSUMER_ORIGIN: "http://localhost:43243",
    AI_PROVIDER: "fake",
    NEON_TEST_ENV_FILE: resolve(directory, "ci.env"),
    POS_MEASUREMENT_DIR: directory,
  };
  const mode = process.argv[2];
  if (mode === "fixture") {
    env.POS_MEASUREMENT_SETUP = "true";
    env.POS_MEASUREMENT_OPERATION = process.argv[3];
    const result = spawnSync(
      "bash",
      [
        "tools/neon-test.sh",
        "src/modules/pos/server/pos-measurement.neon.integration.test.ts",
        "--no-file-parallelism",
      ],
      { env, stdio: "inherit" },
    );
    process.exitCode = result.status ?? 1;
  } else if (mode === "build") {
    const r = spawnSync(
      "pnpm",
      [
        "--filter",
        "@mi-pasaporte/merchant",
        "exec",
        "next",
        "build",
        "--webpack",
      ],
      { env: { ...env, NODE_ENV: "production" }, stdio: "inherit" },
    );
    process.exitCode = r.status ?? 1;
  } else if (mode === "start") {
    env.NODE_ENV = "production";
    env.NODE_OPTIONS = `--import=${realpathSync("tests/e2e/support/pos-measurement-preload.mjs")}`;
    const r = spawnSync(
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
      { env, stdio: "inherit" },
    );
    process.exitCode = r.status ?? 1;
  } else throw Error("Unknown operation");
}
