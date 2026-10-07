/**
 * `pnpm db:local:migrate` — aplica las migraciones de `packages/db/drizzle` a la base LOCAL
 * (spec 0167 §3). Mismo journal y misma `drizzle.__drizzle_migrations` que PROD.
 *
 * Por que no `drizzle-kit migrate`: sin `pg` instalado elige el driver de Neon, ignora el
 * `neonConfig` del proxy y sale con exit 1 sin mensaje (ADR 0126 §Medido). El migrador de
 * `drizzle-orm/neon-serverless` sobre el `Pool` del proxy si anda, y es todo-o-nada.
 *
 * Rechaza (exit 1, sin conectar) un host que no sea local: no puede migrar PROD por accidente.
 * PROD se sigue migrando con `pnpm db:migrate:prod` (drizzle-kit, runbook `docs/runbooks/migrar-prod.md`).
 */
import { fileURLToPath } from "node:url";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { localDbUrlOrExit, quietPool } from "./local.ts";

const url = localDbUrlOrExit("db:local:migrate");
const pool = quietPool(new Pool({ connectionString: url }));
try {
  await migrate(drizzle(pool), {
    migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
  });
  const { rows } = await pool.query<{ n: number }>(
    "select count(*)::int as n from drizzle.__drizzle_migrations",
  );
  console.log(
    `db:local:migrate: ok (${rows[0]?.n} migraciones aplicadas en total)`,
  );
} catch (error) {
  // Solo codigo y mensaje: el error del driver puede traer la config con la contraseña.
  const e = error as { code?: string; message?: string };
  console.error(`db:local:migrate: FALLO ${e.code ?? ""} ${e.message ?? ""}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
