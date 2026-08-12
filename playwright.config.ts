import { defineConfig } from "@playwright/test";

const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  workers: isCi ? 1 : undefined,
  reporter: isCi ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
  },
  webServer: [
    {
      command: "pnpm --filter @mi-pasaporte/consumer dev",
      url: "http://127.0.0.1:3000/api/health",
      reuseExistingServer: !isCi,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @mi-pasaporte/merchant dev",
      url: "http://127.0.0.1:3001/api/health",
      reuseExistingServer: !isCi,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @mi-pasaporte/platform dev",
      url: "http://127.0.0.1:3002/api/health",
      reuseExistingServer: !isCi,
      timeout: 120_000,
    },
  ],
});
