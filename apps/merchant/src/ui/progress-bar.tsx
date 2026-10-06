"use client";

import { Label, ProgressBar as AriaProgressBar } from "react-aria-components";
import { cx } from "./cx";

export type ProgressBarProps = {
  label: string;
  value: number;
  maxValue?: number;
  /** Texto del valor («2 de 5»); por defecto, el porcentaje. */
  valueLabel?: string;
  className?: string;
};

/** Spec 0160. El ancho del relleno es la unica `style` dinamica permitida (ADR 0123 §2). */
export function ProgressBar({
  label,
  value,
  maxValue = 100,
  valueLabel,
  className,
}: ProgressBarProps) {
  return (
    <AriaProgressBar
      value={value}
      maxValue={maxValue}
      valueLabel={valueLabel}
      className={cx("grid gap-2", className)}
    >
      {({ percentage, valueText }) => (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <Label className="text-sm font-bold leading-5 text-content">
              {label}
            </Label>
            <span className="text-sm leading-5 text-content-muted">
              {valueText}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-disabled">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${percentage ?? 0}%` }}
            />
          </div>
        </>
      )}
    </AriaProgressBar>
  );
}
