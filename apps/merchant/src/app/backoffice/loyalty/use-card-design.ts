import { useState } from "react";

/** The business brand colors used as initial card design when creating a Sellos program. */
export type BrandDefaults = {
  primary: string;
  complementary: string;
  accent: string;
};

/** The card columns as they arrive from the program DTO (null on Puntos / pre-0027 Sellos). */
export type CardDesignSource = {
  cardBackgroundColor: string | null;
  cardBackgroundColor2: string | null;
  cardBackgroundGradientAngle: number | null;
  cardBorderColor: string | null;
};

/**
 * Draft state of the Sellos card design. New programs start from the brand colors
 * (gradient on); editing hydrates from the saved columns, falling back to brand when a
 * pre-0027 program has no design. `payload()` returns the exact `cardDesign` API shape.
 */
export function useCardDesign() {
  const [backgroundColor, setBackgroundColor] = useState("#176548");
  const [gradientEnabled, setGradientEnabled] = useState(true);
  const [backgroundColor2, setBackgroundColor2] = useState("#2D8B68");
  const [gradientAngle, setGradientAngle] = useState(180);
  const [borderColor, setBorderColor] = useState("#E78132");

  function applyDefaults(brand: BrandDefaults) {
    setBackgroundColor(brand.primary);
    setGradientEnabled(true);
    setBackgroundColor2(brand.complementary);
    setGradientAngle(180);
    setBorderColor(brand.accent);
  }

  function hydrate(source: CardDesignSource, brand: BrandDefaults) {
    if (!source.cardBackgroundColor) {
      applyDefaults(brand);
      return;
    }
    setBackgroundColor(source.cardBackgroundColor);
    const hasGradient = Boolean(source.cardBackgroundColor2);
    setGradientEnabled(hasGradient);
    setBackgroundColor2(source.cardBackgroundColor2 ?? brand.complementary);
    setGradientAngle(source.cardBackgroundGradientAngle ?? 180);
    setBorderColor(source.cardBorderColor ?? brand.accent);
  }

  /** API `cardDesign` shape, also directly usable as `CardPreview` colors. */
  function payload() {
    return {
      backgroundColor,
      backgroundColor2: gradientEnabled ? backgroundColor2 : null,
      gradientAngle: gradientEnabled ? gradientAngle : null,
      borderColor,
    };
  }

  return {
    backgroundColor,
    gradientEnabled,
    backgroundColor2,
    gradientAngle,
    borderColor,
    setBackgroundColor,
    setGradientEnabled,
    setBackgroundColor2,
    setGradientAngle,
    setBorderColor,
    applyDefaults,
    hydrate,
    payload,
  };
}

export type CardDesignVm = ReturnType<typeof useCardDesign>;
