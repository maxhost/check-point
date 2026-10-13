import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type DbTransaction, getDb, withDbTransaction } from "@mi-pasaporte/db";
import { diningTables } from "@mi-pasaporte/db/schema";
import {
  type PosWorld,
  dropPosWorld,
  pos,
  posIntegrationEnabled,
  seedPosWorld,
  setModuleRow,
  setPosModule,
} from "./pos-integration-support";

/**
 * Spec 0220 §Datos / DoD — LA MIGRACION 0079 SOBRE UNA BASE CON DATOS, contra Neon. La rama de
 * pruebas ya esta migrada (`tools/neon-test.sh`), asi que el caso RECONSTRUYE el estado de antes
 * DENTRO de una transaccion que siempre se deshace (el DDL de Postgres es transaccional): devuelve
 * las cuatro tablas a `core`, repone `core.business.pos_enabled`, siembra un negocio con el POS
 * encendido (orden abierta con mesa, linea, ticket) y otro con el POS apagado y mesas, corre el
 * `.sql` REAL de la 0079 sentencia por sentencia, y mide: filas iguales en `pos.*` (conteo y hash
 * por tabla), `pos` y `tables` encendidos SOLO para el primero, la orden sigue `open`,
 * `pos_enabled` no existe y ninguna FK del core apunta a `pos` (regla 4).
 *
 * Toma locks exclusivos sobre las tablas del POS mientras dura: correrla sola o de a dos suites.
 */

const MIGRATION = join(
  import.meta.dirname,
  "../../../../../../packages/db/drizzle/0079_pos_y_mesas_modulos.sql",
);
const TABLES = [
  "dining_table",
  "pos_order",
  "pos_order_item",
  "ticket_settings",
];

let on: PosWorld;
let off: PosWorld;
let openOrderId: string;

beforeAll(async () => {
  on = await seedPosWorld("Migracion encendido");
  off = await seedPosWorld("Migracion apagado");
  await setModuleRow(on.seed.business.id, "tables", true);
  const [table] = await getDb()
    .insert(diningTables)
    .values({
      businessId: on.seed.business.id,
      locationId: on.seed.locationId,
      name: "Mesa 0079",
    })
    .returning({ id: diningTables.id });
  const created = await pos.create(on.ownerCookie, {
    tableId: table.id,
    items: [{ productId: on.cafe, quantity: 2 }],
  });
  if (created.status !== 201) throw new Error(`orden: ${created.status}`);
  openOrderId = (await created.json()).id;
  const ticket = await pos.saveTicketSettings(on.ownerCookie, {
    printingEnabled: true,
    showBusinessName: false,
    showTable: true,
  });
  if (ticket.status !== 200) throw new Error(`ticket: ${ticket.status}`);
  await getDb()
    .insert(diningTables)
    .values(
      ["Mesa A", "Mesa B"].map((name) => ({
        businessId: off.seed.business.id,
        locationId: off.seed.locationId,
        name,
      })),
    );
  await setPosModule(off.seed.business.id, false);
}, 240_000);

afterAll(async () => {
  await dropPosWorld(on);
  await dropPosWorld(off);
}, 240_000);

type Snapshot = Record<string, { rows: number; hash: string }>;

/** Conteo y hash de las filas de los dos negocios, tabla por tabla, en el esquema `schema`. Los
 * ids son uuids que genero el seed (no entrada de usuario), por eso van en el texto. */
async function snapshot(tx: DbTransaction, schema: string): Promise<Snapshot> {
  const ids = `'${on.seed.business.id}', '${off.seed.business.id}'`;
  const out: Snapshot = {};
  for (const table of TABLES) {
    const owned =
      table === "pos_order_item"
        ? `pos_order_id in (select id from ${schema}.pos_order where business_id in (${ids}))`
        : `business_id in (${ids})`;
    const { rows } = await tx.execute<{ rows: number; hash: string }>(
      sql.raw(`select count(*)::int as rows,
        md5(coalesce(string_agg(t::text, '|' order by t::text), '')) as hash
        from ${schema}.${table} t where ${owned}`),
    );
    out[table] = rows[0];
  }
  return out;
}

