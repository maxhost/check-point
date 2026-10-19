import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  campaignCoupons,
  consumerAccounts,
  couponRedemptions,
  locations,
  loyaltyPrograms,
  programMemberships,
  sessions,
  users,
} from "@mi-pasaporte/db/schema";
import * as projection from "@mi-pasaporte/domain/server/customers/projection";
import * as rewards from "@mi-pasaporte/domain/server/loyalty-program/persistence";
import { pgErrorCode } from "@mi-pasaporte/domain/server/counter/core";
import * as catalog from "../../../server/counter/resolve-catalog";
import { resolveScan } from "../../../server/counter/resolve";
import {
  integrationEnabled,
  seedConsumer,
  setBalance,
} from "../../../server/counter-integration-support";
import {
  type CouponWorld,
  chooseCoupon,
  dropCouponWorld,
  forceChoice,
  newCouponCard,
  seedCouponWorld,
} from "../../../server/counter-coupon-support";
import { resolveMeasuredScan } from "./measured-resolve";

const worlds: CouponWorld[] = [];
const consumers: string[] = [];
async function world(label: string) {
  const built = await seedCouponWorld(label);
  worlds.push(built);
  return built;
}
async function consumer() {
  const built = await seedConsumer();
  consumers.push(built.id);
  return built;
}
async function effects(businessId: string) {
  const result = await getDb().execute(sql`
    select
      (select count(*) from core."order" where business_id=${businessId})::int as orders,
      (select count(*) from core.module_event where business_id=${businessId})::int as events,
      (select count(*) from core.coupon_redemption where business_id=${businessId})::int as redemptions,
      (select count(*) from pos.pos_order where business_id=${businessId})::int as preparations
  `);
  return result.rows;
}
async function projectionRows(businessId: string, consumerId: string) {
  return (
    await getDb().execute<{ scanned: boolean; visited: boolean }>(sql`
      select last_scan_at is not null as scanned, last_visit_at is not null as visited from core.business_customer
      where business_id=${businessId} and consumer_id=${consumerId}
    `)
  ).rows;
}
async function memberships(consumerId: string) {
  return getDb()
    .select()
    .from(programMemberships)
    .where(eq(programMemberships.consumerId, consumerId));
}

