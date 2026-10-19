import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  campaignCoupons,
  campaigns,
  consumerAccounts,
  products,
  users,
} from "@mi-pasaporte/db/schema";
import { UNIT_MEASURE } from "@mi-pasaporte/domain/measures";
import { integrationEnabled } from "../../../server/counter-integration-support";
import {
  seedCouponWorld,
  dropCouponWorld,
  newCouponCard,
  chooseCoupon,
  type CouponWorld,
  type CouponCard,
} from "../../../server/counter-coupon-support";
import {
  accreditMeasuredInTx,
  type MeasuredAccreditInput,
} from "./measured-accredit";

// Internal orchestration only. Canonical mass storage and close remain behind expand barriers.
let world: CouponWorld;
let foreign: CouponWorld;
let productId: string;
const cards: CouponCard[] = [];
async function card(over: Partial<typeof campaignCoupons.$inferInsert> = {}) {
  const created = await newCouponCard(world);
  cards.push(created);
  await getDb()
    .update(campaignCoupons)
    .set({
      productId:
        !over.kindSnapshot ||
        over.kindSnapshot === "free_product" ||
        over.kindSnapshot === "two_for_one"
          ? productId
          : null,
      ...over,
    })
    .where(eq(campaignCoupons.id, created.couponId));
  await chooseCoupon(created);
  return created;
}
function input(c: CouponCard, net = "4.00"): MeasuredAccreditInput {
  return {
    business: world.seed.business,
    userId: world.seed.userId,
    membershipId: c.membershipId,
    clientRequestId: randomUUID(),
    locationId: world.seed.locationId,
    note: "Internal measured accreditation",
    items: [
      {
        sourceLineId: "source unit",
        productId,
        nameSnapshot: "Frozen name",
        quantity: "2.000000000",
        unitPrice: "4.000000000",
        measure: UNIT_MEASURE,
      },
    ],
    payments:
      net === "0.00"
        ? []
        : [
            {
              paymentId: "trusted payment",
              methodId: "caller validated method",
              amount: net,
            },
          ],
    coupon: { couponId: c.couponId, productId: null },
    now: new Date(),
  };
}
const run = (ctx: MeasuredAccreditInput) =>
  withDbTransaction((tx) => accreditMeasuredInTx(tx, ctx));
