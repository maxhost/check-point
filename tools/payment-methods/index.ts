/** Local-only rollout inventory. Migrations run through the protected migrator separately. */
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createViteServer } from "vitest/node";
import { sql } from "drizzle-orm";
import { localDbUrlOrExit } from "../../packages/db/src/local.ts";
if (process.argv[2] !== "preflight") {
  console.log(
    "Uso: node --env-file=<config-local-seleccionada> tools/payment-methods/index.ts preflight",
  );
  process.exit(process.argv[2] === "--help" ? 0 : 1);
}
localDbUrlOrExit("payment-methods");
const root = fileURLToPath(new URL("../../", import.meta.url)),
  vite = await createViteServer({
    root,
    configFile: false,
    server: { middlewareMode: true },
    appType: "custom",
  });
try {
  const { withDbTransaction } = await vite.ssrLoadModule(
    "/packages/db/src/client.ts",
  );
  const { preflightPaymentMethods } = await vite.ssrLoadModule(
    "/tools/payment-methods/preflight.ts",
  );
  const report = await withDbTransaction(
    async (tx: { execute: (query: unknown) => Promise<unknown> }) => {
      await tx.execute(
        sql`set transaction isolation level repeatable read read only`,
      );
      return preflightPaymentMethods(tx);
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
      report,
    }),
  );
} catch (error) {
  console.error("payment-methods: fallo", {
    name: error instanceof Error ? error.name : typeof error,
  });
  process.exitCode = 1;
} finally {
  await vite.close();
}
