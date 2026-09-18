import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const tokenPath = fileURLToPath(
  new URL("../src/ui/tokens.css", import.meta.url),
);
const css = readFileSync(tokenPath, "utf8");

function block(selector) {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`No se encontró ${selector}`);
  const open = css.indexOf("{", start);
  let depth = 1;
  for (let index = open + 1; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}") depth -= 1;
    if (depth === 0) return css.slice(open + 1, index);
  }
  throw new Error(`Bloque incompleto: ${selector}`);
}

function variables(source) {
  return Object.fromEntries(
    [...source.matchAll(/--([\w-]+):\s*(#[\da-fA-F]{6})\s*;/g)].map(
      ([, name, value]) => [name, value],
    ),
  );
}

function luminance(value) {
  const channels = value
    .slice(1)
    .match(/.{2}/g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort(
    (left, right) => right - left,
  );
  return (values[0] + 0.05) / (values[1] + 0.05);
}

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
];

let failed = false;
for (const [mode, palette] of Object.entries({ light, dark })) {
  for (const [foregroundName, backgroundName, minimum] of checks) {
    const foreground = palette[foregroundName];
    const background = palette[backgroundName];
    const result = contrast(foreground, background);
    const passed = result >= minimum;
    failed ||= !passed;
    console.log(
      `${passed ? "PASS" : "FAIL"} ${mode} ${foregroundName}/${backgroundName}: ${result.toFixed(2)}:1 (mínimo ${minimum}:1)`,
    );
  }
}

if (failed) process.exitCode = 1;