async function state(c: CouponCard) {
  const result = await getDb().execute(sql`
    select
      (select jsonb_agg(to_jsonb(o) order by o.id) from core."order" o where o.business_id=${world.seed.business.id}::uuid) as orders,
      (select jsonb_agg(to_jsonb(i) order by i.id) from core.order_item i join core."order" o on o.id=i.order_id where o.business_id=${world.seed.business.id}::uuid) as items,
      (select to_jsonb(m) from consumer.program_membership m where m.id=${c.membershipId}::uuid) as membership,
      (select to_jsonb(b) from core.business_customer b where b.business_id=${world.seed.business.id}::uuid and b.consumer_id=${c.consumerId}::uuid) as customer,
      (select to_jsonb(a) from consumer.consumer_account a where a.id=${c.consumerId}::uuid) as selection,
      (select jsonb_agg(to_jsonb(q) order by q.id) from consumer.wallet_push_queue q where q.consumer_id=${c.consumerId}::uuid) as pushes,
      (select jsonb_agg(to_jsonb(r) order by r.id) from core.coupon_redemption r where r.business_id=${world.seed.business.id}::uuid) as redemptions,
      (select to_jsonb(t) from core.campaign_turn t where t.id=${c.turnId}::uuid) as turn,
      (select jsonb_agg(to_jsonb(e) order by e.id) from core.module_event e where e.business_id=${world.seed.business.id}::uuid) as events,
      (select jsonb_agg(to_jsonb(d) order by d.event_id) from core.module_event_delivery d join core.module_event e on e.id=d.event_id where e.business_id=${world.seed.business.id}::uuid) as deliveries
  `);
  return result.rows[0];
}
async function rejectsUnchanged(
  c: CouponCard,
  ctx: MeasuredAccreditInput,
  code: string,
  status = 409,
) {
  const before = await state(c);
  await expect(run(ctx)).rejects.toMatchObject({ code, status });
  expect(await state(c)).toEqual(before);
}
describe.skipIf(!integrationEnabled)(
  "0242 measured accreditation transaction",
  () => {
    beforeAll(async () => {
      world = await seedCouponWorld("0242 measured", 1000);
      foreign = await seedCouponWorld("0242 untouched", 1000);
      productId = (
        await getDb()
          .insert(products)
          .values({
            businessId: world.seed.business.id,
            name: "Current product",
            unitPrice: "9.00",
            availableAllLocations: true,
          })
          .returning({ id: products.id })
      )[0].id;
    }, 180000);
    afterAll(async () => {
      const ownerIds = [world, foreign]
        .filter(Boolean)
        .map((w) => w.seed.userId);
      for (const w of [world, foreign].filter(Boolean))
        await dropCouponWorld(w);
      if (cards.length)
        await getDb()
          .delete(consumerAccounts)
          .where(
            inArray(
              consumerAccounts.id,
              cards.map((c) => c.consumerId),
            ),
          );
      if (ownerIds.length)
        await getDb().delete(users).where(inArray(users.id, ownerIds));
      for (const w of [world, foreign].filter(Boolean)) {
        expect(
          await getDb()
            .select({ id: businesses.id })
            .from(businesses)
            .where(eq(businesses.id, w.seed.business.id)),
        ).toEqual([]);
        expect(
          (
            await getDb().execute(
              sql`select user_id from core.business_membership where business_id=${w.seed.business.id}::uuid`,
            )
          ).rows,
        ).toEqual([]);
      }
      for (const id of ownerIds) {
        expect(
          await getDb()
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, id)),
        ).toEqual([]);
        expect(
          (
            await getDb().execute(
              sql`select id from merchant_auth.session where user_id=${id}`,
            )
          ).rows,
        ).toEqual([]);
      }
      for (const c of cards) {
        expect(
          await getDb()
            .select({ id: consumerAccounts.id })
            .from(consumerAccounts)
            .where(eq(consumerAccounts.id, c.consumerId)),
        ).toEqual([]);
        expect(
          (
            await getDb().execute(
              sql`select id from consumer.program_membership where consumer_id=${c.consumerId}::uuid union all select id from consumer.wallet_push_queue where consumer_id=${c.consumerId}::uuid`,
            )
          ).rows,
        ).toEqual([]);
      }
    }, 180000);
    it.each([
      {
        kindSnapshot: "discount" as const,
        discountUnitSnapshot: "percent",
        discountValueSnapshot: "25.00",
        net: "6.00",
        units: 60,
        extra: null,
      },
      {
        kindSnapshot: "discount" as const,
        discountUnitSnapshot: "amount",
        discountValueSnapshot: "3.00",
        currencyCodeSnapshot: "USD",
        net: "5.00",
        units: 50,
        extra: null,
      },
      {
        kindSnapshot: "free_product" as const,
        net: "4.00",
        units: 40,
        extra: null,
      },
      {
        kindSnapshot: "two_for_one" as const,
        net: "4.00",
        units: 40,
        extra: null,
      },
      {
        kindSnapshot: "custom" as const,
        ruleSnapshot: "No parsing required",
        net: "8.00",
        units: 80,
        extra: null,
      },
      {
        kindSnapshot: "extra_points" as const,
        extraUnitsSnapshot: 13,
        net: "8.00",
        units: 80,
        extra: 13,
      },
      {
        kindSnapshot: "discount" as const,
        discountUnitSnapshot: "percent",
        discountValueSnapshot: "100.00",
        net: "0.00",
        units: 0,
        extra: null,
      },
    ])(
      "settles and persists $kindSnapshot net $net atomically",
      async ({ net, units, extra, ...over }) => {
        const c = await card(over);
        const ctx = input(c, net);
        // The locked coupon product overrides the operator's unrelated selection.
        ctx.coupon!.productId = randomUUID();
        const result = await run(ctx);
        expect(result.settlement.collected).toBe(net);
        expect(result.granted).toMatchObject({
          total: net,
          unitsGranted: units,
          balanceAfter: 77 + units + (extra ?? 0),
          coupon: {
            extraUnits: extra,
            discountAmount: result.settlement.discount,
          },
        });
        const stored = await state(c);
        expect(stored.membership).toMatchObject({
          points_balance: 77 + units + (extra ?? 0),
        });
        expect(stored.selection).toMatchObject({ selected_coupon_id: null });
        expect(stored.turn).toMatchObject({ outcome: "coupon_redeemed" });
        expect(stored.pushes).toHaveLength(1);
        expect(
          (stored.redemptions as { order_id: string }[]).filter(
            (r) => r.order_id === result.granted.id,
          ),
        ).toHaveLength(1);
        const rows = (
          await getDb().execute(
            sql`select i.*,c.last_visit_at=o.created_at as visit_matches from core.order_item i join core."order" o on o.id=i.order_id join core.business_customer c on c.business_id=o.business_id and c.consumer_id=o.consumer_id where o.id=${result.granted.id}::uuid`,
          )
        ).rows;
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
          quantity: "2.000000000",
          unit_price_snapshot: "4.000000000",
          line_total: "8.00",
          name_snapshot: "Frozen name",
          visit_matches: true,
        });
        await rejectsUnchanged(c, ctx, "request_reused");
      },
      120000,
    );
    it("excludes a selected coupon locally without consuming selection", async () => {
      const c = await card();
      const ctx = { ...input(c, "8.00"), coupon: null };
      const result = await run(ctx);
      expect(result.granted).toMatchObject({ unitsGranted: 80, coupon: null });
      expect((await state(c)).selection).toMatchObject({
        selected_coupon_id: c.couponId,
      });
      await rejectsUnchanged(c, ctx, "request_reused");
    }, 120000);
    it.each([
      "not_selected",
      "expired",
      "foreign",
      "missing_target",
      "insufficient",
      "mass",
      "explicit_mass",
    ])(
      "rejects %s with no changes",
      async (reason) => {
        const c = await card({
          kindSnapshot:
            reason === "insufficient" ? "two_for_one" : "free_product",
        });
        const ctx = input(c);
        let code = "coupon_product_missing";
        let status = 409;
        if (reason === "not_selected") {
          await getDb()
            .update(consumerAccounts)
            .set({ selectedCouponId: null })
            .where(eq(consumerAccounts.id, c.consumerId));
          code = "coupon_not_selected";
        }
        if (reason === "expired") {
          await getDb()
            .update(campaignCoupons)
            .set({
              validFrom: new Date(Date.now() - 172800000),
              validUntil: new Date(Date.now() - 86400000),
            })
            .where(eq(campaignCoupons.id, c.couponId));
          code = "coupon_expired";
        }
        if (reason === "foreign") {
          ctx.business = foreign.seed.business;
          code = "foreign_membership";
          status = 403;
        }
        if (reason === "missing_target")
          ctx.coupon!.targetSourceLineId = "another sale's source";
        if (reason === "insufficient") {
          ctx.items = [{ ...ctx.items[0], quantity: "1" }];
          code = "coupon_quantity";
        }
        if (reason === "mass" || reason === "explicit_mass") {
          const mass = {
            ...ctx.items[0],
            sourceLineId: "synthetic mass",
            quantity: "907.18474",
            measure: {
              kind: "mass" as const,
              quantityUnit: "g" as const,
              priceUnit: "lb" as const,
              conversionVersion: "mass-si-1" as const,
            },
          };
          ctx.items = reason === "mass" ? [mass] : [mass, ...ctx.items];
          if (reason === "explicit_mass")
            ctx.coupon!.targetSourceLineId = mass.sourceLineId;
          code = "coupon_measure_not_supported";
        }
        await rejectsUnchanged(c, ctx, code, status);
      },
      120000,
    );
    it("rejects a coupon belonging to another consumer", async () => {
      const c = await card();
      const other = await card();
      const ctx = input(c);
      ctx.coupon!.couponId = other.couponId;
      await rejectsUnchanged(c, ctx, "unknown_coupon", 404);
    }, 120000);
    it("rejects current campaign cap under locks", async () => {
      const c = await card();
      const count = (
        await getDb().execute(
          sql`select count(*)::int as n from core.coupon_redemption where campaign_id=${world.campaignId}::uuid`,
        )
      ).rows[0].n as number;
      await getDb()
        .update(campaigns)
        .set({ couponMaxRedemptions: count })
        .where(eq(campaigns.id, world.campaignId));
      try {
        await rejectsUnchanged(c, input(c), "coupon_cap_reached");
      } finally {
        await getDb()
          .update(campaigns)
          .set({ couponMaxRedemptions: 1000 })
          .where(eq(campaigns.id, world.campaignId));
      }
    }, 120000);
    it("rolls back all effects including extras, redemption, selection and turn after accreditation", async () => {
      const c = await card({
        kindSnapshot: "extra_points",
        extraUnitsSnapshot: 13,
      });
      const before = await state(c);
      await expect(
        withDbTransaction(async (tx) => {
          await accreditMeasuredInTx(tx, input(c, "8.00"));
          throw new Error("deliberate downstream failure");
        }),
      ).rejects.toThrow("deliberate downstream failure");
      expect(await state(c)).toEqual(before);
    }, 120000);
    it("serializes same coupon/key race with a unique effect and rejects the reused request", async () => {
      const c = await card();
      const ctx = input(c);
      const outcomes = await Promise.allSettled([run(ctx), run(ctx)]);
      expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
      const failures = outcomes.filter((o) => o.status === "rejected");
      expect(failures).toHaveLength(1);
      expect((failures[0] as PromiseRejectedResult).reason).toMatchObject({
        code: "request_reused",
      });
      const stored = await state(c);
      expect(stored.membership).toMatchObject({ points_balance: 117 });
      expect(stored.pushes).toHaveLength(1);
      expect(
        (stored.redemptions as { coupon_id: string }[]).filter(
          (r) => r.coupon_id === c.couponId,
        ),
      ).toHaveLength(1);
      expect(
        (
          await getDb().execute(
            sql`select id from core."order" where business_id=${foreign.seed.business.id}::uuid`,
          )
        ).rows,
      ).toEqual([]);
    }, 120000);
  },
);
