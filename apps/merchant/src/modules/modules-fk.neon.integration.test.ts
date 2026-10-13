import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { type DbTransaction, withDbTransaction } from "@mi-pasaporte/db";
import { modulesIntegrationEnabled } from "./modules-integration-support";
import { MODULES } from "./registry";

/**
 * Spec 0216 / ADR 0139 §7 regla 4 — NINGUNA FK DE UNA TABLA DEL CORE APUNTA A UN ESQUEMA DE MODULO.
 * Al reves (modulo → core, modulo → modulo del que depende) es lo esperado. Se le pregunta al
 * catalogo de Postgres de la rama de pruebas (ya migrada por `tools/neon-test.sh`), no al esquema de
 * drizzle: una FK agregada a mano en una migracion tambien cuenta.
 *
 * Esquemas de modulo = los ids del registro (cada modulo usa `pgSchema("<id>")`, ADR 0138 §2).
 * Core = cualquier otro esquema que no sea del sistema.
 */

const SYSTEM = ["pg_catalog", "information_schema", "pg_toast"];

/** `array[$1, $2…]::text[]` (drizzle expande un arreglo JS como lista, no como arreglo). */
const textArray = (values: readonly string[]) =>
  sql`array[${sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  )}]::text[]`;

async function coreToModuleFks(db: DbTransaction): Promise<string[]> {
  const modules = MODULES.map((m) => m.id);
  const result = await db.execute<{ fk: string }>(sql`
    select src_ns.nspname || '.' || src.relname || ' → ' || dst_ns.nspname || '.' || dst.relname
           || ' (' || c.conname || ')' as fk
    from pg_constraint c
    join pg_class src on src.oid = c.conrelid
    join pg_namespace src_ns on src_ns.oid = src.relnamespace
    join pg_class dst on dst.oid = c.confrelid
    join pg_namespace dst_ns on dst_ns.oid = dst.relnamespace
    where c.contype = 'f'
      and dst_ns.nspname = any(${textArray(modules)})
      and src_ns.nspname <> all(${textArray(modules)})
      and src_ns.nspname <> all(${textArray(SYSTEM)})
    order by 1`);
  return result.rows.map((row) => row.fk);
}

/** Corre `body` en una transaccion que SIEMPRE se deshace: el control no deja nada en la rama. */
async function rolledBack<T>(body: (tx: DbTransaction) => Promise<T>) {
  const ROLLBACK = new Error("rollback");
  let value: T | undefined;
  await withDbTransaction(async (tx) => {
    value = await body(tx);
    throw ROLLBACK;
  }).catch((error) => {
    if (error !== ROLLBACK) throw error;
  });
  return value as T;
}

describe.skipIf(!modulesIntegrationEnabled)(
  "regla 4: ninguna FK del core apunta a un modulo (ADR 0139 §7)",
  () => {
    it("los esquemas de modulo existen y tienen tablas (piso: si no, la consulta no mira nada)", async () => {
      const result = await rolledBack((tx) =>
        tx.execute<{ schema: string; tables: number }>(sql`
          select n.nspname as schema, count(c.oid)::int as tables
          from pg_namespace n join pg_class c on c.relnamespace = n.oid and c.relkind = 'r'
          where n.nspname = any(${textArray(MODULES.map((m) => m.id))})
          group by 1 order by 1`),
      );
      expect(result.rows).toEqual([
        { schema: "recipes", tables: expect.any(Number) },
        { schema: "stock", tables: expect.any(Number) },
      ]);
    }, 120_000);

    it("CONTROL: una FK core → stock.item creada en la transaccion SI se ve", async () => {
      const found = await rolledBack(async (tx) => {
        await tx.execute(sql`create table core.fk_probe_0216 (
          item_id uuid references stock.item (id))`);
        return coreToModuleFks(tx);
      });
      expect(found).toContain(
        "core.fk_probe_0216 → stock.item (fk_probe_0216_item_id_fkey)",
      );
    }, 120_000);

    it("ninguna FK de un esquema del core apunta a un esquema de modulo", async () => {
      expect(await rolledBack(coreToModuleFks)).toEqual([]);
    }, 120_000);
  },
);
