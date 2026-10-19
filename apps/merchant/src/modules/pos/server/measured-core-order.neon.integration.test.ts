import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  consumerAccounts,
  products,
  users,
} from "@mi-pasaporte/db/schema";
import {
  buildFinancialAmountsFromSnapshots,
  buildFinancialSettlementFromSnapshots,
} from "@mi-pasaporte/domain/financial";
import { UNIT_MEASURE } from "@mi-pasaporte/domain/measures";
import { insertMembershipWithProjection } from "@mi-pasaporte/domain/server/customers/projection";
import { pgErrorCode } from "@mi-pasaporte/domain/server/counter/core";
import {
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  seedConsumer,
  type Seed,
} from "../../../server/counter-integration-support";
import {
  persistGrant,
  persistMeasuredGrant,
  readOrderByRequest,
  type PersistMeasuredGrantInput,
  type OrderExecutor,
} from "../../../server/counter/orders";
import type { MeasuredGrantItem } from "../../../server/counter/measured-order-input";

// Direct internal writer acceptance, not an HTTP/auth/close or canonical mass cutover test.
const worlds: Seed[] = [];
const consumers: string[] = [];
let membershipId: string;
let productId: string;
let consumerId: string;

function measured(
  items?: MeasuredGrantItem[],
  totalDiscount = "0.00",
): PersistMeasuredGrantInput {
  const lines = items ?? [
    {
      sourceLineId: "opaque source is not the generated core id",
      productId,
      nameSnapshot: "Frozen authoritative label",
      unitPrice: "4.000000000",
      quantity: "2.000000000",
      measure: UNIT_MEASURE,
      lineTotal: "8.00",
    },
  ];
  const decision = {
    currencyCode: "USD",
    lines: lines.map((line, position) => ({ ...line, position })),
    discount:
      totalDiscount === "0.00"
        ? null
        : {
            amount: totalDiscount,
            origin: {
              type: "campaign_coupon" as const,
              sourceId: "server decision",
              scope: "order" as const,
            },
          },
  };
  const amounts = buildFinancialAmountsFromSnapshots(decision);
  const settlement = buildFinancialSettlementFromSnapshots({
    ...decision,
    payments:
      amounts.collected === "0.00"
        ? []
        : [
            {
              paymentId: "already decided",
              methodId: "trusted method",
              amount: amounts.collected,
            },
          ],
  });
  return {
    businessId: worlds[0].business.id,
    locationId: worlds[0].locationId,
    programId: worlds[0].programId,
    membershipId,
    consumerId,
    mode: "detailed",
    total: settlement.collected,
    currencyCode: "USD",
    note: "trusted internal fixture",
    accrualKind: "points",
    units: 17,
    createdByUserId: worlds[0].userId,
    clientRequestId: randomUUID(),
    items: lines,
    settlement,
  };
}

async function state() {
  const result = await getDb().execute(sql`
    SELECT
      (SELECT jsonb_agg(to_jsonb(o) ORDER BY o.id) FROM core."order" o WHERE business_id = ${worlds[0].business.id}::uuid) AS orders,
      (SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM core.order_item i JOIN core."order" o ON o.id=i.order_id WHERE o.business_id = ${worlds[0].business.id}::uuid) AS items,
      (SELECT to_jsonb(m) FROM consumer.program_membership m WHERE id = ${membershipId}::uuid) AS membership,
      (SELECT jsonb_agg(to_jsonb(q) ORDER BY q.id) FROM consumer.wallet_push_queue q WHERE consumer_id = ${consumerId}::uuid) AS pushes,
      (SELECT to_jsonb(c) FROM core.business_customer c WHERE business_id = ${worlds[0].business.id}::uuid AND consumer_id = ${consumerId}::uuid) AS projection,
      (SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM core.module_event e WHERE business_id = ${worlds[0].business.id}::uuid) AS events,
      (SELECT jsonb_agg(to_jsonb(d) ORDER BY d.event_id) FROM core.module_event_delivery d JOIN core.module_event e ON e.id=d.event_id WHERE e.business_id = ${worlds[0].business.id}::uuid) AS deliveries
  `);
  return result.rows[0];
}

