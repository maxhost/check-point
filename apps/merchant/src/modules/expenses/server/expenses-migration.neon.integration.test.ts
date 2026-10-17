import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql, eq } from "drizzle-orm";
import { getDb, withDbTransaction, type DbTransaction } from "@mi-pasaporte/db";
import {
  expenseConcepts,
  expenses,
  expenseRevisions,
  moduleEvents,
  staffPersons,
} from "@mi-pasaporte/db/schema";
import {
  dropModuleWorld,
  enableModules,
  modulesIntegrationEnabled,
  seedModuleWorld,
  type ModuleWorld,
} from "../../modules-integration-support";
import { createExpenses } from "./writers";
const run = modulesIntegrationEnabled ? describe : describe.skip;
const read = (file: string) =>
  readFileSync(
    new URL(
      `../../../../../../packages/db/drizzle/${file}.sql`,
      import.meta.url,
    ),
    "utf8",
  );
const migration = read("0096_expenses_paid_register");
const rollback = new Error("rollback isolated migration replay");
async function execute(tx: DbTransaction, source: string) {
  for (const statement of source.split("--> statement-breakpoint"))
    if (statement.trim()) await tx.execute(sql.raw(statement));
}
async function beforeG(tx: DbTransaction) {
  await tx.execute(
    sql`drop table expenses.expense_revision; drop table expenses.expense; drop table expenses.concept; drop function expenses.revision_immutable(); drop schema expenses; alter table core.module_event drop constraint module_event_sale_location_check; alter table core.module_event alter column location_id set not null`,
  );
  for (const name of ["0086_rentabilidad_y_personas", "0087_meses_finitos"])
    for (const statement of read(name).split("--> statement-breakpoint"))
      if (statement.includes('"profitability"'))
        await tx.execute(sql.raw(statement));
}
const coreEvidence = sql`select
 (select md5(coalesce(string_agg(t::text,'|' order by t.id),'')) from core.commission_revision t) as revisions,
 (select md5(coalesce(string_agg(t::text,'|' order by t.id),'')) from core.payment_commission t) as payments,
 (select md5(coalesce(string_agg(t::text,'|' order by t.source_order_id),'')) from core.sale_commission t) as sales,
 (select md5(coalesce(string_agg(t::text,'|' order by t.subscriber_id,t.event_type),'')) from core.historical_event_handler t) as handlers,
 (select md5(coalesce(string_agg(t::text,'|' order by t.id),'')) from core.staff_person t) as people,
 to_regprocedure('core.p1_immutable()')::oid::text as immutable_function`;
