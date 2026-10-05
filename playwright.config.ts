import { defineConfig } from "@playwright/test";
import {
  consumerURL,
  e2ePorts,
  merchantURL,
  platformURL,
} from "./tests/e2e/support/ports";

const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  workers: isCi ? 1 : undefined,
  reporter: isCi ? "github" : "list",
  use: {
    baseURL: consumerURL,
  },
  webServer: [
    {
      command: `pnpm --filter @mi-pasaporte/consumer exec next dev --port ${e2ePorts.consumer}`,
      url: `${consumerURL}/api/health`,
      reuseExistingServer: !isCi,
      timeout: 120_000,
    },
    {
      command: `pnpm --filter @mi-pasaporte/merchant exec next dev --port ${e2ePorts.merchant}`,
      url: `${merchantURL}/api/health`,
      reuseExistingServer: !isCi,
      timeout: 120_000,
    },
    {
      command: `pnpm --filter @mi-pasaporte/platform exec next dev --port ${e2ePorts.platform}`,
      url: `${platformURL}/api/health`,
      reuseExistingServer: !isCi,
      timeout: 120_000,
    },
  ],
});
