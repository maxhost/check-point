import { randomUUID } from "node:crypto";
import { type SQL, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
if (enabled) process.env.DATABASE_URL = url;

import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { pgErrorCode } from "@mi-pasaporte/domain/server/consumer/core";

/**
 * Spec 0118 / ADR 0110 — ORACULO NEGATIVO del rol del cliente: lo que la `0060` NO le da.
 * Cada sonda corre como dueño dentro de una transaccion, baja a `checkpass_consumer` con
 * `SET LOCAL ROLE` (el `GRANT … WITH SET TRUE` de la 0060) y se deshace siempre. Se lee el
 * CODIGO del error: tiene que ser `42501` (permiso), no un `23502`/`23503` de un INSERT que
 * paso el permiso y murio despues en una restriccion — ese seria el GRANT de mas.
 * ORACULO DE M2 (un INSERT de mas en `order`), M4 (el bypass que vuelve) y M5 (tablas nuevas).
 */

const ALLOWED = "la sentencia NO fue denegada";

/** El codigo con el que muere `statement` corrido COMO el rol (o ALLOWED si no muere). */
async function asRole(statement: SQL, setup?: SQL): Promise<string | null> {
  try {
    await withDbTransaction(async (tx) => {
      if (setup) await tx.execute(setup);
      await tx.execute(sql`set local role checkpass_consumer`);
      await tx.execute(statement);
      throw new Error(ALLOWED);
    });
  } catch (error) {
    if (error instanceof Error && error.message === ALLOWED) return ALLOWED;
    return pgErrorCode(error) ?? String(error);
  }
  return ALLOWED;
}

const denied: [string, SQL][] = [
  ['INSERT en core."order"', sql`insert into core."order" default values`],
  [
    "INSERT en core.reward_redemption",
    sql`insert into core.reward_redemption default values`,
  ],
  ["INSERT en core.business", sql`insert into core.business default values`],
  ["INSERT en core.product", sql`insert into core.product default values`],
  [
    "INSERT en core.loyalty_program",
    sql`insert into core.loyalty_program default values`,
  ],
  ["INSERT en core.campaign", sql`insert into core.campaign default values`],
  [
    "UPDATE de core.business",
    sql`update core.business set name = name where false`,
  ],
  [
    "UPDATE de core.campaign fuera de updated_at",
    sql`update core.campaign set status = status where false`,
  ],
  [
    "UPDATE de core.campaign_push fuera de clicked_at",
    sql`update core.campaign_push set sent_at = sent_at where false`,
  ],
  [
    "DELETE en consumer.consumer_account",
    sql`delete from consumer.consumer_account where false`,
  ],
  [
    "DELETE en consumer.program_membership",
    sql`delete from consumer.program_membership where false`,
  ],
  // Spec 0119: una identidad nunca se reescribe ni se borra desde el cliente.
  [
    "UPDATE de consumer.consumer_identity",
    sql`update consumer.consumer_identity set email = email where false`,
  ],
  [
    "DELETE en consumer.consumer_identity",
    sql`delete from consumer.consumer_identity where false`,
  ],
  [
    'SELECT en merchant_auth."user"',
    sql`select 1 from merchant_auth."user" limit 1`,
  ],
  [
    "SELECT en drizzle.__drizzle_migrations",
    sql`select 1 from drizzle.__drizzle_migrations limit 1`,
  ],
];

describe.skipIf(!enabled)("rol del cliente — lo que NO puede (42501)", () => {
  it.each(denied)("%s → 42501", async (_name, statement) => {
    expect(await asRole(statement)).toBe("42501");
  });

  it("no tiene BYPASSRLS", async () => {
    const result = await getDb().execute(
      sql`select rolbypassrls from pg_roles where rolname = 'checkpass_consumer'`,
    );
    expect(result.rows).toEqual([{ rolbypassrls: false }]);
  });

  it("una tabla NUEVA de core nace cerrada para el rol (default privileges)", async () => {
    const table = sql.raw(`core.probe_0118_${randomUUID().replace(/-/g, "")}`);
    expect(
      await asRole(
        sql`select 1 from ${table}`,
        sql`create table ${table} (id int)`,
      ),
    ).toBe("42501");
  });

  it("y una de consumer tambien", async () => {
    const table = sql.raw(
      `consumer.probe_0118_${randomUUID().replace(/-/g, "")}`,
    );
    expect(
      await asRole(
        sql`select 1 from ${table}`,
        sql`create table ${table} (id int)`,
      ),
    ).toBe("42501");
  });

  it("control: lo concedido SI pasa (la sonda no deniega todo)", async () => {
    expect(
      await asRole(sql`select 1 from consumer.consumer_account limit 1`),
    ).toBe(ALLOWED);
    expect(
      await asRole(sql`select 1 from consumer.consumer_identity limit 1`),
    ).toBe(ALLOWED);
    expect(
      await asRole(
        sql`update core.campaign set updated_at = updated_at where false`,
      ),
    ).toBe(ALLOWED);
  });
});
