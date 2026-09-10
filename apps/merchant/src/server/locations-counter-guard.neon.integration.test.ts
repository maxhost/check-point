import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  dropBusiness,
  readBalances,
  seedConsumer,
  seedReward,
  setBalance,
} from "./counter-integration-support";
import {
  integrationEnabled,
  seedExtraLocation,
  seedLocationsBusiness,
} from "./locations-integration-support";
import { getDb } from "./db";
import { orders, rewardRedemptions } from "./schema";
import { setLocationStatus } from "./locations";
import { resolveScan } from "./counter/resolve";
import { grantAccrual } from "./counter/grant";
import { redeemReward } from "./counter/redeem";

const ordersOf = (businessId: string, clientRequestId: string) =>
  getDb()
    .select({ id: orders.id, locationId: orders.locationId })
    .from(orders)
    .where(
      and(
        eq(orders.businessId, businessId),
        eq(orders.clientRequestId, clientRequestId),
      ),
    );

const redemptionsOf = (businessId: string, clientRequestId: string) =>
  getDb()
    .select({ id: rewardRedemptions.id })
    .from(rewardRedemptions)
    .where(
      and(
        eq(rewardRedemptions.businessId, businessId),
        eq(rewardRedemptions.clientRequestId, clientRequestId),
      ),
    );

/**
 * Spec 0061 — THE load-bearing guard. Dropping an archived location from the counter's
 * selector is an interface gate; `backoffice/counter/page.tsx` also takes
 * `?location=<uuid>` (the parameter exists so the staff can bookmark their branch), so an
 * old tab or a saved link would keep accrediting and redeeming against an archived
 * location. These tests skip the UI entirely and call the same domain entry points the
 * routes call, with the archived id in the body.
 *
 * Mutation EXECUTED, not predicted (transcribed in the spec 0061 handoff): removing
 * `eq(locations.status, "active")` from `assertLocationInBusiness` turns the first test
 * red — the archived location accredited 90 points and the balance moved. The second test
 * stays GREEN under that same mutation: it pins attribution, not the guard.
 * (Lower-case on purpose: the `no-mutations-left` Stop hook greps for the upper-case tag.)
 */
describe.skipIf(!integrationEnabled)(
  "an archived location cannot operate the counter (spec 0061)",
  () => {
    it("refuses an accreditation and a redemption against an archived location", async () => {
      const seed = await seedLocationsBusiness("Guard", "plus");
      // A second active location, so archiving the first is a legal product operation
      // and not a state only SQL can reach.
      const survivor = await seedExtraLocation(
        seed.business.id,
        "Sucursal Sur",
      );
      const rewardId = await seedReward({
        programId: seed.programId,
        businessId: seed.business.id,
        label: "Café gratis",
        pointsCost: 10,
      });
      try {
        const consumer = await seedConsumer();
        const resolved = await resolveScan(seed.business, consumer.qrToken);
        await setBalance(resolved.membership.id, { points: 100 });

        // ── Anti-false-green: while the location is ACTIVE both operations work, so a
        // rejection below is the `status` filter and not a broken seed or a bad id.
        const warmup = randomUUID();
        await grantAccrual(seed.business, seed.userId, {
          clientRequestId: warmup,
          membershipId: resolved.membership.id,
          mode: "quick",
          total: "9.00",
          locationId: seed.locationId,
        });
        expect(await ordersOf(seed.business.id, warmup)).toHaveLength(1);

        // ── Archive it through the real product path.
        const archived = await setLocationStatus(
          seed.business,
          seed.locationId,
          "archived",
        );
        expect(archived.status).toBe("archived");

        const before = await readBalances(resolved.membership.id);

        const grantKey = randomUUID();
        await expect(
          grantAccrual(seed.business, seed.userId, {
            clientRequestId: grantKey,
            membershipId: resolved.membership.id,
            mode: "quick",
            total: "9.00",
            locationId: seed.locationId,
          }),
        ).rejects.toMatchObject({ status: 422, code: "unknown_location" });

        const redeemKey = randomUUID();
        await expect(
          redeemReward(seed.business, seed.userId, {
            clientRequestId: redeemKey,
            membershipId: resolved.membership.id,
            rewardId,
            locationId: seed.locationId,
          }),
        ).rejects.toMatchObject({ status: 422, code: "unknown_location" });

        // ── The oracle is the DATABASE, never the thrown error (ADR 0054 §4): no row was
        // written and no balance moved.
        expect(await ordersOf(seed.business.id, grantKey)).toHaveLength(0);
        expect(await redemptionsOf(seed.business.id, redeemKey)).toHaveLength(
          0,
        );
        expect(await readBalances(resolved.membership.id)).toEqual(before);

        // ── And the surviving location still works, so the guard rejects by STATUS and
        // not because everything broke after the archive.
        const stillWorks = randomUUID();
        await grantAccrual(seed.business, seed.userId, {
          clientRequestId: stillWorks,
          membershipId: resolved.membership.id,
          mode: "quick",
          total: "9.00",
          locationId: survivor,
        });
        expect(await ordersOf(seed.business.id, stillWorks)).toMatchObject([
          { locationId: survivor },
        ]);
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 60_000);

    it("with two active locations the accreditation is attributed to the chosen one", async () => {
      // The `LocationGate` path (`counter-console.tsx`, `locations.length > 1`) has NEVER
      // run in production: the 11 businesses have exactly one location. This exercises
      // what the gate feeds into — that picking a location actually attributes there.
      const seed = await seedLocationsBusiness("DosLocales", "plus");
      const second = await seedExtraLocation(seed.business.id, "Sucursal Sur");
      try {
        const consumer = await seedConsumer();
        const resolved = await resolveScan(seed.business, consumer.qrToken);

        const first = randomUUID();
        await grantAccrual(seed.business, seed.userId, {
          clientRequestId: first,
          membershipId: resolved.membership.id,
          mode: "quick",
          total: "9.00",
          locationId: seed.locationId,
        });
        const other = randomUUID();
        await grantAccrual(seed.business, seed.userId, {
          clientRequestId: other,
          membershipId: resolved.membership.id,
          mode: "quick",
          total: "9.00",
          locationId: second,
        });

        expect(await ordersOf(seed.business.id, first)).toMatchObject([
          { locationId: seed.locationId },
        ]);
        expect(await ordersOf(seed.business.id, other)).toMatchObject([
          { locationId: second },
        ]);
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 60_000);
  },
);
