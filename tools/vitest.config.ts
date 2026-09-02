import { defineConfig } from "vitest/config";

// Project de tooling: tests que son del REPO, no de una app. Se suma a los 3 de
// apps/* en el vitest.config.ts de root para que corran con `pnpm test` — y por
// lo tanto tambien en el Stop hook, que es donde el drift se caza en el acto
// (spec 0049).
export default defineConfig({
  test: {
    name: "tools",
    include: ["**/*.test.ts"],
  },
});
