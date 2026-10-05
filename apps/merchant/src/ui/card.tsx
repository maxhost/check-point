import type { ReactNode } from "react";
import { cx } from "./cx";

export type CardProps = {
  as?: "section" | "div" | "article";
  "aria-labelledby"?: string;
  className?: string;
  children: ReactNode;
};

/** La tarjeta del wizard, con borde: sobre el fondo del backoffice la sombra sola no separa. */
export function Card({
  as: Tag = "section",
  className,
  children,
  ...props
}: CardProps) {
  return (
    <Tag
      {...props}
      className={cx(
        "rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
