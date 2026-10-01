import { defineConfig } from "vitest/config";

export default defineConfig({
  // Igual que merchant: tsconfig.base.json dice `jsx: "preserve"` (lo compila Next), y sin
  // esto esbuild cae al transform clasico cuando un test importa un `.tsx`.
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Como merchant: los teardowns de las suites `.neon.integration` (spec 0117 mudo una aca)
    // borran mundos contra una rama compartida y pasan los 10 s del default de vitest.
    hookTimeout: 120_000,
  },
});
