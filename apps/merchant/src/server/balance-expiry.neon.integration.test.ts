import { afterAll, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

import {
  dropBusiness,
  integrationEnabled,
  readBalances,
  seedBusiness,
  seedConsumer,
  setBalance,
  type Seed,
} from "./counter-integration-support";
import { getDb } from "@mi-pasaporte/db";
import { insertMembershipWithProjection } from "@mi-pasaporte/domain/server/customers/projection";
import {
  collectCandidates,
  expireMembership,
  runBalanceExpiry,
} from "@mi-pasaporte/domain/server/loyalty-program/balance-expiry-store";
import { listConsumerPrograms } from "@mi-pasaporte/domain/server/consumer/programs";
import { rowsOf } from "@mi-pasaporte/domain/server/counter/core";

/**
 * Spec 0195 §DoD / ADR 0136 — THE BALANCE-EXPIRY SWEEP AGAINST POSTGRES. Every run passes
 * its own `now` and is SCOPED to the business of the case (other files share the branch).
 * Timeline of a case: rule on since 2026-01-01 10:00 local, 3 months, enrolled before,
 * never came → expires on 2026-04-01 (end of that local day).
 *
 * ORACLE OF M1 (b: no «hoy vencen» notice → no expiry), M2 (e: a purchase after the
 * candidates were read is re-read under the lock) and M3 (f: switching the rule on starts
 * the clock that day).
 */
const sesion = vi.hoisted(() => ({ businessId: "", userId: "" }));
vi.mock("./api-permission", () => ({
  requireApiPermissionSinGateDeEmail: async () => ({
    business: { id: sesion.businessId, status: "active" },
    userId: sesion.userId,
  }),
}));

const SINCE = "2026-01-01T15:00:00Z";
const at = (iso: string) => new Date(iso);
const seeds: Seed[] = [];

async function world(opts: { balance?: number } = {}) {
  const seed = await seedBusiness({
    name: "Cafe Vence",
    kind: "points",
    mode: "per_amount",
    grant: 1,
    blockAmount: "1.00",
  });
  seeds.push(seed);
  const consumer = await seedConsumer();
  const membership = await insertMembershipWithProjection({
    consumerId: consumer.id,
    programId: seed.programId,
    businessId: seed.business.id,
  });
  await getDb().execute(sql`
    UPDATE consumer.program_membership SET enrolled_at = '2025-12-01T15:00:00Z'
    WHERE id = ${membership.id}`);
  await getDb().execute(sql`
    UPDATE core.loyalty_program
    SET balance_expiry_months = 3, balance_expiry_since = ${SINCE}::timestamptz
    WHERE id = ${seed.programId}`);
  await setBalance(membership.id, { points: opts.balance ?? 120 });
  const run = (now: string) =>
    runBalanceExpiry(at(now), { businessIds: [seed.business.id] });
  return { seed, consumer, membership, run };
}

async function notices(membershipId: string) {
  return rowsOf(
    await getDb().execute(sql`
      SELECT n.days_before, n.expires_on::text AS expires_on, q.body, q.class,
             q.not_before
      FROM consumer.balance_expiry_notice n
      JOIN consumer.wallet_push_queue q ON q.id = n.queue_id
      WHERE n.membership_id = ${membershipId}
      ORDER BY n.created_at`),
  ) as Record<string, unknown>[];
}

async function expirations(membershipId: string) {
  return rowsOf(
    await getDb().execute(sql`
      SELECT e.units_expired, e.expires_on::text AS expires_on, e.accrual_kind
      FROM core.balance_expiration e WHERE e.membership_id = ${membershipId}`),
  ) as Record<string, unknown>[];
}

afterAll(async () => {
  for (const seed of seeds) await dropBusiness(seed.business.id);
});

describe.skipIf(!integrationEnabled)(
  "balance expiry sweep (spec 0195)",
  { timeout: 60_000 },
  () => {
    it("(a) notices at 20 days at 10:00 local, then «hoy vencen», then expires the next day", async () => {
      const { membership, run } = await world();
      expect(await run("2026-03-12T06:00:00Z")).toEqual({
        expired: 0,
        notices: 1,
      });
      expect(await run("2026-04-01T06:00:00Z")).toEqual({
        expired: 0,
        notices: 1,
      });
      const sent = await notices(membership.id);
      expect(sent.map((n) => Number(n.days_before))).toEqual([20, 0]);
      expect(sent[0]).toMatchObject({
        expires_on: "2026-04-01",
        class: "transactional",
      });
      expect(String(sent[0].body)).toContain(
        "Tus 120 puntos vencen en 20 días",
      );
      expect(new Date(String(sent[0].not_before)).toISOString()).toBe(
        "2026-03-12T15:00:00.000Z",
      );
      expect(String(sent[1].body)).toContain("Hoy vencen tus 120 puntos");
      expect((await readBalances(membership.id)).points).toBe(120);

      expect(await run("2026-04-02T06:00:00Z")).toEqual({
        expired: 1,
        notices: 0,
      });
      expect((await readBalances(membership.id)).points).toBe(0);
      expect(await expirations(membership.id)).toEqual([
        {
          units_expired: 120,
          expires_on: "2026-04-01",
          accrual_kind: "points",
        },
      ]);
    });

    it("(b)(c) overdue WITHOUT the day notice: notice today, nothing lost, once; expires tomorrow", async () => {
      const { membership, run } = await world();
      expect(await run("2026-05-10T16:00:00Z")).toEqual({
        expired: 0,
        notices: 1,
      });
      expect(await run("2026-05-10T20:00:00Z")).toEqual({
        expired: 0,
        notices: 0,
      });
      expect(
        (await notices(membership.id)).map((n) => Number(n.days_before)),
      ).toEqual([0]);
      expect((await readBalances(membership.id)).points).toBe(120);
      expect(await run("2026-05-11T06:00:00Z")).toEqual({
        expired: 1,
        notices: 0,
      });
      expect((await readBalances(membership.id)).points).toBe(0);
    });

    it("(d) a business without access gets neither notices nor expirations", async () => {
      const { seed, membership, run } = await world();
      await getDb().execute(sql`
      UPDATE core.subscription SET trial_ends_at = '2026-01-15T00:00:00Z'
      WHERE business_id = ${seed.business.id}`);
      expect(await run("2026-05-10T16:00:00Z")).toEqual({
        expired: 0,
        notices: 0,
      });
      expect(await notices(membership.id)).toEqual([]);
      expect((await readBalances(membership.id)).points).toBe(120);
    });

    it("(e) a purchase after the candidates were read moves the date: nothing expires", async () => {
      const { seed, membership, run } = await world();
      await run("2026-04-01T06:00:00Z");
      const now = at("2026-04-02T06:00:00Z");
      const [candidate] = await collectCandidates(now, {
        businessIds: [seed.business.id],
      });
      expect(candidate.lastVisitAt).toBeNull();
      await getDb().execute(sql`
      UPDATE core.business_customer SET last_visit_at = '2026-04-02T05:00:00Z'
      WHERE business_id = ${seed.business.id}`);
      expect(await expireMembership(candidate, now)).toBe(0);
      expect((await readBalances(membership.id)).points).toBe(120);
      expect(await expirations(membership.id)).toEqual([]);
    });

    it("(f) PUT turns the rule on from today: a customer gone for a year loses nothing that day", async () => {
      const { seed, membership, consumer, run } = await world();
      sesion.businessId = seed.business.id;
      sesion.userId = seed.userId;
      await getDb().execute(sql`
      UPDATE core.loyalty_program SET balance_expiry_months = NULL, balance_expiry_since = NULL
      WHERE id = ${seed.programId}`);
      const { PUT } = await import("../app/api/loyalty-program/expiry/route");
      const put = (months: unknown) =>
        PUT(
          new Request("http://x/api/loyalty-program/expiry", {
            method: "PUT",
            body: JSON.stringify({ months }),
          }),
        );

      const on = await put(3);
      expect(on.status).toBe(200);
      expect((await on.json()).balanceExpiryMonths).toBe(3);
      const events = rowsOf(
        await getDb().execute(sql`
        SELECT e.details FROM core.loyalty_program_event e
        WHERE e.program_id = ${seed.programId} AND e.action = 'expiry_changed'`),
      ) as { details: unknown }[];
      expect(events).toHaveLength(1);

      expect(await run(new Date().toISOString())).toEqual({
        expired: 0,
        notices: 0,
      });
      expect((await readBalances(membership.id)).points).toBe(120);

      const [summary] = await listConsumerPrograms(consumer.id);
      expect(summary.balanceExpiryMonths).toBe(3);
      expect(summary.balanceExpiresOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(
        summary.balanceExpiresOn! > new Date().toISOString().slice(0, 10),
      ).toBe(true);

      const off = await put(null);
      expect((await off.json()).balanceExpiryMonths).toBeNull();
      const [after] = await listConsumerPrograms(consumer.id);
      expect(after.balanceExpiresOn).toBeNull();
    });
  },
);
