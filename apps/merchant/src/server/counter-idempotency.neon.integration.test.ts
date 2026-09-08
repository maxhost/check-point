import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Seed,
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  seedConsumer,
} from "./counter-integration-support";
import { getDb } from "./db";
import { orders, programMemberships, walletPushQueue } from "./schema";
import { resolveScan } from "./counter/resolve";
import { grantAccrual } from "./counter/grant";
import { pgErrorCode } from "./counter/core";
import { type PersistGrantInput, persistGrant } from "./counter/orders";

/**
 * Spec 0056 / ADR 0054 — the accreditation may not credit twice.
 *
 * These tests assert the PERSISTED state read back from the database, never the value
 * the API returned: with the bug present (`ON CONFLICT DO NOTHING` swallowing the
 * duplicate insert) the API answered "idempotent retry, balance 20" while the row said
 * 40. Anything that only looks at the response — or that counts `core."order"` rows —
 * is green with the bug.
 *
 * A single race may not interleave, so every race runs `RACES` times over fresh
 * consumers/memberships and asserts on all of them.
 *
 * What this file does NOT cover, declared instead of papered over:
 *  - Only `mode: "quick"`. A `detailed` grant (which also fans out the `items` CTE into
 *    `core.order_item`) was verified by hand during the spec 0056 review — 4 concurrent
 *    `persistGrant`, 23505 raised, balance 20, ONE order, TWO order_items, one push —
 *    but that run is not pinned here.
 *  - This is a real network race against Neon. A red run is not automatically a
 *    regression: see MAX_PROBES below for the one way it can fail without a bug.
 */

/** Two requests fired together do not always overlap inside the statement, so a single
 * pair is a weak oracle. Each race fires CONCURRENCY requests with the same key and
 * repeats RACES times. How many of the RACES catch a restored `ON CONFLICT DO NOTHING`
 * varies a lot per run — observed between 3 and 7 of 8 across four mutation runs — so
 * THESE RACES ARE THE PROBABILISTIC HALF of the oracle, not the load-bearing one. */
const CONCURRENCY = 4;
const RACES = 8;
/** The deterministic half: with `ON CONFLICT DO NOTHING` restored a 23505 can never be
 * raised, so `interleaved` stays 0, the loop burns all MAX_PROBES tries and the final
 * assertion fails EVERY time — interleaving or not. Do not delete this test for being
 * slow: without it, catching the mutation is down to luck. Its one false-red is 12
 * probes without 2 interleaves (observed margin: 2-4 probes used of 12). */
const MAX_PROBES = 12;
const PROBES_NEEDED = 2;
/** per_amount: 10 pts per $3.00 → floor(6/3)*10 = 20 pts. */
const TOTAL = "6.00";
const UNITS = 20;

type Fixture = {
  consumerId: string;
  membershipId: string;
  clientRequestId: string;
};

/** A brand-new consumer + auto-enrolled membership at balance 0, and a fresh key. */
async function newFixture(seed: Seed): Promise<Fixture> {
  const consumer = await seedConsumer();
  const resolved = await resolveScan(seed.business, consumer.qrToken);
  expect(resolved.membership.pointsBalance).toBe(0);
  return {
    consumerId: consumer.id,
    membershipId: resolved.membership.id,
    clientRequestId: randomUUID(),
  };
}

function grantBody(fixture: Fixture) {
  return {
    clientRequestId: fixture.clientRequestId,
    membershipId: fixture.membershipId,
    mode: "quick" as const,
    total: TOTAL,
  };
}

function grantInput(seed: Seed, fixture: Fixture): PersistGrantInput {
  return {
    businessId: seed.business.id,
    locationId: seed.locationId,
    programId: seed.programId,
    membershipId: fixture.membershipId,
    consumerId: fixture.consumerId,
    mode: "quick",
    total: TOTAL,
    currencyCode: seed.business.currencyCode,
    note: null,
    accrualKind: "points",
    units: UNITS,
    createdByUserId: seed.userId,
    clientRequestId: fixture.clientRequestId,
    items: [],
  };
}

