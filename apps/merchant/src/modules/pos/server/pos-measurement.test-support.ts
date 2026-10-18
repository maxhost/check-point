import { generateOpaqueToken } from "@mi-pasaporte/domain/server/consumer/core";
import { upsertEnrollmentSql } from "@mi-pasaporte/domain/server/customers/projection";
import { selectCoupon } from "@mi-pasaporte/domain/server/consumer/coupon-selection";
/** Persistent synthetic fixture ownership; exclusively via protected Neon wrapper. */
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readFile, realpath, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  users,
  posOrders,
  posOrderItems,
  products,
  memberships,
  loyaltyPrograms,
  consumerAccounts,
  programMemberships,
  campaigns,
  campaignCoupons,
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

/** Flow population is created only AFTER the immutable list baseline is complete. */
export type FlowManifest = {
  kind: "pos-flows-0242-v1";
  setupSource: string;
  businessId: string;
  programId: string;
  campaignId: string;
  phase: string;
  cases: {
    population: "smoke" | "campaign";
    index: number;
    role: "owner" | "staff";
    variant: "none" | "discount" | "zero";
    consumerId: string;
    membershipId: string;
    couponId: string | null;
    qrToken: string;
    webViewToken: string;
    closeRequestId: string;
    label: string;
  }[];
};
export async function setupFlows(m: Manifest, directory: string) {
  if (
    execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim()
  )
    throw Error("Flow setup requires frozen clean source");
  const f = m.fixtures.find((f) => f.case === "normal")!;
  expect(await owned(f)).toBe(true);
  const flow: FlowManifest = {
    kind: "pos-flows-0242-v1",
    setupSource: execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim(),
    businessId: f.businessId,
    programId: randomUUID(),
    campaignId: randomUUID(),
    phase: "allocating",
    cases: (["smoke", "campaign"] as const).flatMap((population) =>
      (population === "smoke"
        ? (["owner"] as const)
        : (["owner", "staff"] as const)
      ).flatMap((role) =>
        (["none", "discount", "zero"] as const).flatMap((variant) =>
          Array.from({ length: population === "smoke" ? 1 : 3 }, (_, i) => ({
            population,
            index: i,
            role,
            variant,
            consumerId: randomUUID(),
            membershipId: randomUUID(),
            couponId: variant === "none" ? null : randomUUID(),
            qrToken: generateOpaqueToken(),
            webViewToken: generateOpaqueToken(),
            closeRequestId: randomUUID(),
            label: `Flow ${population} ${role} ${variant} ${i}`,
          })),
        ),
      ),
    ),
  };
  const file = `${directory}/flow-fixture.json`;
  await writeFile(file, JSON.stringify(flow, null, 2), {
    flag: "wx",
    mode: 0o600,
  });
  const now = new Date();
  await withDbTransaction(async (tx) => {
    await tx.insert(loyaltyPrograms).values({
      id: flow.programId,
      businessId: f.businessId,
      kind: "points",
      configuration: {},
      status: "active",
      termsMarkdown: "Condiciones sintéticas M0",
      termsHash: "synthetic0242",
      createdBy: f.ownerId,
      accrualMode: "per_amount",
      accrualGrant: 1,
      accrualBlockAmount: "1.00",
    });
    await tx.insert(campaigns).values({
      id: flow.campaignId,
      businessId: f.businessId,
      kind: "proximity",
      templateKey: "welcome",
      channelProximity: false,
      channelPush: false,
      name: "Bienvenida sintética M0",
      status: "active",
      activatedAt: now,
      message: "Beneficio sintético para medición protegida",
      couponLabel: "Descuento M0",
      couponCost: "0.00",
      couponKind: "discount",
      couponDiscountUnit: "percent",
      couponDiscountValue: "10",
      welcomeValidDays: 15,
      welcomeReminderDays: 3,
      welcomeMonthlyCap: 50,
      welcomeRedeemFrom: "same_visit",
      startsAt: new Date(+now - 3600000),
      createdByUserId: f.ownerId,
    });
    for (const c of flow.cases) {
      await tx.insert(consumerAccounts).values({
        id: c.consumerId,
        firstName: "Cliente",
        lastName: `M0 ${c.role} ${c.variant} ${c.index}`,
        qrToken: c.qrToken,
        webViewToken: c.webViewToken,
        homeLaunchedAt: now,
      });
      await tx.insert(programMemberships).values({
        id: c.membershipId,
        consumerId: c.consumerId,
        programId: flow.programId,
        businessId: f.businessId,
      });
      await tx.execute(
        upsertEnrollmentSql(
          sql`(select business_id,consumer_id,enrolled_at from consumer.program_membership where id=${c.membershipId}::uuid)`,
        ),
      );
      if (c.couponId)
        await tx.insert(campaignCoupons).values({
          id: c.couponId,
          campaignId: flow.campaignId,
          businessId: f.businessId,
          consumerId: c.consumerId,
          membershipId: c.membershipId,
          welcomeMembershipId: c.membershipId,
          labelSnapshot: "Descuento M0",
          costSnapshot: "0.00",
          kindSnapshot: "discount",
          discountUnitSnapshot: "percent",
          discountValueSnapshot: c.variant === "zero" ? "100" : "10",
          validFrom: new Date(+now - 3600000),
          validUntil: new Date(+now + 15 * 86400000),
        });
    }
  });
  for (const c of flow.cases)
    if (c.couponId) {
      const selected = await selectCoupon(c.consumerId, c.couponId);
      expect(selected.status).toBe(200);
    }
  flow.phase = "ready";
  await writeFile(file, JSON.stringify(flow, null, 2), { mode: 0o600 });
}
export async function loadFlows(m: Manifest, directory: string) {
  const flow = JSON.parse(
    await readFile(`${directory}/flow-fixture.json`, "utf8"),
  ) as FlowManifest;
  expect(flow.kind).toBe("pos-flows-0242-v1");
  const f = m.fixtures.find((f) => f.case === "normal")!;
  expect(flow.businessId).toBe(f.businessId);
  expect(await owned(f)).toBe(true);
  expect(flow.cases.filter((c) => c.population === "campaign")).toHaveLength(
    18,
  );
  expect(flow.cases.filter((c) => c.population === "smoke")).toHaveLength(3);
  for (const key of [
    "consumerId",
    "membershipId",
    "closeRequestId",
    "label",
  ] as const)
    expect(new Set(flow.cases.map((c) => c[key])).size).toBe(21);
  for (const c of flow.cases) {
    const [account] = await getDb()
      .select({ qr: consumerAccounts.qrToken })
      .from(consumerAccounts)
      .where(eq(consumerAccounts.id, c.consumerId));
    expect(account?.qr).toBe(c.qrToken);
  }
  return flow;
}
export async function inspectFlows(m: Manifest, directory: string) {
  const flow = await loadFlows(m, directory);
  const population =
    process.env.POS_MEASUREMENT_OPERATION === "flows-inspect-smoke"
      ? "smoke"
      : "campaign";
  const raw = JSON.parse(
    await readFile(
      `${directory}/${population === "smoke" ? "flow-smoke-01" : "m0-flows-01"}.json`,
      "utf8",
    ),
  );
  const expected = flow.cases.filter((c) => c.population === population);
  expect(raw.completed).toBe(true);
  expect(raw.valid).toBe(true);
  expect(raw.attempts).toHaveLength(expected.length);
  expect(
    new Set(raw.attempts.map((a: { orderId: string }) => a.orderId)).size,
  ).toBe(expected.length);
  for (const c of expected) {
    const attempt = raw.attempts.find(
      (a: { label: string }) => a.label === c.label,
    );
    expect(attempt?.valid).toBe(true);
    expect(attempt?.role).toBe(c.role);
    expect(attempt?.variant).toBe(c.variant);
  }
  const result = await getDb()
    .execute(sql`select p.id,p.table_label,p.status,p.close_request_id,p.order_id,p.settlement,
 (select count(*)::int from pos.order_payment pay where pay.pos_order_id=p.id) as payment_count,
 (select count(*)::int from core.module_event e where e.business_id=p.business_id and e.source_id=p.id and e.event_type='sale.closed') as sale_events,
 (select coalesce(jsonb_agg(jsonb_build_object('subscriber',d.subscriber_id,'state',d.state,'attempts',d.attempts,'reason',d.terminal_reason)),'[]'::jsonb) from core.module_event e join core.module_event_delivery d on d.event_id=e.id where e.business_id=p.business_id and e.source_id=p.id) as deliveries,
 (select count(*)::int from core.coupon_redemption r where r.order_id=p.order_id) as coupon_redemptions,
 (select jsonb_build_object('net',o.total,'units',o.units_granted,'balance',o.balance_after,'membership',o.membership_id,'consumer',o.consumer_id) from core."order" o where o.id=p.order_id) as ledger
 from pos.pos_order p where p.business_id=${flow.businessId} and p.table_label like 'Flow %' order by p.table_label`);
  await writeFile(
    `${directory}/flow-inspection-${Date.now()}.json`,
    JSON.stringify(
      { at: new Date().toISOString(), rows: result.rows },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  for (const row of result.rows) {
    const c = flow.cases.find((c) => c.label === row.table_label);
    expect(c).toBeDefined();
    if (c!.population === population) {
      const attempt = raw.attempts.find(
        (a: { label: string }) => a.label === c!.label,
      );
      expect(row.id).toBe(attempt.orderId);
    }
    expect(row.status).toBe("closed");
    expect(row.close_request_id).toBe(c!.closeRequestId);
    expect(row.sale_events).toBe(1);
    expect(row.payment_count).toBe(c!.variant === "zero" ? 0 : 1);
    expect(row.coupon_redemptions).toBe(c!.couponId ? 1 : 0);
    const ledger = row.ledger as {
      net: string;
      units: number;
      balance: number;
      membership: string;
      consumer: string;
    };
    expect(ledger.net).toBe(
      c!.variant === "zero"
        ? "0.00"
        : c!.variant === "discount"
          ? "14.40"
          : "16.00",
    );
    expect(ledger.membership).toBe(c!.membershipId);
    expect(ledger.consumer).toBe(c!.consumerId);
    expect(ledger.balance).toBe(ledger.units);
    expect(ledger.units).toBe(
      c!.variant === "zero" ? 0 : c!.variant === "discount" ? 14 : 16,
    );
  }
  expect(
    result.rows.filter(
      (r) =>
        flow.cases.find((c) => c.label === r.table_label)?.population ===
        population,
    ),
  ).toHaveLength(population === "smoke" ? 3 : 18);
}
