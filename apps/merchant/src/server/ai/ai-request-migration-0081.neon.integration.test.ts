import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  importIntegrationEnabled as enabled,
  limpiarNegocio,
  seedNegocio,
  type SeedImport,
} from "../catalog-import-integration-support";
import { type DbTransaction, getDb, withDbTransaction } from "@mi-pasaporte/db";

/**
 * Spec 0224 §8 — LA MIGRACION 0081 SOBRE UNA BASE CON DATOS (patron de `pos-migration-0079`). La rama
 * de pruebas ya esta migrada, asi que el caso RECONSTRUYE el estado de antes DENTRO de una
 * transaccion que siempre se deshace: `stock.draft_request` (0076 + 0077) y las NUEVE columnas de
 * `core.catalog_import`; siembra dictados y imports; corre el `.sql` REAL sentencia por sentencia y
 * mide la copia y el borrado.
 *
 * EXCEPCION DECLARADA (spec 0224 §Plan): es la unica suite del core que nombra las tablas y tareas de
 * modulo viejas — tiene que reconstruirlas.
 */
const MIGRATION = join(
  import.meta.dirname,
  "../../../../../packages/db/drizzle/0081_ai_request_copia_y_borrado.sql",
);
const NUEVE = [
  "provider",
  "model",
  "prompt_version",
  "schema_version",
  "provider_request_id",
  "input_tokens",
  "output_tokens",
  "duration_ms",
  "draft_version",
];

let a: SeedImport;

beforeAll(async () => {
  a = await seedNegocio("Migracion 0081");
}, 60_000);

afterAll(async () => {
  if (a) await limpiarNegocio(a);
}, 60_000);

