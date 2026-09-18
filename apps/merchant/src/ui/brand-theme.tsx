import type { ReactNode } from "react";
import { resolveBrandTheme, type BrandPalette } from "./brand-contrast";

export type { BrandPalette } from "./brand-contrast";

/**
 * Injects a merchant's persisted palette without rebuilding Tailwind.
 * Semantic form and feedback colors intentionally remain product-owned.
 */
export function BrandTheme({
  palette,
  children,
}: {
  palette: BrandPalette;
  children: ReactNode;
}) {
  return <div style={resolveBrandTheme(palette)}>{children}</div>;
}
