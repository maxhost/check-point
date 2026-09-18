"use client";

import { RefreshDouble } from "iconoir-react";
import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
} from "react-aria-components";
import type { ReactNode } from "react";
import { cx } from "./cx";

export type ButtonProps = Omit<AriaButtonProps, "children"> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
  isLoading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
};

const variants = {
  primary:
    "bg-primary text-on-primary shadow-sm data-hovered:bg-primary-hover data-pressed:bg-primary-pressed",
  secondary:
    "border border-border-strong bg-surface text-content data-hovered:bg-surface-subtle data-pressed:bg-primary-soft",
  quiet:
    "bg-transparent text-primary data-hovered:bg-primary-soft data-pressed:bg-primary-soft",
  danger:
    "bg-danger text-on-danger data-hovered:bg-danger-hover data-pressed:bg-danger-hover",
} as const;

export function Button({
  variant = "primary",
  isLoading = false,
  fullWidth = false,
  isDisabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <AriaButton
      {...props}
      isDisabled={isDisabled || isLoading}
      aria-busy={isLoading || undefined}
      className={(state) =>
        cx(
          "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-base font-bold transition-colors duration-[var(--duration-fast)]",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          "disabled:cursor-not-allowed disabled:border-disabled disabled:bg-disabled disabled:text-on-disabled disabled:shadow-none",
          variants[variant],
          fullWidth && "w-full",
          typeof className === "function" ? className(state) : className,
        )
      }
    >
      {isLoading && (
        <RefreshDouble
          className="size-5 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      )}
      {children}
    </AriaButton>
  );
}