async function rollback(input: PersistMeasuredGrantInput, code?: string) {
  const before = await state();
  let failure: unknown;
  try {
    await persistMeasuredGrant(input);
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeDefined();
  if (code) expect(pgErrorCode(failure)).toBe(code);
  expect(await state()).toEqual(before);
}

describe.skipIf(!integrationEnabled)(
  "0242 CP2c internal measured core order writer",
  () => {
    beforeAll(async () => {
      for (const label of ["measured writer", "untouched tenant"])
        worlds.push(
          await seedBusiness({
            name: label,
            kind: "points",
            mode: "per_purchase",
            grant: 17,
            blockAmount: null,
          }),
        );
      const consumer = await seedConsumer();
      consumerId = consumer.id;
      consumers.push(consumerId);
      membershipId = (
        await insertMembershipWithProjection({
          businessId: worlds[0].business.id,
          programId: worlds[0].programId,
          consumerId,
        })
      ).id;
      productId = (
        await getDb()
          .insert(products)
          .values({
            businessId: worlds[0].business.id,
            name: "Current catalogue label",
            unitPrice: "9.00",
            availableAllLocations: true,
          })
          .returning({ id: products.id })
      )[0].id;
    }, 180_000);

    afterAll(async () => {
      const ownerIds = worlds.map((world) => world.userId);
      for (const world of worlds) await dropBusiness(world.business.id);
      if (consumers.length)
        await getDb()
          .delete(consumerAccounts)
          .where(inArray(consumerAccounts.id, consumers));
      if (ownerIds.length)
        await getDb().delete(users).where(inArray(users.id, ownerIds));
      for (const world of worlds) {
        expect(
          await getDb()
            .select({ id: businesses.id })
            .from(businesses)
            .where(eq(businesses.id, world.business.id)),
        ).toEqual([]);
        expect(
          (
            await getDb().execute(
              sql`select user_id from core.business_membership where business_id=${world.business.id}::uuid`,
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
      for (const id of consumers) {
        expect(
          await getDb()
            .select({ id: consumerAccounts.id })
            .from(consumerAccounts)
            .where(eq(consumerAccounts.id, id)),
        ).toEqual([]);
        expect(
          (
            await getDb().execute(
              sql`select id from consumer.wallet_push_queue where consumer_id=${id}::uuid`,
            )
          ).rows,
        ).toEqual([]);
      }
    }, 180_000);

    it("persists canonical unit originals, metadata, net, decided units and all atomic effects", async () => {
      const input = measured(undefined, "3.00");
      const granted = await persistMeasuredGrant(input);
      expect(granted).toMatchObject({
        unitsGranted: 17,
        balanceAfter: 17,
        total: "5.00",
        accrualKind: "points",
      });
      expect(granted!.pushQueueId).toBeTruthy();
      const rows = (
        await getDb().execute(
          sql`select i.*,o.created_at as order_created_at from core.order_item i join core."order" o on o.id=i.order_id where o.id=${granted!.id}::uuid`,
        )
      ).rows;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        product_id: productId,
        name_snapshot: input.items[0].nameSnapshot,
        unit_price_snapshot: "4.000000000",
        quantity: "2.000000000",
        line_total: "8.00",
        measure_kind: "unit",
        quantity_unit: "unit",
        price_unit: "unit",
        conversion_version: "mass-si-1",
      });
      expect(rows[0].id).not.toBe(input.items[0].sourceLineId);
      const snapshot = await state();
      expect(snapshot.membership).toMatchObject({
        points_balance: 17,
        stamps_count: 0,
      });
      expect(
        (
          await getDb().execute(
            sql`select c.last_visit_at=o.created_at as same_time from core.business_customer c join core."order" o on o.business_id=c.business_id and o.consumer_id=c.consumer_id where o.id=${granted!.id}::uuid`,
          )
        ).rows,
      ).toEqual([{ same_time: true }]);
      expect(snapshot.pushes).toHaveLength(1);
      expect(snapshot.events).toHaveLength(1);
      expect(snapshot.deliveries).toHaveLength(1);
      expect(
        (
          await getDb().execute(
            sql`select id from core."order" where business_id=${worlds[1].business.id}::uuid`,
          )
        ).rows,
      ).toEqual([]);
      expect(
        (
          await getDb().execute(
            sql`select consumer_id from core.business_customer where business_id=${worlds[1].business.id}::uuid`,
          )
        ).rows,
      ).toEqual([]);
      expect(await persistMeasuredGrant(input)).toBeNull();
      expect(await state()).toEqual(snapshot);
      expect(
        await readOrderByRequest(input.businessId, input.clientRequestId),
      ).toMatchObject({ id: granted!.id, pushQueueId: null, total: "5.00" });
    }, 120_000);

    it("legacy still writes defaults and the same accreditation result", async () => {
      const { items, ...input } = measured();
      const granted = await persistGrant({
        ...input,
        items: items.map((line) => ({ ...line, quantity: 2 })),
      });
      expect(granted).toMatchObject({
        unitsGranted: 17,
        balanceAfter: 34,
        total: "8.00",
      });
      expect(
        (
          await getDb().execute(
            sql`select quantity,unit_price_snapshot,measure_kind,quantity_unit,price_unit,conversion_version from core.order_item where order_id=${granted!.id}::uuid`,
          )
        ).rows,
      ).toEqual([
        {
          quantity: "2.000000000",
          unit_price_snapshot: "4.000000000",
          measure_kind: "unit",
          quantity_unit: "unit",
          price_unit: "unit",
          conversion_version: "mass-si-1",
        },
      ]);
    }, 120_000);

    it("invalid final product FK rolls back order, balance, items, push, visit and event delivery", async () => {
      const first = measured().items[0];
      await rollback(
        measured([
          first,
          {
            ...first,
            sourceLineId: "last bad product",
            productId: randomUUID(),
          },
        ]),
        "23503",
      );
    }, 120_000);

    it("invalid final metadata is rejected before any effects", async () => {
      const first = measured().items[0];
      const input = measured([
        first,
        { ...first, sourceLineId: "bad metadata" },
      ]);
      input.items[1].measure = {
        ...UNIT_MEASURE,
        conversionVersion: "unsupported" as "mass-si-1",
      };
      await rollback(input);
    }, 120_000);

    it("canonical mass and precise tariffs remain blocked by existing expand constraints", async () => {
      const first = measured().items[0];
      await rollback(
        measured([
          first,
          {
            ...first,
            sourceLineId: "blocked mass",
            quantity: "907.18474",
            measure: {
              kind: "mass",
              quantityUnit: "g",
              priceUnit: "lb",
              conversionVersion: "mass-si-1",
            },
          },
        ]),
        "23514",
      );
      await rollback(
        measured([{ ...first, quantity: "1", unitPrice: "8.000000001" }]),
        "23514",
      );
    }, 120_000);

    it("concurrent duplicate loses with 23505, rolling back its bump and all derived effects", async () => {
      const input = measured();
      const before = await state();
      const marker = `measured-core-${randomUUID()}`;
      let unlock!: () => void;
      let locked!: () => void;
      const ready = new Promise<void>((resolve) => {
        locked = resolve;
      });
      const release = new Promise<void>((resolve) => {
        unlock = resolve;
      });
      const blocker = withDbTransaction(async (tx) => {
        await tx.execute(
          sql`select id from consumer.program_membership where id=${membershipId}::uuid for update`,
        );
        locked();
        await release;
      });
      await Promise.race([ready, blocker]);
      const executor: OrderExecutor = {
        execute: (query) =>
          getDb().execute(sql`${sql.raw(`/* ${marker} */`)} ${query}`),
      };
      const race = Promise.allSettled([
        persistMeasuredGrant(input, executor),
        persistMeasuredGrant(input, executor),
      ]);
      let outcomes: Awaited<typeof race>;
      try {
        const deadline = Date.now() + 20_000;
        let waiting = 0;
        while (Date.now() < deadline) {
          const row = (
            await getDb().execute(
              sql`select count(*)::integer as waiting from pg_stat_activity where query like ${`/* ${marker} */%`} and wait_event_type='Lock'`,
            )
          ).rows[0];
          waiting = Number(row.waiting);
          if (waiting === 2) break;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        expect(waiting).toBe(2);
      } finally {
        unlock();
        await blocker;
        outcomes = await race;
      }
      const winners = outcomes.filter(
        (outcome) => outcome.status === "fulfilled" && outcome.value !== null,
      );
      const losers = outcomes.filter(
        (outcome) => outcome.status === "rejected",
      );
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);
      expect(pgErrorCode((losers[0] as PromiseRejectedResult).reason)).toBe(
        "23505",
      );
      const after = await state();
      expect(after.orders).toHaveLength(
        (before.orders as unknown[]).length + 1,
      );
      expect(after.items).toHaveLength((before.items as unknown[]).length + 1);
      expect(after.pushes).toHaveLength(
        (before.pushes as unknown[]).length + 1,
      );
      expect(after.events).toHaveLength(
        (before.events as unknown[]).length + 1,
      );
      expect(after.deliveries).toHaveLength(
        (before.deliveries as unknown[]).length + 1,
      );
      expect(
        (after.membership as { points_balance: number }).points_balance,
      ).toBe(
        (before.membership as { points_balance: number }).points_balance + 17,
      );
      expect(
        await readOrderByRequest(input.businessId, input.clientRequestId),
      ).toMatchObject({ pushQueueId: null, unitsGranted: 17 });
    }, 120_000);
  },
);