// Direct resolver tests: no HTTP authorization/header/cache assertions are claimed here.
describe.skipIf(!integrationEnabled)(
  "0242 CP2c minimal identity context on real DB",
  { timeout: 120_000 },
  () => {
    afterAll(async () => {
      vi.restoreAllMocks();
      const businessIds = worlds.map((w) => w.seed.business.id);
      const ownerIds = worlds.map((w) => w.seed.userId);
      for (const built of worlds) await dropCouponWorld(built);
      if (consumers.length)
        await getDb()
          .delete(consumerAccounts)
          .where(inArray(consumerAccounts.id, consumers));
      if (ownerIds.length)
        await getDb().delete(users).where(inArray(users.id, ownerIds));
      if (businessIds.length)
        expect(
          await getDb()
            .select({ id: businesses.id })
            .from(businesses)
            .where(inArray(businesses.id, businessIds)),
        ).toEqual([]);
      if (consumers.length) {
        expect(
          await getDb()
            .select({ id: consumerAccounts.id })
            .from(consumerAccounts)
            .where(inArray(consumerAccounts.id, consumers)),
        ).toEqual([]);
        expect(
          await getDb()
            .select({ id: programMemberships.id })
            .from(programMemberships)
            .where(inArray(programMemberships.consumerId, consumers)),
        ).toEqual([]);
      }
      if (ownerIds.length) {
        expect(
          await getDb()
            .select({ id: users.id })
            .from(users)
            .where(inArray(users.id, ownerIds)),
        ).toEqual([]);
        expect(
          await getDb()
            .select({ id: sessions.id })
            .from(sessions)
            .where(inArray(sessions.userId, ownerIds)),
        ).toEqual([]);
      }
    });

    it("enrols once, touches last_scan, preserves balances and exact accrual, without legacy reads or purchase effects", async () => {
      const w = await world("CP2c context");
      const c = await consumer();
      await getDb()
        .update(loyaltyPrograms)
        .set({ accrualBlockAmount: "1234567890.12" })
        .where(eq(loyaltyPrograms.id, w.seed.programId));
      const before = await effects(w.seed.business.id);
      const catalogSpy = vi.spyOn(catalog, "businessCatalog");
      const shortcutsSpy = vi.spyOn(catalog, "purchaseShortcuts");
      const rewardsSpy = vi.spyOn(rewards, "loadProgramRewards");
      try {
        const first = await resolveMeasuredScan(
          w.seed.business,
          `  ${c.qrToken}  `,
          w.seed.locationId,
        );
        expect(first.membership).toMatchObject({
          justEnrolled: true,
          pointsBalance: 0,
          stampsCount: 0,
        });
        expect(first.program.accrual.blockAmount).toBe("1234567890.12");
        expect(await projectionRows(w.seed.business.id, c.id)).toEqual([
          { scanned: true, visited: false },
        ]);
        await setBalance(first.membership.id, { points: 77, stamps: 3 });
        await getDb().execute(sql`
          update core.business_customer set last_scan_at=null
          where business_id=${w.seed.business.id} and consumer_id=${c.id}
        `);
        const again = await resolveMeasuredScan(w.seed.business, c.qrToken);
        expect(again.membership).toEqual({
          id: first.membership.id,
          justEnrolled: false,
          pointsBalance: 77,
          stampsCount: 3,
        });
        expect(await projectionRows(w.seed.business.id, c.id)).toEqual([
          { scanned: true, visited: false },
        ]);
        expect(await memberships(c.id)).toHaveLength(1);
        expect(await effects(w.seed.business.id)).toEqual(before);
        expect(catalogSpy).not.toHaveBeenCalled();
        expect(shortcutsSpy).not.toHaveBeenCalled();
        expect(rewardsSpy).not.toHaveBeenCalled();
      } finally {
        catalogSpy.mockRestore();
        shortcutsSpy.mockRestore();
        rewardsSpy.mockRestore();
      }
      const legacy = await resolveScan(w.seed.business, c.qrToken);
      expect(Object.keys(legacy).sort()).toEqual([
        "catalog",
        "consumer",
        "couponState",
        "membership",
        "program",
        "rewards",
      ]);
      expect(legacy.program.accrual.blockAmount).toBe(1234567890.12);
      expect(legacy.membership).toMatchObject({
        justEnrolled: false,
        pointsBalance: 77,
        stampsCount: 3,
      });
      expect(await effects(w.seed.business.id)).toEqual(before);
    });

    it("two genuine simultaneous first scans reuse the 23505 winner and one projection", async () => {
      const w = await world("CP2c race");
      const c = await consumer();
      const original = projection.insertMembershipWithProjection;
      let arrived = 0;
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const codes: (string | null)[] = [];
      const spy = vi
        .spyOn(projection, "insertMembershipWithProjection")
        .mockImplementation(async (input) => {
          arrived++;
          if (arrived === 2) release();
          await gate;
          try {
            return await original(input);
          } catch (error) {
            codes.push(pgErrorCode(error));
            throw error;
          }
        });
      const before = await effects(w.seed.business.id);
      let results;
      try {
        results = await Promise.all([
          resolveMeasuredScan(w.seed.business, c.qrToken),
          resolveMeasuredScan(w.seed.business, c.qrToken),
        ]);
      } finally {
        release();
        spy.mockRestore();
      }
      expect(arrived).toBe(2);
      expect(codes).toEqual(["23505"]);
      expect(new Set(results.map((r) => r.membership.id)).size).toBe(1);
      expect(results.filter((r) => r.membership.justEnrolled)).toHaveLength(1);
      expect(await memberships(c.id)).toHaveLength(1);
      expect(await projectionRows(w.seed.business.id, c.id)).toEqual([
        { scanned: true, visited: false },
      ]);
      expect(await effects(w.seed.business.id)).toEqual(before);
    });

    it("foreign/archived/unknown locals and invalid token/program never enrol or scan", async () => {
      const a = await world("CP2c guard A"),
        b = await world("CP2c guard B");
      const c = await consumer();
      for (const id of [b.seed.locationId, randomUUID()])
        await expect(
          resolveMeasuredScan(a.seed.business, c.qrToken, id),
        ).rejects.toMatchObject({ status: 422, code: "unknown_location" });
      await getDb()
        .update(locations)
        .set({ status: "archived" })
        .where(eq(locations.id, a.seed.locationId));
      await expect(
        resolveMeasuredScan(a.seed.business, c.qrToken, a.seed.locationId),
      ).rejects.toMatchObject({ status: 422, code: "unknown_location" });
      for (const token of ["", " ", "unknown-token"])
        await expect(
          resolveMeasuredScan(a.seed.business, token),
        ).rejects.toMatchObject({ code: "qr_unresolved" });
      await getDb()
        .update(loyaltyPrograms)
        .set({ status: "inactive" })
        .where(eq(loyaltyPrograms.id, a.seed.programId));
      await expect(
        resolveMeasuredScan(a.seed.business, c.qrToken),
      ).rejects.toMatchObject({ code: "no_program" });
      expect(await memberships(c.id)).toEqual([]);
      expect(await projectionRows(a.seed.business.id, c.id)).toEqual([]);
      expect(await projectionRows(b.seed.business.id, c.id)).toEqual([]);
      await getDb()
        .update(loyaltyPrograms)
        .set({
          status: "closing",
          earningEndsAt: new Date(Date.now() + 86400000),
          redemptionEndsAt: new Date(Date.now() + 172800000),
        })
        .where(eq(loyaltyPrograms.id, a.seed.programId));
      const scan = await resolveMeasuredScan(a.seed.business, c.qrToken);
      expect(scan.program.id).toBe(a.seed.programId);
      expect(await projectionRows(b.seed.business.id, c.id)).toEqual([]);
      expect((await memberships(c.id)).map((m) => m.businessId)).toEqual([
        a.seed.business.id,
      ]);
    });

    it("retains chosen coupon identity, textual rule, verdict and all coupon states without selecting or redeeming", async () => {
      const a = await world("CP2c coupons"),
        b = await world("CP2c foreign coupon");
      const card = await newCouponCard(a);
      consumers.push(card.consumerId);
      await getDb()
        .update(campaignCoupons)
        .set({ ruleSnapshot: "Solo los martes; consulta en caja." })
        .where(eq(campaignCoupons.id, card.couponId));
      const before = await effects(a.seed.business.id);
      expect(
        (await resolveMeasuredScan(a.seed.business, card.qrToken)).couponState,
      ).toEqual({ status: "hint", count: 1 });
      await chooseCoupon(card);
      const chosen = await resolveMeasuredScan(a.seed.business, card.qrToken);
      expect(chosen.couponState).toMatchObject({
        status: "selected",
        coupon: {
          couponId: card.couponId,
          rule: "Solo los martes; consulta en caja.",
          validUntil: a.endsAt.toISOString(),
        },
        verdict: { valid: true },
      });
      expect(
        (await resolveMeasuredScan(b.seed.business, card.qrToken)).couponState,
      ).toEqual({ status: "none" });
      await getDb()
        .update(campaignCoupons)
        .set({ validUntil: new Date(Date.now() - 60000) })
        .where(eq(campaignCoupons.id, card.couponId));
      await forceChoice(card);
      expect(
        (await resolveMeasuredScan(a.seed.business, card.qrToken)).couponState,
      ).toMatchObject({
        status: "selected",
        coupon: { couponId: card.couponId },
        verdict: { valid: false, code: "coupon_expired" },
      });
      expect(await effects(a.seed.business.id)).toEqual(before);
      const [account] = await getDb()
        .select({ selected: consumerAccounts.selectedCouponId })
        .from(consumerAccounts)
        .where(eq(consumerAccounts.id, card.consumerId));
      expect(account.selected).toBe(card.couponId);
      await getDb()
        .update(consumerAccounts)
        .set({ selectedCouponId: null, couponSelectedAt: null })
        .where(eq(consumerAccounts.id, card.consumerId));
      await getDb()
        .insert(couponRedemptions)
        .values({
          couponId: card.couponId,
          campaignId: a.campaignId,
          businessId: a.seed.business.id,
          consumerId: card.consumerId,
          membershipId: card.membershipId,
          locationId: a.seed.locationId,
          createdAt: new Date(Date.now() - 120000),
          labelSnapshot: "Histórico de hoy",
          costSnapshot: "2.50",
          kindSnapshot: "free_product",
          createdByUserId: a.seed.userId,
          clientRequestId: randomUUID(),
        });
      const historical = await effects(a.seed.business.id);
      expect(
        (await resolveMeasuredScan(a.seed.business, card.qrToken)).couponState,
      ).toEqual({ status: "used_today", label: "Histórico de hoy" });
      expect(await effects(a.seed.business.id)).toEqual(historical);
    });
  },
);
