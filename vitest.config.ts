import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "apps/consumer/vitest.config.ts",
      "apps/merchant/vitest.config.ts",
      "apps/platform/vitest.config.ts",
    ],
  },
});