run(
  "0236 isolated migration and event-write atomicity",
  { timeout: 120000 },
  () => {
    let world: ModuleWorld;
    beforeAll(async () => {
      world = await seedModuleWorld("expenses-migration");
      await enableModules(world, ["expenses"]);
      await getDb()
        .insert(staffPersons)
        .values({ businessId: world.businessId, name: "Persona sin acceso" });
    });
    afterAll(async () => dropModuleWorld(world));
    it("new journal matches CI and empty retirement preserves core commissions, staff and historical dispatch", async () => {
      const journal = JSON.parse(
        readFileSync(
          new URL(
            "../../../../../../packages/db/drizzle/meta/_journal.json",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const entry = journal.entries.find((e: { idx: number }) => e.idx === 96);
      expect(
        (
          await getDb().execute(
            sql`select hash from drizzle.__drizzle_migrations where created_at=${entry.when}`,
          )
        ).rows[0]?.hash,
      ).toBe(createHash("sha256").update(migration).digest("hex"));
      const before = (await getDb().execute(coreEvidence)).rows;
      await expect(
        withDbTransaction(async (tx) => {
          await beforeG(tx);
          await execute(tx, migration);
          expect(
            (
              await tx.execute(
                sql`select to_regclass('profitability.fixed_cost') as old, to_regclass('expenses.expense')::text as expense`,
              )
            ).rows,
          ).toEqual([{ old: null, expense: "expenses.expense" }]);
          expect((await tx.execute(coreEvidence)).rows).toEqual(before);
          expect(
            (
              await tx.execute(
                sql`select subscriber_id,handler_key from core.historical_event_handler where subscriber_id='profitability' and event_type='sale.closed'`,
              )
            ).rows,
          ).toEqual([
            {
              subscriber_id: "profitability",
              handler_key: "commission_snapshot",
            },
          ]);
          throw rollback;
        }),
      ).rejects.toBe(rollback);
      expect((await getDb().execute(coreEvidence)).rows).toEqual(before);
    });
    it.each(["data", "enabled", "permission", "dependency"])(
      "rejects unexpected %s without losing old data or other objects",
      async (reason) => {
        await expect(
          withDbTransaction(async (tx) => {
            await beforeG(tx);
            if (reason === "data")
              await tx.execute(
                sql`insert into profitability.fixed_cost(business_id,kind) values (${world.businessId}::uuid,'rent')`,
              );
            if (reason === "enabled")
              await tx.execute(
                sql`insert into core.business_module(business_id,module_id,enabled) values (${world.businessId}::uuid,'profitability',true)`,
              );
            if (reason === "permission")
              await tx.execute(
                sql`update core.business_membership set permissions=array['profitability'],role='staff',handle='migration-probe',pin_hash='test' where business_id=${world.businessId}::uuid and user_id=${world.ownerId}`,
              );
            if (reason === "dependency")
              await tx.execute(
                sql`create view core.expense_retirement_dependency_probe as select id from profitability.fixed_cost`,
              );
            await tx.execute(sql`savepoint attempted_g`);
            let error: unknown;
            try {
              await execute(tx, migration);
            } catch (value) {
              error = value;
            }
            expect(error).toBeDefined();
            await tx.execute(sql`rollback to savepoint attempted_g`);
            expect(
              (
                await tx.execute(
                  sql`select to_regclass('profitability.fixed_cost')::text as old,to_regclass('expenses.expense') as expense`,
                )
              ).rows,
            ).toEqual([{ old: "profitability.fixed_cost", expense: null }]);
            if (reason === "data")
              expect(
                (
                  await tx.execute(
                    sql`select count(*)::int as n from profitability.fixed_cost where business_id=${world.businessId}::uuid`,
                  )
                ).rows,
              ).toEqual([{ n: 1 }]);
            throw rollback;
          }),
        ).rejects.toBe(rollback);
      },
    );
    it("real event insert failure rolls back every payment, concept and revision in a multi-line batch", async () => {
      const count = async () =>
        Promise.all([
          getDb()
            .select()
            .from(expenses)
            .where(eq(expenses.businessId, world.businessId)),
          getDb()
            .select()
            .from(expenseConcepts)
            .where(eq(expenseConcepts.businessId, world.businessId)),
          getDb()
            .select()
            .from(expenseRevisions)
            .where(eq(expenseRevisions.businessId, world.businessId)),
          getDb()
            .select()
            .from(moduleEvents)
            .where(eq(moduleEvents.businessId, world.businessId)),
        ]);
      const before = await count();
      await withDbTransaction(async (tx) => {
        await tx.execute(
          sql.raw(
            `create function core.expense_event_failure_probe() returns trigger language plpgsql as $$ begin if NEW.business_id='${world.businessId}'::uuid and NEW.event_type like 'expense.%' and NEW.payload->>'name'='Second' then raise exception 'event failure probe'; end if; return NEW; end $$`,
          ),
        );
        await tx.execute(
          sql`create trigger expense_event_failure_probe before insert on core.module_event for each row execute function core.expense_event_failure_probe()`,
        );
      });
      const operationId = randomUUID();
      const body = {
        operationId,
        expectedCurrencyCode: "USD",
        lines: ["First", "Second"].map((name) => ({
          paidOn: "2020-01-01",
          amountMinor: "100",
          category: "other",
          conceptId: null,
          conceptName: name,
          name,
          isFixed: false,
          locationId: null,
        })),
      };
      try {
        await expect(
          createExpenses(world.businessId, world.ownerId, body),
        ).rejects.toBeDefined();
        expect(await count()).toEqual(before);
      } finally {
        await withDbTransaction(async (tx) => {
          await tx.execute(
            sql`drop trigger expense_event_failure_probe on core.module_event`,
          );
          await tx.execute(
            sql`drop function core.expense_event_failure_probe()`,
          );
        });
      }
      expect(
        (await createExpenses(world.businessId, world.ownerId, body)).expenses,
      ).toHaveLength(2);
    });
  },
);
