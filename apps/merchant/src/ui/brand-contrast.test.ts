import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  resolveBrandTheme,
  type BrandPalette,
} from "./brand-contrast";

type Rgb = readonly [number, number, number];

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");

function token(name: string) {
  const value = css.match(new RegExp(`--${name}:\\s*(#[\\da-f]{6})`, "i"))?.[1];
  if (!value) throw new Error(`Falta el token ${name}`);
  return value;
}

function rgb(value: string): Rgb {
  const channels = value.match(/\d+/g)?.map(Number);
  if (!channels || channels.length !== 3) {
    throw new Error(`Color runtime inválido: ${value}`);
  }
  return channels as unknown as Rgb;
}

const defaults: BrandPalette = {
  primary: token("brand-primary"),
  complement: token("brand-complement"),
  accent: token("brand-accent"),
};

describe("resolveBrandTheme", () => {
  it("mantiene AA en cada estado interactivo de la marca", () => {
    const properties = resolveBrandTheme(defaults);
    const pairs = [
      ["--brand-on-primary", "--brand-primary-action"],
      ["--brand-on-primary", "--brand-primary-hover"],
      ["--brand-on-primary", "--brand-primary-pressed"],
      ["--brand-on-complement", "--brand-complement-action"],
      ["--brand-on-accent", "--brand-accent"],
      ["--brand-on-accent", "--brand-accent-hover"],
      ["--brand-on-accent", "--brand-accent-pressed"],
    ] as const;

    for (const [foreground, background] of pairs) {
      expect(
        contrastRatio(
          rgb(properties[foreground]!),
          rgb(properties[background]!),
        ),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("ignora un color inválido y conserva el fallback de tokens", () => {
    const properties = resolveBrandTheme({
      ...defaults,
      primary: "invalid",
    });

    expect(properties["--brand-primary"]).toBeUndefined();
    expect(properties["--brand-complement"]).toBeDefined();
    expect(properties["--brand-accent"]).toBeDefined();
  });
});
