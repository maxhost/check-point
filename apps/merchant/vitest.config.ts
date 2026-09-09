import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig.base.json says `jsx: "preserve"` (Next compiles it), which makes esbuild
  // fall back to the classic `React.createElement` transform when a test imports a
  // .tsx module — and blow up with "React is not defined". Tests import server
  // components (e.g. app/login/page.tsx) to assert the props they hand down.
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
