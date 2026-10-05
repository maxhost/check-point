import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./brand-contrast";

// Spec 0158 (ADR 0123): contraste de los tokens, orden de capas de CSS y paleta cruda de
// Tailwind apagada, dentro de `pnpm test`.

const tokensPath = fileURLToPath(new URL("./tokens.css", import.meta.url));
const globalsPath = fileURLToPath(
  new URL("../app/globals.css", import.meta.url),
);
const onboardingPath = fileURLToPath(
  new URL(
    "../app/[locale]/(merchant)/business/onboarding/onboarding.css",
    import.meta.url,
  ),
);
const tokens = readFileSync(tokensPath, "utf8");

// postcss no es dependencia directa del merchant: se resuelve desde @tailwindcss/postcss.
const merchantRequire = createRequire(import.meta.url);
const tailwindPath = merchantRequire.resolve("@tailwindcss/postcss");
const tailwind = merchantRequire(tailwindPath);
// Sin los tipos de postcss (no resuelven desde el merchant): lo minimo que el test lee.
type CssNode = {
  type: string;
  name?: string;
  params?: string;
  selector?: string;
  prop?: string;
  nodes?: CssNode[];
  toString(): string;
};
type Postcss = {
  (plugins: unknown[]): {
    process(css: string, options: { from: string }): Promise<{ css: string }>;
  };
  parse(css: string): { nodes: CssNode[] };
};
const postcss = createRequire(tailwindPath)("postcss") as Postcss;

function block(selector: string) {
  const start = tokens.indexOf(selector);
  if (start < 0) throw new Error(`No se encontró ${selector}`);
  const open = tokens.indexOf("{", start);
  let depth = 1;
  for (let index = open + 1; index < tokens.length; index += 1) {
    if (tokens[index] === "{") depth += 1;
    if (tokens[index] === "}") depth -= 1;
    if (depth === 0) return tokens.slice(open + 1, index);
  }
  throw new Error(`Bloque incompleto: ${selector}`);
}

function variables(source: string): Record<string, string> {
  return Object.fromEntries(
    [...source.matchAll(/--([\w-]+):\s*(#[\da-fA-F]{6})\s*;/g)].map(
      ([, name, value]) => [name, value],
    ),
  );
}

const rgb = (hex: string) =>
  [1, 3, 5].map((start) =>
    Number.parseInt(hex.slice(start, start + 2), 16),
  ) as [number, number, number];

const light = variables(block(":root {"));
const dark = { ...light, ...variables(block(':root[data-theme="dark"]')) };
const checks = [
  ["ui-text", "ui-canvas", 4.5],
  ["ui-text", "ui-surface", 4.5],
  ["ui-text-muted", "ui-canvas", 4.5],
  ["ui-text", "brand-primary-soft", 4.5],
  ["ui-text", "ui-info-soft", 4.5],
  ["ui-text", "ui-success-soft", 4.5],
  ["ui-text", "ui-warning-soft", 4.5],
  ["ui-text", "ui-danger-soft", 4.5],
  ["ui-on-disabled", "ui-disabled", 4.5],
  ["brand-on-primary", "brand-primary-action", 4.5],
  ["brand-on-primary", "brand-primary-hover", 4.5],
  ["brand-on-primary", "brand-primary-pressed", 4.5],
  ["brand-on-complement", "brand-complement-action", 4.5],
  ["brand-on-accent", "brand-accent", 4.5],
  ["ui-on-danger", "ui-danger", 4.5],
  ["ui-danger", "ui-danger-soft", 4.5],
  ["ui-warning", "ui-warning-soft", 4.5],
  ["ui-focus", "ui-surface", 3],
  ["ui-border-strong", "ui-surface", 3],
] as const;

async function compile(source: string, from: string) {
  const result = await postcss([tailwind()]).process(source, { from });
  return result.css;
}

describe("contraste de tokens", () => {
  for (const [mode, palette] of Object.entries({ light, dark }))
    it(`${mode}: 19 pares sobre el minimo`, () => {
      const failures = checks.flatMap(([fg, bg, minimum]) => {
        if (!palette[fg] || !palette[bg]) return [`${fg}/${bg}: falta token`];
        const ratio = contrastRatio(rgb(palette[fg]), rgb(palette[bg]));
        return ratio >= minimum
          ? []
          : [`${fg}/${bg}: ${ratio.toFixed(2)}:1 (minimo ${minimum}:1)`];
      });
      expect(failures).toEqual([]);
    });
});

describe("capas de CSS", () => {
  it("globals.css declara el orden y no deja reglas sin capa", async () => {
    const root = postcss.parse(
      await compile(readFileSync(globalsPath, "utf8"), globalsPath),
    );
    // El orden efectivo de capas es el de su primera aparicion. Tailwind antepone
    // `@layer properties;` (fallbacks de @property, sin reglas sobre elementos).
    const order: string[] = [];
    for (const node of root.nodes)
      if (node.type === "atrule" && node.name === "layer")
        for (const name of (node.params ?? "").split(",").map((n) => n.trim()))
          if (!order.includes(name)) order.push(name);
    expect(order).toEqual([
      "properties",
      "theme",
      "base",
      "legacy",
      "components",
      "utilities",
    ]);

    const isRoot = (selector = "") =>
      [":root", ':root[data-theme="dark"]'].includes(selector.trim());
    const declarationsOk = (rule: CssNode) =>
      (rule.nodes ?? []).every(
        (node) =>
          node.type === "comment" ||
          (node.type === "decl" &&
            (node.prop?.startsWith("--") || node.prop === "color-scheme")),
      );
    const unlayered = root.nodes.filter((node) => {
      if (node.type === "comment") return false;
      // @property y @keyframes no son reglas de estilo: no compiten en la cascada.
      if (
        node.type === "atrule" &&
        ["layer", "property", "keyframes"].includes(node.name ?? "")
      )
        return false;
      if (node.type === "rule")
        return !(isRoot(node.selector) && declarationsOk(node));
      if (node.type === "atrule" && node.name === "media")
        return !(node.nodes ?? []).every(
          (child) =>
            child.type === "rule" &&
            (child.selector ?? "")
              .split(",")
              .every((s) => s.trim().startsWith(":root")) &&
            declarationsOk(child),
        );
      return true;
    });
    expect(unlayered.map((node) => node.toString().slice(0, 80))).toEqual([]);
  });

  it("onboarding.css es un unico @layer legacy", () => {
    const root = postcss.parse(readFileSync(onboardingPath, "utf8"));
    const nodes = root.nodes.filter((node) => node.type !== "comment");
    expect(
      nodes.map((node) =>
        node.type === "atrule" ? `@${node.name} ${node.params}` : node.type,
      ),
    ).toEqual(["@layer legacy"]);
  });
});

describe("paleta", () => {
  it("solo compilan los roles: la paleta cruda de Tailwind no existe", async () => {
    const from = fileURLToPath(new URL("./palette-probe.css", import.meta.url));
    const css = await compile(
      '@import "tailwindcss" source(none);\n@import "./tokens.css";\n@source inline("bg-white bg-emerald-600 bg-surface text-content");\n',
      from,
    );
    expect(css).toContain(".bg-surface");
    expect(css).toContain(".text-content");
    expect(css).not.toContain(".bg-white");
    expect(css).not.toContain(".bg-emerald-600");
  });
});
