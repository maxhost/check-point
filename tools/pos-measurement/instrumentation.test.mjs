import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import {
  measureRequestPhase,
  beginRequestMeasurement,
} from "../../apps/merchant/src/server/request-measurement.ts";
test("generic phase preserves success and failure; disabled hook is inert", async () => {
  delete globalThis.__requestMeasurement;
  assert.equal(await measureRequestPhase("module-guard", async () => 42), 42);
  beginRequestMeasurement("module-guard")();
  const calls = [];
  globalThis.__requestMeasurement = {
    beginPhase: (name) => {
      calls.push(["start", name]);
      return () => calls.push(["end", name]);
    },
  };
  try {
    assert.equal(await measureRequestPhase("module-guard", async () => 42), 42);
    const error = new Error("sentinel");
    await assert.rejects(
      measureRequestPhase("module-guard", async () => {
        throw error;
      }),
      (e) => e === error,
    );
    assert.deepEqual(calls, [
      ["start", "module-guard"],
      ["end", "module-guard"],
      ["start", "module-guard"],
      ["end", "module-guard"],
    ]);
  } finally {
    delete globalThis.__requestMeasurement;
  }
});
test("preload rejects invalid/mismatched CI under production before application runs; secrets absent", () => {
  mkdirSync("/private/tmp/checkpass-pos-0242", { recursive: true });
  const dir = mkdtempSync("/private/tmp/checkpass-pos-0242/guard-test-");
  try {
    for (const url of [
      "invalid-SENTINEL-password",
      "postgresql://user:SENTINEL-password@ep-fake.us-east-2.aws.neon.tech/db",
    ]) {
      const r = spawnSync(
        process.execPath,
        [
          "--import",
          resolve("tests/e2e/support/pos-measurement-preload.mjs"),
          "--eval",
          'process.stdout.write("APP_STARTED")',
        ],
        {
          env: {
            PATH: process.env.PATH,
            NODE_ENV: "production",
            DATABASE_URL: url,
            POS_MEASUREMENT_DIR: dir,
            POS_MEASUREMENT_ENDPOINT_SHA12: "000000000000",
            BETTER_AUTH_URL: "http://localhost:43242",
          },
          encoding: "utf8",
        },
      );
      assert.notEqual(r.status, 0);
      assert.ok(!r.stdout.includes("APP_STARTED"));
      assert.ok(!r.stderr.includes("SENTINEL-password"));
    }
  } finally {
    rmSync(dir, { recursive: true });
  }
});
