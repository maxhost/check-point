"use client";

import {
  Switch as AriaSwitch,
  type SwitchProps as AriaSwitchProps,
} from "react-aria-components";
import { cx } from "./cx";

type Base = Omit<AriaSwitchProps, "className" | "children"> & {
  tourAnchor?: string;
  className?: string;
};

/** Sin texto visible, `aria-label` es obligatorio. */
export type SwitchProps = Base &
  ({ children: string } | { children?: undefined; "aria-label": string });

/** Spec 0160: el dibujo de `template-row.tsx` (marketing) pasado al kit. */
export function Switch({
  tourAnchor,
  className,
  children,
  ...props
}: SwitchProps) {
  return (
    <AriaSwitch
      {...props}
      data-tour={tourAnchor}
      className={({ isFocusVisible, isDisabled }) =>
        cx(
          "inline-flex min-h-11 w-fit cursor-pointer items-center gap-3 rounded-md text-base text-content outline-none",
          isFocusVisible && "outline-2 outline-offset-2 outline-focus",
          isDisabled && "cursor-not-allowed",
          className,
        )
      }
    >
      {({ isSelected }) => (
        <>
          <span
            aria-hidden="true"
            className={cx(
              "flex h-7 w-12 shrink-0 items-center rounded-full border border-border-strong p-0.5 transition-colors duration-[var(--duration-fast)]",
              isSelected ? "bg-primary" : "bg-disabled",
            )}
          >
            <span
              className={cx(
                "size-5 rounded-full bg-surface shadow-sm transition-transform duration-[var(--duration-fast)]",
                isSelected ? "translate-x-5" : "translate-x-0",
              )}
            />
          </span>
          {children}
        </>
      )}
    </AriaSwitch>
  );
}
