import { defineConfig } from "vitest/config";

export default defineConfig({
  // Igual que merchant: tsconfig.base.json dice `jsx: "preserve"` (lo compila Next), y sin
  // esto esbuild cae al transform clasico cuando un test importa un `.tsx`.
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
