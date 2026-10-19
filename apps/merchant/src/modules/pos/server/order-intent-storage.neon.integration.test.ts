import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  diningTables,
  posOrders,
  users,
} from "@mi-pasaporte/db/schema";
import {
  dropPosWorld,
  seedLegacyOrder,
  capturePosScope,
  scopedPos,
  posIntegrationEnabled,
  seedPosWorld,
  seedProduct,
  type PosWorld,
} from "./pos-integration-support";

const migrationName = "0106_pos_order_intent";
const migration = readFileSync(
  new URL(
    `../../../../../../packages/db/drizzle/${migrationName}.sql`,
    import.meta.url,
  ),
  "utf8",
);
const journal = JSON.parse(
  readFileSync(
    new URL(
      "../../../../../../packages/db/drizzle/meta/_journal.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { entries: { tag: string; when: number }[] };
const cloneSchema = `order_intent_${randomUUID().replaceAll("-", "")}`;
const target = `"${cloneSchema}"."pos_order"`;
const source = '"pos"."pos_order"';
const worlds: PosWorld[] = [];
let tableId: string;
const execute = (statement: string) => getDb().execute(sql.raw(statement));
const newColumns = [
  "sale_type",
  "create_request_id",
  "create_request_fingerprint",
  "total_snapshot",
];

// Exclusive CI reservation includes isolated DDL and teardown; invoke neon-test.sh serially.
describe.skipIf(!posIntegrationEnabled)(
  "0242 CP2b order intent storage",
  () => {
    beforeAll(async () => {
      for (const suffix of ["A", "B"])
        worlds.push(await seedPosWorld(`Order intent ${suffix}`));
      const [table] = await getDb()
        .insert(diningTables)
        .values({
          businessId: worlds[0].seed.business.id,
          locationId: worlds[0].seed.locationId,
          name: "Sin mesa / delivery",
        })
        .returning();
      tableId = table.id;
    }, 180_000);

    afterAll(async () => {
      await execute(`DROP SCHEMA IF EXISTS "${cloneSchema}" CASCADE`);
      for (const world of worlds) {
        await dropPosWorld(world);
        await getDb().delete(users).where(eq(users.id, world.seed.userId));
        expect(
          await getDb()
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, world.seed.userId)),
        ).toEqual([]);
        expect(
          await getDb()
            .select({ id: businesses.id })
            .from(businesses)
            .where(eq(businesses.id, world.seed.business.id)),
        ).toEqual([]);
        expect(
          (
            await getDb().execute(
              sql`select id from merchant_auth.session where user_id = ${world.seed.userId}`,
            )
          ).rows,
        ).toEqual([]);
      }
      expect(
        (
          await getDb().execute(
            sql`select nspname from pg_namespace where nspname = ${cloneSchema}`,
          )
        ).rows,
      ).toEqual([]);
    }, 180_000);

    it("checks canonical applied hash, nullable types and retained schema barriers", async () => {
      const entry = journal.entries.find(
        (entry) => entry.tag === migrationName,
      )!;
      expect(entry).toBeDefined();
      expect(
        (
          await getDb().execute(
            sql`select hash from drizzle.__drizzle_migrations where created_at = ${entry.when}`,
          )
        ).rows,
      ).toEqual([
        { hash: createHash("sha256").update(migration).digest("hex") },
      ]);
      const columns = (
        await getDb().execute(
          sql`select column_name, data_type, is_nullable, column_default, numeric_precision, numeric_scale from information_schema.columns where table_schema = 'pos' and table_name = 'pos_order'`,
        )
      ).rows;
      for (const [column_name, data_type] of [
        ["sale_type", "text"],
        ["create_request_id", "uuid"],
        ["create_request_fingerprint", "text"],
        ["total_snapshot", "numeric"],
      ]) {
        expect(columns).toContainEqual(
          expect.objectContaining({
            column_name,
            data_type,
            is_nullable: "YES",
            column_default: null,
          }),
        );
      }
      expect(columns).toContainEqual(
        expect.objectContaining({
          column_name: "total_snapshot",
          numeric_precision: 30,
          numeric_scale: 2,
        }),
      );
      const constraints = (
        await getDb().execute(
          sql`select conname, contype from pg_constraint where conrelid = 'pos.pos_order'::regclass`,
        )
      ).rows;
      for (const conname of [
        "core_pos_order_status_check",
        "core_pos_order_version_check",
        "core_pos_order_note_check",
        "core_pos_order_table_label_check",
        "core_pos_order_open_check",
        "core_pos_order_order_closed_check",
        "pos_order_sale_type_check",
        "pos_order_sale_type_table_check",
        "pos_order_create_request_check",
      ]) {
        expect(constraints).toContainEqual({ conname, contype: "c" });
      }
      expect(constraints.filter((c) => c.contype === "f")).toHaveLength(7);
      const indexes = (
        await getDb().execute(
          sql`select indexname from pg_indexes where schemaname = 'pos' and tablename = 'pos_order'`,
        )
      ).rows;
      for (const indexname of [
        "pos_order_business_id_unique",
        "core_pos_order_order_unique",
        "core_pos_order_close_request_unique",
        "core_pos_order_open_table_unique",
        "core_pos_order_business_status_idx",
        "pos_order_create_request_unique",
      ])
        expect(indexes).toContainEqual({ indexname });
    });

    it("backfills only real table identity on complete old-definition rows, preserving history and old constraints", async () => {
      await execute(`CREATE SCHEMA "${cloneSchema}"`);
      await execute(`CREATE TABLE ${target} (LIKE ${source} INCLUDING ALL)`);
      await execute(
        `ALTER TABLE ${target} ${newColumns.map((c) => `DROP COLUMN "${c}" CASCADE`).join(", ")}`,
      );
      // LIKE omits FKs: recreate the actual unchanged foreign key definitions on the private clone.
      const fks = (
        await getDb().execute(
          sql`select conname, pg_get_constraintdef(oid) as definition from pg_constraint where conrelid = 'pos.pos_order'::regclass and contype = 'f'`,
        )
      ).rows;
      for (const fk of fks)
        await execute(
          `ALTER TABLE ${target} ADD CONSTRAINT "${fk.conname}" ${fk.definition}`,
        );
      const triggers = (
        await getDb().execute(
          sql`select pg_get_triggerdef(oid) as definition from pg_trigger where tgrelid = 'pos.pos_order'::regclass and not tgisinternal`,
        )
      ).rows;
      expect(triggers).toHaveLength(2);
      for (const trigger of triggers) {
        const definition = String(trigger.definition);
        expect(definition).toContain(" ON pos.pos_order ");
        await execute(
          definition.replace(" ON pos.pos_order ", ` ON ${target} `),
        );
      }
      const beforeConstraints = (
        await execute(
          `SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = '${cloneSchema}.pos_order'::regclass ORDER BY conname`,
        )
      ).rows;
      const beforeIndexes = (
        await getDb().execute(
          sql`select indexname, indexdef from pg_indexes where schemaname = ${cloneSchema} order by indexname`,
        )
      ).rows;
      for (const [index, status] of [
        "open",
        "closed",
        "voided",
        "closed",
      ].entries()) {
        const closed = status !== "open";
        await getDb().execute(
          sql`insert into ${sql.raw(target)} (id, business_id, location_id, table_label, dining_table_id, status, note, version, created_by_user_id, closed_by_user_id, closed_at, close_request_id, settlement, created_at, updated_at) values (${randomUUID()}::uuid, ${worlds[0].seed.business.id}::uuid, ${worlds[0].seed.locationId}::uuid, ${index === 0 ? "Delivery / sin mesa" : "Mesa 42"}, ${index === 0 ? tableId : null}::uuid, ${status}, 'Nota anterior', ${index + 7}, ${worlds[0].seed.userId}, ${closed ? worlds[0].seed.userId : null}, ${closed ? "2021-02-03T04:05:06.123456Z" : null}::timestamptz, ${closed ? randomUUID() : null}::uuid, ${index === 3 ? JSON.stringify({ gross: "17.03", frozen: ["0.00", null] }) : null}::jsonb, '2020-01-02T03:04:05.123456Z', '2021-02-03T04:05:06.654321Z')`,
        );
      }
      const before = (
        await execute(`SELECT to_jsonb(o) AS row FROM ${target} o ORDER BY id`)
      ).rows;
      const statements = migration
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);
      expect(statements).toHaveLength(9);
      for (const statement of statements) {
        expect(statement).toMatch(
          /^(ALTER TABLE "pos"\."pos_order" ADD (COLUMN|CONSTRAINT)|CREATE UNIQUE INDEX "pos_order_create_request_unique" ON "pos"\."pos_order"|UPDATE "pos"\."pos_order" SET "sale_type")/,
        );
        const isolated = statement.replaceAll(source, target);
        expect(isolated).not.toContain(source);
        await execute(isolated);
      }
      const after = (
        await execute(`SELECT to_jsonb(o) AS row FROM ${target} o ORDER BY id`)
      ).rows;
      expect(after).toEqual(
        before.map(({ row }) => ({
          row: {
            ...(row as object),
            sale_type: (row as { dining_table_id: string | null })
              .dining_table_id
              ? "table"
              : "legacy",
            create_request_id: null,
            create_request_fingerprint: null,
            total_snapshot: null,
          },
        })),
      );
      const afterConstraints = (
        await execute(
          `SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = '${cloneSchema}.pos_order'::regclass ORDER BY conname`,
        )
      ).rows;
      for (const constraint of beforeConstraints)
        expect(afterConstraints).toContainEqual(constraint);
      const afterIndexes = (
        await getDb().execute(
          sql`select indexname, indexdef from pg_indexes where schemaname = ${cloneSchema} order by indexname`,
        )
      ).rows;
      for (const index of beforeIndexes)
        expect(afterIndexes).toContainEqual(index);
    }, 120_000);

    it("keeps legacy inserts and unit detail/list reads compatible with null private projections", async () => {
      const world = worlds[0];
      const productId = await seedProduct(world, "Historical unit", "3.25");
      const scope = await capturePosScope(
        world.ownerCookie,
        world.seed.business.id,
      );
      const order = await seedLegacyOrder(
        world,
        [{ productId, quantity: 2 }],
        "Mesa pickup",
      );
      expect(order).toMatchObject({
        total: "6.50",
        items: [{ quantity: "2", unitPrice: "3.25" }],
      });
      expect(
        (await scopedPos(world.ownerCookie, scope).read(order.id)).status,
      ).toBe(200);
      const list = await scopedPos(world.ownerCookie, scope).list();
      expect(list.status).toBe(200);
      expect(JSON.stringify(await list.json())).toContain(order.id);
      const [stored] = await getDb()
        .select()
        .from(posOrders)
        .where(eq(posOrders.id, order.id));
      expect(stored).toMatchObject({
        saleType: null,
        createRequestId: null,
        createRequestFingerprint: null,
        totalSnapshot: null,
      });
    }, 60_000);

    it("enforces intent pair, canonical fingerprint, business uniqueness and sale types on actual migrated rows", async () => {
      const insert = (
        patch: Partial<typeof posOrders.$inferInsert> = {},
        world = worlds[0],
      ) =>
        getDb()
          .insert(posOrders)
          .values({
            businessId: world.seed.business.id,
            locationId: world.seed.locationId,
            tableLabel: "Mesa delivery",
            createdByUserId: world.seed.userId,
            ...patch,
          })
          .returning();
      for (const saleType of [
        null,
        "table",
        "legacy",
        "pickup",
        "delivery",
        "counter",
      ])
        await insert({ saleType });
      for (const saleType of ["pickup", "delivery", "counter"])
        await expect(
          insert({ saleType, diningTableId: tableId }),
        ).rejects.toMatchObject({ cause: { code: "23514" } });
      await expect(insert({ saleType: "unknown" })).rejects.toMatchObject({
        cause: { code: "23514" },
      });
      // Unknown old writers can still omit the type even with a real table during expand.
      await insert({ diningTableId: tableId });
      await insert({
        saleType: "table",
        diningTableId: tableId,
        status: "closed",
        closedByUserId: worlds[0].seed.userId,
        closedAt: new Date(),
        closeRequestId: randomUUID(),
      });
      await expect(
        insert({ locationId: worlds[1].seed.locationId }),
      ).rejects.toMatchObject({ cause: { code: "23503" } });
      const createRequestId = randomUUID();
      const fingerprint = createHash("sha256")
        .update("frozen creation intent")
        .digest("hex");
      const [original] = await insert({
        createRequestId,
        createRequestFingerprint: fingerprint,
      });
      await expect(
        insert({ createRequestId, createRequestFingerprint: fingerprint }),
      ).rejects.toMatchObject({ cause: { code: "23505" } });
      await insert(
        { createRequestId, createRequestFingerprint: fingerprint },
        worlds[1],
      );
      for (const patch of [
        { createRequestId: randomUUID() },
        { createRequestFingerprint: fingerprint },
        ...[
          "",
          "a".repeat(63),
          "a".repeat(65),
          "g".repeat(64),
          "A".repeat(64),
          `${"a".repeat(64)}\n`,
        ].map((createRequestFingerprint) => ({
          createRequestId: randomUUID(),
          createRequestFingerprint,
        })),
      ])
        await expect(insert(patch)).rejects.toMatchObject({
          cause: { code: "23514" },
        });
      await expect(
        insert({
          createRequestId: "not-a-uuid",
          createRequestFingerprint: fingerprint,
        }),
      ).rejects.toMatchObject({ cause: { code: "22P02" } });
      expect(
        await getDb()
          .select()
          .from(posOrders)
          .where(eq(posOrders.id, original.id)),
      ).toEqual([original]);
      const zero = (await insert({ totalSnapshot: "0" }))[0];
      const missing = (await insert())[0];
      const wide = (
        await insert({ totalSnapshot: "9999999999999999999999999999.99" })
      )[0];
      expect(zero.totalSnapshot).toBe("0.00");
      expect(missing.totalSnapshot).toBeNull();
      expect(wide.totalSnapshot).toBe("9999999999999999999999999999.99");
    }, 120_000);
  },
);
