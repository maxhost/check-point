import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  memberships,
  sessions,
  staffPersons,
  staffLocationPeriods,
  profitabilityFixedCosts,
  profitabilityFixedCostPeriods,
  profitabilityFixedCostAllocations,
} from "@mi-pasaporte/db/schema";
import { and, eq, sql } from "drizzle-orm";
import {
  permisosIntegrationEnabled,
  limpiarNegocios,
  cookieDe,
} from "../server/permissions-integration-support";
import { seedMember } from "../server/counter-integration-support";
import { staffPeopleWorld } from "../server/staff-people/integration-support";
const run = permisosIntegrationEnabled ? describe : describe.skip;
const readMigration = (name: string) =>
  readFileSync(
    new URL(`../../../../packages/db/drizzle/${name}.sql`, import.meta.url),
    "utf8",
  );
const migration = readMigration("0086_rentabilidad_y_personas"),
  finite = readMigration("0087_meses_finitos");
const laterObjects = sql`select
  to_regclass('core.commission_revision')::oid::text as commission_revision,
  to_regclass('core.payment_commission')::oid::text as payment_commission,
  to_regprocedure('core.p1_immutable()')::oid::text as immutable_function,
  (select md5(coalesce(string_agg(t::text,'|' order by t.id),'')) from core.commission_revision t) as commission_revision_hash,
  (select md5(coalesce(string_agg(t::text,'|' order by t.id),'')) from core.payment_commission t) as payment_commission_hash`;

