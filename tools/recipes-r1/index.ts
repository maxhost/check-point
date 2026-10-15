/** Local-only operational cut. CI exercises the same implementation through tools/neon-test.sh. */
import { fileURLToPath } from "node:url";
import { createViteServer } from "vitest/node";
import { localDbUrlOrExit } from "../../packages/db/src/local.ts";
import { sql } from "drizzle-orm";
import { execFileSync } from "node:child_process";

const mode = process.argv[2];
if (mode !== "preflight" && mode !== "cutover") {
  console.log(
    "Uso: node --env-file=<config-local-seleccionada> tools/recipes-r1/index.ts preflight|cutover [--writers-drained]",
  );
  process.exit(mode === "--help" ? 0 : 1);
}
if (mode === "cutover" && !process.argv.includes("--writers-drained")) {
  console.error(
    "R1: confirma primero el retiro real de writers antiguos y usa --writers-drained.",
  );
  process.exit(1);
}
localDbUrlOrExit("recipes-r1");
const root = fileURLToPath(new URL("../../", import.meta.url));
const vite = await createViteServer({
  root,
  configFile: false,
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const { withDbTransaction } = await vite.ssrLoadModule(
    "/packages/db/src/client.ts",
  );
  const { preflightR1, cutoverR1 } = await vite.ssrLoadModule(
    "/apps/merchant/src/modules/recipes/server/model/migration.ts",
  );
  const result = await withDbTransaction(
    async (tx: { execute: (query: unknown) => Promise<unknown> }) => {
      await tx.execute(sql`set transaction isolation level repeatable read`);
      return mode === "preflight"
        ? preflightR1(tx)
        : cutoverR1(tx, { writersDrained: true });
    },
  );
  console.log(
    JSON.stringify({
      environment: "local",
      sourceSha: execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      }).trim(),
      workingTreeDirty:
        execFileSync("git", ["status", "--porcelain"], {
          cwd: root,
          encoding: "utf8",
        }).trim().length > 0,
      mode,
      ...result,
    }),
  );
} catch (error) {
  console.error("recipes-r1: fallo", {
    name: error instanceof Error ? error.name : typeof error,
  });
  process.exitCode = 1;
} finally {
  await vite.close();
}