const statements = () =>
  readFileSync(MIGRATION, "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

describe.skipIf(!posIntegrationEnabled)("migracion 0079 (spec 0220)", () => {
  it("muda las filas a `pos`, enciende pos y mesas solo donde estaba el POS, borra pos_enabled", async () => {
    const ROLLBACK = new Error("rollback");
    const seen: Record<string, unknown> = {};
    await withDbTransaction(async (tx) => {
      // EL ESTADO DE ANTES (la base de PROD hoy).
      for (const table of TABLES)
        await tx.execute(sql.raw(`alter table pos.${table} set schema core`));
      await tx.execute(
        sql`alter table core.business add column pos_enabled boolean not null default false`,
      );
      await tx.execute(
        sql`update core.business set pos_enabled = true where id = ${on.seed.business.id}`,
      );
      await tx.execute(sql`delete from core.business_module
        where business_id in (${on.seed.business.id}, ${off.seed.business.id})`);
      seen.before = await snapshot(tx, "core");

      for (const statement of statements())
        await tx.execute(sql.raw(statement));

      seen.after = await snapshot(tx, "pos");
      seen.modules = (
        await tx.execute<{
          business: string;
          module: string;
          enabled: boolean;
        }>(sql`
          select case when business_id = ${on.seed.business.id} then 'on' else 'off' end as business,
                 module_id as module, enabled
          from core.business_module
          where business_id in (${on.seed.business.id}, ${off.seed.business.id})
          order by 1, 2`)
      ).rows;
      seen.order = (
        await tx.execute<{ status: string; table: boolean }>(sql`
          select status, dining_table_id is not null as table
          from pos.pos_order where id = ${openOrderId}`)
      ).rows;
      seen.column = (
        await tx.execute<{ n: number }>(sql`
          select count(*)::int as n from information_schema.columns
          where table_schema = 'core' and table_name = 'business' and column_name = 'pos_enabled'`)
      ).rows[0].n;
      seen.coreLeft = (
        await tx.execute<{ n: number }>(sql`
          select count(*)::int as n from information_schema.tables
          where table_schema = 'core' and table_name = any(${sql.raw(
            `array['${TABLES.join("','")}']`,
          )})`)
      ).rows[0].n;
      seen.coreToPos = (
        await tx.execute<{ fk: string }>(sql`
          select c.conname as fk from pg_constraint c
          join pg_class src on src.oid = c.conrelid
          join pg_namespace s on s.oid = src.relnamespace
          join pg_class dst on dst.oid = c.confrelid
          join pg_namespace d on d.oid = dst.relnamespace
          where c.contype = 'f' and d.nspname = 'pos' and s.nspname = 'core'`)
      ).rows;
      throw ROLLBACK;
    }).catch((error) => {
      if (error !== ROLLBACK) throw error;
    });

    const before = seen.before as Snapshot;
    // Piso: el estado de antes tiene filas en las cuatro tablas (si no, el hash no mide nada).
    expect(before.dining_table.rows).toBe(3);
    expect(before.pos_order.rows).toBe(1);
    expect(before.pos_order_item.rows).toBe(1);
    expect(before.ticket_settings.rows).toBe(1);
    expect(seen.after).toEqual(before);
    expect(seen.modules).toEqual([
      { business: "on", module: "pos", enabled: true },
      { business: "on", module: "tables", enabled: true },
    ]);
    expect(seen.order).toEqual([{ status: "open", table: true }]);
    expect(seen.column).toBe(0);
    expect(seen.coreLeft).toBe(0);
    expect(seen.coreToPos).toEqual([]);
  }, 180_000);

  it("despues del rollback la rama sigue como estaba (las tablas en `pos`, sin `pos_enabled`)", async () => {
    const { rows } = await getDb().execute<{ schema: string; n: number }>(sql`
      select table_schema as schema, count(*)::int as n from information_schema.tables
      where table_name in ('dining_table', 'pos_order', 'pos_order_item', 'ticket_settings')
      group by 1`);
    expect(rows).toEqual([{ schema: "pos", n: 4 }]);
    const [order] = await getDb()
      .select({ id: diningTables.id })
      .from(diningTables)
      .where(eq(diningTables.businessId, off.seed.business.id));
    expect(order).toBeDefined();
  }, 60_000);
});
