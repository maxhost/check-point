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
    // El default de vitest son 10 s, y los teardowns de las suites `.neon.integration`
    // borran mundos enteros contra una rama Neon compartida. Medido al cerrar la spec
    // 0065 B2: `marketing-lifecycle` se paso de los 10 s en 2 de 3 corridas y marco el
    // ARCHIVO como failed **con sus tests en verde** («1 failed | 161 passed», «1169
    // passed» abajo) — un rojo que no viene de ninguna asercion y que se lee como un bug
    // del producto. Las suites que ya lo sufrieron pasan `120_000` a mano; esto es para
    // que la proxima no nazca con el mismo agujero. NO toca `testTimeout`: un test que
    // cuelga tiene que seguir muriendo rapido.
    hookTimeout: 120_000,
  },
});
