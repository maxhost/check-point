import type { ReactNode } from "react";
import { cx } from "./cx";

export type TextProps = {
  variant?: "body" | "muted" | "small" | "label";
  as?: "p" | "span";
  id?: string;
  className?: string;
  children: ReactNode;
};

const variants = {
  body: "text-base font-normal leading-6 text-content",
  muted: "text-base font-normal leading-6 text-content-muted",
  small: "text-sm font-normal leading-5 text-content-muted",
  label: "text-base font-bold leading-5 text-content",
} as const;

export function Text({
  variant = "body",
  as: Tag = "p",
  id,
  className,
  children,
}: TextProps) {
  return (
    <Tag id={id} className={cx("m-0", variants[variant], className)}>
      {children}
    </Tag>
  );
}
