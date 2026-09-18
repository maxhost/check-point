import type { CSSProperties } from "react";
type Rgb = readonly [number, number, number];

export type BrandPalette = {
  primary: string;
  complement: string;
  accent: string;
};

const darkest: Rgb = [0, 0, 0];
const lightest: Rgb = [255, 255, 255];

export type BrandThemeProperties = CSSProperties &
  Partial<
    Record<
      | "--brand-primary"
      | "--brand-primary-action"
      | "--brand-primary-hover"
      | "--brand-primary-pressed"
      | "--brand-on-primary"
      | "--brand-complement"
      | "--brand-complement-action"
      | "--brand-on-complement"
      | "--brand-accent"
      | "--brand-accent-hover"
      | "--brand-accent-pressed"
      | "--brand-on-accent",
      string
    >
  >;

function parseHexColor(value: string): Rgb | null {
  const match = value.trim().match(/^#([\da-f]{6})$/i);
  if (!match) return null;

  return [
    Number.parseInt(match[1].slice(0, 2), 16),
    Number.parseInt(match[1].slice(2, 4), 16),
    Number.parseInt(match[1].slice(4, 6), 16),
  ];
}

function channelLuminance(channel: number) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: Rgb) {
  return (
    0.2126 * channelLuminance(color[0]) +
    0.7152 * channelLuminance(color[1]) +
    0.0722 * channelLuminance(color[2])
  );
}

export function contrastRatio(first: Rgb, second: Rgb) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function foregroundFor(background: Rgb) {
  return contrastRatio(background, darkest) >=
    contrastRatio(background, lightest)
    ? darkest
    : lightest;
}

function mix(first: Rgb, second: Rgb, secondWeight: number): Rgb {
  return first.map((channel, index) =>
    Math.round(channel * (1 - secondWeight) + second[index] * secondWeight),
  ) as unknown as Rgb;
}

function formatRgb(color: Rgb) {
  return `rgb(${color.join(" ")})`;
}

function accessibleScale(value: string) {
  const base = parseHexColor(value);
  if (!base) return null;

  const foreground = foregroundFor(base);
  const contrastDirection = foreground === lightest ? darkest : lightest;
  return {
    base: formatRgb(base),
    hover: formatRgb(mix(base, contrastDirection, 0.14)),
    pressed: formatRgb(mix(base, contrastDirection, 0.26)),
    foreground: formatRgb(foreground),
  };
}

/**
 * Produces runtime CSS variables from persisted merchant colors. Invalid
 * values are ignored so the validated defaults in tokens.css remain active.
 */
export function resolveBrandTheme(palette: BrandPalette): BrandThemeProperties {
  const primary = accessibleScale(palette.primary);
  const complement = accessibleScale(palette.complement);
  const accent = accessibleScale(palette.accent);
  const properties: BrandThemeProperties = {};

  if (primary) {
    properties["--brand-primary"] = primary.base;
    properties["--brand-primary-action"] = primary.base;
    properties["--brand-primary-hover"] = primary.hover;
    properties["--brand-primary-pressed"] = primary.pressed;
    properties["--brand-on-primary"] = primary.foreground;
  }

  if (complement) {
    properties["--brand-complement"] = complement.base;
    properties["--brand-complement-action"] = complement.base;
    properties["--brand-on-complement"] = complement.foreground;
  }

  if (accent) {
    properties["--brand-accent"] = accent.base;
    properties["--brand-accent-hover"] = accent.hover;
    properties["--brand-accent-pressed"] = accent.pressed;
    properties["--brand-on-accent"] = accent.foreground;
  }

  return properties;
}