const statements = () =>
  readFileSync(MIGRATION, "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

/** El estado de antes: lo que PROD tiene hoy (0076 + 0077 y las columnas de uso del menu). */
async function reconstruir(tx: DbTransaction): Promise<void> {
  await tx.execute(sql`create table stock.draft_request (
    id uuid primary key default gen_random_uuid() not null,
    business_id uuid not null references core.business(id) on delete cascade,
    created_by_user_id text, provider text not null, model text, status text not null,
    line_count integer default 0 not null, input_chars integer not null, input_tokens integer,
    output_tokens integer, created_at timestamp with time zone default now() not null,
    kind text default 'stock_entry' not null,
    constraint stock_draft_request_status_check check (status in ('ok', 'failed')),
    constraint stock_draft_request_kind_check check (kind in ('stock_entry', 'recipe')))`);
  await tx.execute(sql`alter table core.catalog_import
    add column provider text, add column model text, add column prompt_version text,
    add column schema_version text, add column provider_request_id text,
    add column input_tokens integer, add column output_tokens integer,
    add column duration_ms integer, add column draft_version integer default 0 not null`);
}

/** `[kind, provider, status, line_count, input_tokens, output_tokens]`. */
type Dictado = [string, string, string, number, number | null, number | null];

async function sembrar(tx: DbTransaction) {
  // prettier-ignore
  const dictados: Dictado[] = [
    ["stock_entry", "openai", "ok", 2, 10, 5],
    ["stock_entry", "openai", "failed", 0, null, null],
    ["stock_entry", "unconfigured", "failed", 0, null, null],
    ["recipe", "openai", "ok", 1, 7, 3],
    // Un token NEGATIVO (el lector viejo del dictado los aceptaba): se copia como null.
    ["stock_entry", "openai", "ok", 1, -1, 4],
  ];
  for (const [kind, provider, status, lines, tin, tout] of dictados) {
    await tx.execute(sql`insert into stock.draft_request
      (business_id, created_by_user_id, provider, model, status, line_count, input_chars,
       input_tokens, output_tokens, kind)
      values (${a.businessId}, ${a.userId}, ${provider}, 'gpt-6-luna', ${status}, ${lines},
       30, ${tin}, ${tout}, ${kind})`);
  }
  const ids = {
    aceptado: randomUUID(),
    fallado: randomUUID(),
    analizando: randomUUID(),
    sinProveedor: randomUUID(),
    yaRegistrado: randomUUID(),
  };
  const imp = (
    id: string,
    status: string,
    kind: string,
    files: number,
    extra: {
      provider: string | null;
      draft?: boolean;
      tin?: number | null;
      failure?: string | null;
    },
  ) => sql`insert into core.catalog_import
      (id, business_id, created_by_user_id, status, source_kind, file_count, draft, provider,
       model, schema_version, provider_request_id, input_tokens, output_tokens, duration_ms,
       failure_code, expires_at)
      values (${id}, ${a.businessId}, ${a.userId}, ${status}, ${kind}, ${files},
       ${extra.draft ? sql`'{"categories":[]}'::jsonb` : sql`null`}, ${extra.provider},
       ${extra.provider ? "gpt-5-mini" : null}, ${extra.provider ? "v2" : null},
       ${extra.provider ? "resp_x" : null}, ${extra.tin ?? null}, ${extra.tin == null ? null : 50},
       ${extra.tin == null ? null : 900}, ${extra.failure ?? null}, now() + interval '1 day')`;
  // prettier-ignore
  for (const statement of [
    imp(ids.aceptado, "accepted", "images", 2, { provider: "openai", draft: true, tin: 100 }),
    imp(ids.fallado, "failed", "images", 1, { provider: "openai", tin: 20, failure: "provider_unavailable" }),
    imp(ids.analizando, "analyzing", "pdf", 1, { provider: "openai" }),
    imp(ids.sinProveedor, "failed", "images", 1, { provider: null, failure: "catalog_page_limit" }),
    imp(ids.yaRegistrado, "accepted", "images", 1, { provider: "openai", draft: true, tin: 999 }),
  ])
    await tx.execute(statement);
  // El codigo NUEVO ya registro este submit en la ventana entre el deploy y la 0081.
  await tx.execute(sql`insert into core.ai_request
    (business_id, task, task_version, mode, provider, status, input_tokens, subject_id, finished_at)
    values (${a.businessId}, 'catalog.menu_extraction', 'v2', 'background', 'openai', 'ok', 1,
     ${ids.yaRegistrado}, now())`);
  return ids;
}

const filas = (tx: DbTransaction) =>
  tx.execute<{
    task: string;
    task_version: string;
    status: string;
    failure_code: string | null;
    input_tokens: number | null;
    output_tokens: number | null;
    output_items: number | null;
    input_images: number;
    input_files: number;
    subject_id: string | null;
    finished: boolean;
  }>(sql`select task, task_version, status, failure_code, input_tokens, output_tokens,
      output_items, input_images, input_files, subject_id::text as subject_id,
      finished_at is not null as finished
    from core.ai_request where business_id = ${a.businessId} order by task, created_at, id`);

describe.skipIf(!enabled)("migracion 0081 (spec 0224 §8)", () => {
  it("copia el dictado y el menu a `core.ai_request` y borra lo viejo", async () => {
    const ROLLBACK = new Error("rollback");
    const seen: Record<string, unknown> = {};
    await withDbTransaction(async (tx) => {
      await reconstruir(tx);
      const ids = await sembrar(tx);
      for (const statement of statements())
        await tx.execute(sql.raw(statement));
      const rows = (await filas(tx)).rows;
      seen.ids = ids;
      seen.rows = rows;
      seen.tabla = (
        await tx.execute<{
          n: number;
        }>(sql`select count(*)::int as n from information_schema.tables
          where table_schema = 'stock' and table_name = 'draft_request'`)
      ).rows[0].n;
      seen.columnas = (
        await tx.execute<{
          c: string;
        }>(sql`select column_name as c from information_schema.columns
          where table_schema = 'core' and table_name = 'catalog_import'
          and column_name = any(${sql.raw(`array['${NUEVE.join("','")}']`)})`)
      ).rows;
      seen.fkCoreAModulo = (
        await tx.execute<{
          fk: string;
        }>(sql`select c.conname as fk from pg_constraint c
          join pg_class src on src.oid = c.conrelid join pg_namespace s on s.oid = src.relnamespace
          join pg_class dst on dst.oid = c.confrelid join pg_namespace d on d.oid = dst.relnamespace
          where c.contype = 'f' and s.nspname = 'core' and d.nspname not in ('core', 'merchant_auth', 'consumer', 'platform_auth', 'public')`)
      ).rows;
      throw ROLLBACK;
    }).catch((error) => {
      if (error !== ROLLBACK) throw error;
    });

    const ids = seen.ids as Record<string, string>;
    const rows = seen.rows as Awaited<ReturnType<typeof filas>>["rows"];
    const de = (task: string) => rows.filter((r) => r.task === task);
    const suma = (rs: typeof rows, k: "input_tokens" | "output_tokens") =>
      rs.reduce((s, r) => s + (r[k] ?? 0), 0);

    // Conteo por tarea.
    expect(de("stock.entry_text")).toHaveLength(4);
    expect(de("recipes.recipe_text")).toHaveLength(1);
    expect(de("catalog.menu_extraction")).toHaveLength(4);
    // El dictado: legacy, cerrado, fallidas con `legacy` (tambien las `unconfigured`), negativo → null.
    const dictado = [...de("stock.entry_text"), ...de("recipes.recipe_text")];
    expect(
      dictado.every((r) => r.task_version === "legacy" && r.finished),
    ).toBe(true);
    expect(
      dictado.filter((r) => r.status === "failed").map((r) => r.failure_code),
    ).toEqual(["legacy", "legacy"]);
    expect([
      suma(dictado, "input_tokens"),
      suma(dictado, "output_tokens"),
    ]).toEqual([17, 12]);
    expect(
      dictado.filter((r) => r.input_tokens === null && r.output_tokens === 4),
    ).toHaveLength(1);
    expect(de("recipes.recipe_text")[0]).toMatchObject({
      output_items: 1,
      status: "ok",
    });
    // El menu: una fila por submit aceptado, por estado derivado.
    const menu = (id: string) =>
      de("catalog.menu_extraction").filter((r) => r.subject_id === id);
    expect(menu(ids.aceptado)).toEqual([
      expect.objectContaining({
        status: "ok",
        failure_code: null,
        input_images: 2,
        input_tokens: 100,
        task_version: "v2",
        finished: true,
      }),
    ]);
    expect(menu(ids.fallado)).toEqual([
      expect.objectContaining({
        status: "failed",
        failure_code: "provider_unavailable",
        finished: true,
      }),
    ]);
    // En vuelo: `pending` con su id, para que el webhook o el reconciliador del codigo nuevo lo cierren.
    expect(menu(ids.analizando)).toEqual([
      expect.objectContaining({
        status: "pending",
        input_files: 1,
        input_images: 0,
        finished: false,
      }),
    ]);
    expect(menu(ids.sinProveedor)).toEqual([]);
    // El ya registrado no se duplica y conserva lo que escribio el codigo nuevo.
    expect(menu(ids.yaRegistrado)).toEqual([
      expect.objectContaining({ input_tokens: 1 }),
    ]);
    expect(suma(de("catalog.menu_extraction"), "input_tokens")).toBe(121);
    // Lo viejo no existe, y ninguna FK del core apunta fuera de los esquemas del core (a un modulo).
    expect(seen.tabla).toBe(0);
    expect(seen.columnas).toEqual([]);
    expect(seen.fkCoreAModulo).toEqual([]);
  }, 180_000);

  it("despues del rollback la rama sigue migrada: sin `stock.draft_request` ni las nueve columnas", async () => {
    const { rows } = await getDb().execute<{ n: number }>(sql`
      select count(*)::int as n from information_schema.columns
      where (table_schema = 'core' and table_name = 'catalog_import'
             and column_name = any(${sql.raw(`array['${NUEVE.join("','")}']`)}))
         or (table_schema = 'stock' and table_name = 'draft_request')`);
    expect(rows).toEqual([{ n: 0 }]);
  }, 60_000);
});
