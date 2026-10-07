import { defineConfig } from "vitest/config";

// Project del paquete de la base (spec 0167): se suma a los de root para que `pnpm test` (y el
// Stop hook) corran sus tests; sin esto, un test en `packages/` no lo corre nadie.
export default defineConfig({
  test: {
    name: "db",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