/** The state that matters, read by SQL: balance, audit rows, push outbox rows. */
async function readState(businessId: string, fixture: Fixture) {
  const db = getDb();
  const [membership] = await db
    .select({
      points: programMemberships.pointsBalance,
      stamps: programMemberships.stampsCount,
    })
    .from(programMemberships)
    .where(eq(programMemberships.id, fixture.membershipId));
  const orderRows = await db
    .select({
      id: orders.id,
      unitsGranted: orders.unitsGranted,
      balanceAfter: orders.balanceAfter,
    })
    .from(orders)
    .where(
      and(
        eq(orders.businessId, businessId),
        eq(orders.clientRequestId, fixture.clientRequestId),
      ),
    );
  const pushRows = await db
    .select({ id: walletPushQueue.id })
    .from(walletPushQueue)
    .where(eq(walletPushQueue.consumerId, fixture.consumerId));
  return {
    points: membership.points,
    stamps: membership.stamps,
    orderRows,
    pushRows,
  };
}

/** Every invariant of the DoD, asserted against the database. */
async function expectCreditedOnce(
  businessId: string,
  fixture: Fixture,
  label: string,
) {
  const state = await readState(businessId, fixture);
  expect(state.points, `${label}: points_balance`).toBe(UNITS);
  expect(state.stamps, `${label}: stamps_count`).toBe(0);
  expect(state.orderRows, `${label}: core."order" rows`).toHaveLength(1);
  expect(state.orderRows[0].unitsGranted, `${label}: units_granted`).toBe(
    UNITS,
  );
  expect(state.orderRows[0].balanceAfter, `${label}: balance_after`).toBe(
    state.points,
  );
  expect(state.pushRows, `${label}: wallet_push_queue rows`).toHaveLength(1);
}

describe.skipIf(!integrationEnabled)(
  "grant idempotency under concurrency against Neon (spec 0056)",
  () => {
    let points: Seed;

    beforeAll(async () => {
      points = await seedBusiness({
        name: "Café Concurrente",
        kind: "points",
        mode: "per_amount",
        grant: 10,
        blockAmount: "3.00",
      });
    }, 30_000);

    afterAll(async () => {
      await dropBusiness(points.business.id);
    });

    for (let attempt = 1; attempt <= RACES; attempt += 1) {
      it(`race ${attempt}/${RACES}: ${CONCURRENCY} concurrent grants credit the balance once`, async () => {
        const fixture = await newFixture(points);
        const body = grantBody(fixture);
        const settled = await Promise.allSettled(
          Array.from({ length: CONCURRENCY }, () =>
            grantAccrual(points.business, points.userId, body),
          ),
        );
        // grant.ts absorbs the loser's 23505 by rereading the winner's order, so both
        // callers still get a 2xx. The lie was never in the status code.
        expect(
          settled.map((r) =>
            r.status === "rejected" ? String(r.reason) : "fulfilled",
          ),
        ).toEqual(Array.from({ length: CONCURRENCY }, () => "fulfilled"));

        await expectCreditedOnce(
          points.business.id,
          fixture,
          `race ${attempt}`,
        );
      }, 60_000);
    }

    it("a sequential retry with the same clientRequestId leaves the balance intact", async () => {
      const fixture = await newFixture(points);
      const body = grantBody(fixture);
      const first = await grantAccrual(points.business, points.userId, body);
      const second = await grantAccrual(points.business, points.userId, body);
      expect(first.order.unitsGranted).toBe(UNITS);
      expect(first.order.balanceAfter).toBe(UNITS);
      expect(second.order.balanceAfter).toBe(UNITS);
      await expectCreditedOnce(points.business.id, fixture, "sequential retry");
    }, 60_000);

    it("neon-http: the duplicate raises 23505 and the aborted statement reverts the bump", async () => {
      const codes: (string | null)[] = [];
      let interleaved = 0;
      for (
        let probe = 1;
        probe <= MAX_PROBES && interleaved < PROBES_NEEDED;
        probe += 1
      ) {
        const fixture = await newFixture(points);
        const input = grantInput(points, fixture);
        const settled = await Promise.allSettled(
          Array.from({ length: CONCURRENCY }, () => persistGrant(input)),
        );
        const rejected = settled.filter((r) => r.status === "rejected");
        for (const r of rejected) codes.push(pgErrorCode(r.reason));
        if (rejected.length > 0) interleaved += 1;
        // Holds for every interleaving; for the probes that DID raise 23505 this is
        // the proof that the aborted statement rolled its UPDATE back over HTTP.
        await expectCreditedOnce(points.business.id, fixture, `probe ${probe}`);
      }
      expect(
        codes.every((code) => code === "23505"),
        `codes: ${codes}`,
      ).toBe(true);
      expect(
        interleaved,
        `no probe raised 23505 in ${MAX_PROBES} tries: either the race is not reproducing or the duplicate is being swallowed`,
      ).toBe(PROBES_NEEDED);
    }, 120_000);
  },
);
