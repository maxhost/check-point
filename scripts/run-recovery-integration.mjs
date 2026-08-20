import { spawnSync } from "node:child_process";

if (
  !process.env.NEON_INTEGRATION_DATABASE_URL ||
  process.env.NEON_INTEGRATION_ISOLATED !== "true"
) {
  console.error(
    "Recovery integration requires NEON_INTEGRATION_DATABASE_URL and NEON_INTEGRATION_ISOLATED=true.",
  );
  process.exit(1);
}
const result = spawnSync(
  "pnpm",
  [
    "exec",
    "vitest",
    "run",
    "apps/merchant/src/server/consumer-recovery.neon.integration.test.ts",
    "apps/merchant/src/server/consumer-recovery-failure.neon.integration.test.ts",
  ],
  {
    stdio: "inherit",
    env: process.env,
  },
);
process.exit(result.status ?? 1);
