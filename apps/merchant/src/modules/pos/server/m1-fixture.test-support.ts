/** M1 list-only ownership, real OTP/PIN login. No mutation-flow identities yet. */
import { createHash } from "node:crypto";
import { readFile, writeFile, realpath, lstat } from "node:fs/promises";
import { resolve } from "node:path";
import { expect } from "vitest";
import { inArray } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { posOrderItems } from "@mi-pasaporte/db/schema";
import {
  neonEndpointId,
  PROD_DB_ENDPOINT_SHA12,
} from "../../../../../../packages/db/src/local";
import {
  inspect as inspectExisting,
  owned,
  type Manifest as ExistingManifest,
} from "./pos-measurement.test-support";
import { login as loginExisting } from "./pos-measurement-login.test-support";

export { owned };
export type Manifest = Omit<ExistingManifest, "kind" | "fixtures"> & {
  kind: "pos-m1-list-fixture-v1";
  fixtures: (ExistingManifest["fixtures"][number] & { lineIds: string[][] })[];
};
export async function guard() {
  expect(process.env.NEON_INTEGRATION_ISOLATED).toBe("true");
  expect(process.env.POS_M1_FIXTURE).toBe("true");
  const url = process.env.NEON_INTEGRATION_DATABASE_URL;
  if (!url) throw Error("Protected integration URL required");
  const endpoint = createHash("sha256")
    .update(neonEndpointId(url))
    .digest("hex")
    .slice(0, 12);
  // Always checked, including production NODE_ENV; wrapper isolation is also mandatory.
  expect(endpoint).not.toBe(PROD_DB_ENDPOINT_SHA12);
  expect(endpoint).toBe(process.env.POS_MEASUREMENT_ENDPOINT_SHA12);
  const input = process.env.POS_M1_DIR ?? "",
    directory = await realpath(input),
    s = await lstat(input);
  if (
    directory !== resolve(input) ||
    !directory.startsWith("/private/tmp/checkpass-pos-0242/m1-") ||
    !s.isDirectory() ||
    s.isSymbolicLink() ||
    s.mode & 0o077
  )
    throw Error("Own M1 namespace0700 required");
  process.env.DATABASE_URL = url;
  return { directory, endpoint, file: resolve(directory, "fixture.json") };
}
export async function load(file: string, endpoint: string) {
  const s = await lstat(file);
  if (!s.isFile() || s.isSymbolicLink() || s.mode & 0o077)
    throw Error("Private fixture0600 required");
  const m = JSON.parse(await readFile(file, "utf8")) as Manifest;
  expect(m.kind).toBe("pos-m1-list-fixture-v1");
  expect(m.endpoint).toBe(endpoint);
  expect(m.fixtures.map((f) => f.case)).toEqual(["empty", "normal", "volume"]);
  expect(["ready", "allocating"]).toContain(m.phase);
  for (const f of m.fixtures) {
    expect(f.slug).toBe(`posm10242-${m.runId}-${f.case}`);
    expect(f.email).toBe(`${f.slug}@example.test`);
    expect(f.locations).toHaveLength(2);
    expect(f.lineIds).toHaveLength(f.orders.length);
    expect(new Set(f.lineIds.flat()).size).toBe(
      f.orders.length * f.linesPerOrder,
    );
    for (const ids of f.lineIds) expect(ids).toHaveLength(f.linesPerOrder);
  }
  return m;
}
export async function inspect(m: Manifest) {
  expect(m.phase).toBe("ready");
  await inspectExisting({ ...m, kind: "pos-measurement-0242-v1" });
  for (const f of m.fixtures) {
    const rows = await getDb()
      .select()
      .from(posOrderItems)
      .where(inArray(posOrderItems.posOrderId, f.orders));
    expect(rows).toHaveLength(f.orders.length * f.linesPerOrder);
    for (let i = 0; i < f.orders.length; i++) {
      const lines = rows
        .filter((r) => r.posOrderId === f.orders[i])
        .sort((a, b) => a.position - b.position);
      expect(lines.map((r) => r.id)).toEqual(f.lineIds[i]);
      for (let j = 0; j < lines.length; j++)
        expect(lines[j]).toMatchObject({
          productId: f.products[j],
          nameSnapshot: `Producto ${String(j).padStart(4, "0")}`,
          quantity: "1.000000000",
          unitPriceSnapshot: "2.000000000",
          measureKind: "unit",
          quantityUnit: "unit",
          priceUnit: "unit",
          conversionVersion: "mass-si-1",
          position: j,
        });
    }
  }
}
export async function login(m: Manifest, directory: string) {
  // Existing legitimate OTP/PIN helper, with its fixture type projection only.
  await loginExisting({ ...m, kind: "pos-measurement-0242-v1" }, directory);
}
export async function save(file: string, m: Manifest) {
  const s = await lstat(file);
  if (!s.isFile() || s.isSymbolicLink() || s.mode & 0o077)
    throw Error("Private owned fixture required");
  await writeFile(file, JSON.stringify(m, null, 2) + "\n", { mode: 0o600 });
}
