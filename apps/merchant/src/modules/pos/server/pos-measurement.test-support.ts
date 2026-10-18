/** Persistent synthetic fixture ownership; exclusively via protected Neon wrapper. */
import { createHash } from "node:crypto";
import { readFile, realpath, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  users,
  posOrders,
  posOrderItems,
  products,
  memberships,
} from "@mi-pasaporte/db/schema";
import {
  neonEndpointId,
  PROD_DB_ENDPOINT_SHA12,
} from "../../../../../../packages/db/src/local";
export type Fixture = {
  case: "empty" | "normal" | "volume";
  businessId: string;
  slug: string;
  ownerId: string;
  staffId: string;
  email: string;
  pin: string;
  locations: string[];
  categories: string[];
  products: string[];
  orders: string[];
  linesPerOrder: number;
};
export type Manifest = {
  kind: "pos-measurement-0242-v1";
  runId: string;
  endpoint: string;
  day: string;
  phase: string;
  fixtures: Fixture[];
};
export async function guard() {
  expect(process.env.NEON_INTEGRATION_ISOLATED).toBe("true");
  const url = process.env.NEON_INTEGRATION_DATABASE_URL;
  if (!url) throw Error("Protected integration URL required");
  const endpoint = createHash("sha256")
    .update(neonEndpointId(url))
    .digest("hex")
    .slice(0, 12);
  expect(endpoint).not.toBe(PROD_DB_ENDPOINT_SHA12);
  expect(endpoint).toBe(process.env.POS_MEASUREMENT_ENDPOINT_SHA12);
  const directory = await realpath(process.env.POS_MEASUREMENT_DIR ?? "");
  if (
    !directory.startsWith("/private/tmp/checkpass-pos-0242/") ||
    (await stat(directory)).mode & 0o077
  )
    throw Error("Private temporary directory required");
  process.env.DATABASE_URL = url;
  return { directory, endpoint, file: resolve(directory, "fixture.json") };
}
export async function load(file: string, endpoint: string) {
  const m = JSON.parse(await readFile(file, "utf8")) as Manifest;
  expect(m.kind).toBe("pos-measurement-0242-v1");
  expect(m.endpoint).toBe(endpoint);
  expect(m.fixtures.map((f) => f.case)).toEqual(["empty", "normal", "volume"]);
  for (const f of m.fixtures) {
    expect(f.slug).toBe(`pos0242-${m.runId}-${f.case}`);
    expect(f.email).toBe(`${f.slug}@example.test`);
  }
  return m;
}
export async function owned(f: Fixture) {
  const [b] = await getDb()
    .select({ slug: businesses.slug })
    .from(businesses)
    .where(eq(businesses.id, f.businessId));
  if (b) expect(b.slug).toBe(f.slug);
  for (const id of [f.ownerId, f.staffId]) {
    const [u] = await getDb()
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, id));
    if (u)
      expect(u.email).toBe(id === f.ownerId ? f.email : `staff-${f.email}`);
  }
  return !!b;
}
export async function inspect(m: Manifest) {
  for (const f of m.fixtures) {
    expect(await owned(f)).toBe(true);
    const rows = await getDb()
      .select({ id: posOrders.id, status: posOrders.status })
      .from(posOrders)
      .where(eq(posOrders.businessId, f.businessId));
    expect(
      rows
        .filter((r) => r.status === "open")
        .map((r) => r.id)
        .sort(),
    ).toEqual([...f.orders].sort());
    const ps = await getDb()
      .select({ id: products.id })
      .from(products)
      .where(eq(products.businessId, f.businessId));
    expect(ps.map((p) => p.id).sort()).toEqual([...f.products].sort());
    const staff = await getDb()
      .select({
        permissions: memberships.permissions,
        pinMustChange: memberships.pinMustChange,
      })
      .from(memberships)
      .where(
        and(
          eq(memberships.businessId, f.businessId),
          eq(memberships.userId, f.staffId),
        ),
      );
    expect(staff).toEqual([{ permissions: ["pos"], pinMustChange: false }]);
    for (const orderId of f.orders) {
      const lines = await getDb()
        .select({ id: posOrderItems.id })
        .from(posOrderItems)
        .where(eq(posOrderItems.posOrderId, orderId));
      expect(lines).toHaveLength(f.linesPerOrder);
    }
  }
}
export async function save(file: string, m: Manifest) {
  await writeFile(file, JSON.stringify(m, null, 2) + "\n", { mode: 0o600 });
}