run(
  "0231 six-table migration and strict monthly boundaries (isolated DDL)",
  { timeout: 60000 },
  () => {
    let world: Awaited<ReturnType<typeof staffPeopleWorld>>,
      userId: string,
      personId: string,
      periodId: string,
      costId: string,
      costPeriodId: string;
    beforeAll(async () => {
      world = await staffPeopleWorld();
      userId = await seedMember({
        businessId: world.business.id,
        permissions: ["catalog"],
      });
      world.users.push(userId);
      await cookieDe(userId);
      const [person] = await getDb()
        .insert(staffPersons)
        .values({ businessId: world.business.id, name: "Sin acceso" })
        .returning();
      personId = person.id;
      const [period] = await getDb()
        .insert(staffLocationPeriods)
        .values({
          businessId: world.business.id,
          personId,
          fromMonth: "2026-01-01",
        })
        .returning();
      periodId = period.id;
      const [cost] = await getDb()
        .insert(profitabilityFixedCosts)
        .values({ businessId: world.business.id, kind: "rent" })
        .returning();
      costId = cost.id;
      const [cp] = await getDb()
        .insert(profitabilityFixedCostPeriods)
        .values({
          businessId: world.business.id,
          costId,
          fromMonth: "2026-01-01",
          label: "Alquiler",
          monthlyTotal: "100",
          currencyCode: "COP",
          minorUnit: 0,
          distribution: "single",
        })
        .returning();
      costPeriodId = cp.id;
    });
    afterAll(async () => limpiarNegocios([world.business.id], world.users));

    it("actual CI journals match both SQL files; backfill creates identity only and preserves membership/session bytes", async () => {
      const journal = JSON.parse(
        readFileSync(
          new URL(
            "../../../../packages/db/drizzle/meta/_journal.json",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      for (const [idx, source] of [
        [86, migration],
        [87, finite],
      ] as const) {
        const entry = journal.entries.find(
          (e: { idx: number }) => e.idx === idx,
        );
        const applied = await getDb().execute(
          sql`select hash from drizzle.__drizzle_migrations where created_at=${entry.when}`,
        );
        expect(applied.rows[0]?.hash).toBe(
          createHash("sha256").update(source).digest("hex"),
        );
      }
      const laterBefore = await getDb().execute(laterObjects);
      expect(laterBefore.rows).toEqual([
        {
          commission_revision: expect.stringMatching(/^\d+$/),
          payment_commission: expect.stringMatching(/^\d+$/),
          immutable_function: expect.stringMatching(/^\d+$/),
          commission_revision_hash: expect.stringMatching(/^[0-9a-f]{32}$/),
          payment_commission_hash: expect.stringMatching(/^[0-9a-f]{32}$/),
        },
      ]);
      const rollback = new Error("rollback-0231-ddl");
      await expect(
        withDbTransaction(async (tx) => {
          const before = await tx
            .select()
            .from(memberships)
            .where(eq(memberships.userId, userId));
          const sessionBefore = await tx
            .select()
            .from(sessions)
            .where(eq(sessions.userId, userId));
          // Replay only the 0086 cost/staff boundary. The later commission objects
          // moved to core in 0235 and remain intact, including the sale header trigger.
          await tx.execute(sql`
            drop table profitability.fixed_cost_allocation;
            drop table profitability.fixed_cost_period;
            drop table profitability.fixed_cost;
            drop schema profitability;
            drop table core.staff_location_assignment;
            drop table core.staff_location_period;
            drop table core.staff_person
          `);
          for (const source of [migration, finite])
            for (const statement of source.split("--> statement-breakpoint"))
              await tx.execute(sql.raw(statement));
          expect((await tx.execute(laterObjects)).rows).toEqual(
            laterBefore.rows,
          );
          const people = await tx
            .select()
            .from(staffPersons)
            .where(
              and(
                eq(staffPersons.businessId, world.business.id),
                eq(staffPersons.membershipUserId, userId),
              ),
            );
          expect(people).toHaveLength(1);
          expect(
            await tx
              .select()
              .from(staffLocationPeriods)
              .where(eq(staffLocationPeriods.businessId, world.business.id)),
          ).toEqual([]);
          expect(
            await tx
              .select()
              .from(profitabilityFixedCosts)
              .where(eq(profitabilityFixedCosts.businessId, world.business.id)),
          ).toEqual([]);
          expect(
            await tx
              .select()
              .from(memberships)
              .where(eq(memberships.userId, userId)),
          ).toEqual(before);
          expect(
            await tx.select().from(sessions).where(eq(sessions.userId, userId)),
          ).toEqual(sessionBefore);
          expect(
            await tx
              .select()
              .from(staffPersons)
              .where(eq(staffPersons.membershipUserId, world.ownerId)),
          ).toEqual([]);
          throw rollback;
        }),
      ).rejects.toBe(rollback);
      // The isolated historical replay must leave the later P1 objects intact.
      expect((await getDb().execute(laterObjects)).rows).toEqual(
        laterBefore.rows,
      );
    });
    it("measures the NULL Infinity loophole and rejects nonfinite dates, malformed months and monetary values", async () => {
      const sample = await getDb().execute(
        sql`select extract(day from 'infinity'::date) as day, ((extract(day from 'infinity'::date)=1) is not false) as would_pass`,
      );
      expect(sample.rows[0]).toEqual({ day: null, would_pass: true });
      for (const change of [
        { fromMonth: "infinity" },
        { untilMonth: "infinity" },
        { fromMonth: "2026-01-02" },
        { untilMonth: "2025-12-01" },
      ])
        await expect(
          getDb()
            .update(staffLocationPeriods)
            .set(change)
            .where(eq(staffLocationPeriods.id, periodId)),
        ).rejects.toBeDefined();
      await expect(
        getDb()
          .update(profitabilityFixedCosts)
          .set({ endMonth: "infinity" })
          .where(eq(profitabilityFixedCosts.id, costId)),
      ).rejects.toBeDefined();
      for (const change of [
        { fromMonth: "infinity" },
        { untilMonth: "infinity" },
        { monthlyTotal: "NaN" },
        { monthlyTotal: "Infinity" },
        { monthlyTotal: "-0.01" },
        { monthlyTotal: "0.25" },
        { minorUnit: 3 },
      ])
        await expect(
          getDb()
            .update(profitabilityFixedCostPeriods)
            .set(change)
            .where(eq(profitabilityFixedCostPeriods.id, costPeriodId)),
        ).rejects.toBeDefined();
      for (const monthlyAmount of ["NaN", "Infinity", "-0.01"])
        await expect(
          getDb().insert(profitabilityFixedCostAllocations).values({
            businessId: world.business.id,
            periodId: costPeriodId,
            locationId: world.locations[0],
            monthlyAmount,
          }),
        ).rejects.toBeDefined();
      await expect(
        getDb()
          .update(memberships)
          .set({ permissions: [] })
          .where(eq(memberships.userId, userId)),
      ).rejects.toBeDefined();
    });
  },
);
