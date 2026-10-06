"use client";

import {
  Label,
  Slider as AriaSlider,
  SliderThumb,
  SliderTrack,
} from "react-aria-components";
import { cx } from "./cx";
import { fieldLabel } from "./field-classes";

export type SliderProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  minValue: number;
  maxValue: number;
  step?: number;
  isDisabled?: boolean;
  tourAnchor?: string;
  className?: string;
};

/** Spec 0161. El ancho del tramo lleno es `style` dinamica permitida (ADR 0123 §2). */
export function Slider({
  label,
  tourAnchor,
  className,
  ...props
}: SliderProps) {
  return (
    <AriaSlider
      {...props}
      data-tour={tourAnchor}
      className={cx("grid gap-1.5", className)}
    >
      <Label className={fieldLabel}>{label}</Label>
      <SliderTrack className="relative h-11 w-full">
        {({ state, isDisabled }) => (
          <>
            <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-disabled">
              <div
                className={cx(
                  "h-full rounded-full",
                  isDisabled ? "bg-border-strong" : "bg-primary",
                )}
                style={{ width: `${state.getThumbPercent(0) * 100}%` }}
              />
            </div>
            <SliderThumb
              className={({ isFocusVisible, isDragging }) =>
                cx(
                  "top-1/2 size-6 rounded-full border-2 border-primary bg-surface shadow-sm outline-none",
                  isDragging && "bg-primary-soft",
                  isFocusVisible && "outline-2 outline-offset-2 outline-focus",
                  isDisabled && "border-border-strong",
                )
              }
            />
          </>
        )}
      </SliderTrack>
    </AriaSlider>
  );
}
