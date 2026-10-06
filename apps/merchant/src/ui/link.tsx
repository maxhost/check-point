import NextLink, { type LinkProps as NextLinkProps } from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";

export type LinkProps = Omit<NextLinkProps, "className"> & {
  variant?: "inline" | "primary" | "secondary";
  tourAnchor?: string;
  className?: string;
  children: ReactNode;
};

// Las variantes de boton repiten las de `Button` con `hover:`/`active:`: un `<a>` de Next no
// tiene los `data-hovered`/`data-pressed` de React Aria.
const variants = {
  inline:
    "font-bold text-primary underline underline-offset-2 hover:text-primary-hover",
  primary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-base font-bold no-underline bg-primary text-on-primary shadow-sm hover:bg-primary-hover active:bg-primary-pressed",
  secondary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-base font-bold no-underline border border-border-strong bg-surface text-content hover:bg-surface-subtle active:bg-primary-soft",
} as const;

/** Spec 0160: `next/link` con el aspecto del kit (navegacion del cliente y prefetch intactos). */
export function Link({
  variant = "inline",
  tourAnchor,
  className,
  children,
  ...props
}: LinkProps) {
  return (
    <NextLink
      {...props}
      data-tour={tourAnchor}
      className={cx(
        "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        variants[variant],
        className,
      )}
    >
      {children}
    </NextLink>
  );
}
