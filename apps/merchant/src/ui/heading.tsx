import type { ReactNode } from "react";
import { cx } from "./cx";

export type HeadingProps = {
  level: 1 | 2 | 3;
  id?: string;
  tabIndex?: number;
  className?: string;
  children: ReactNode;
};

// La medida del wizard (ADR 0123, decision 5). Fija margin, color y tipografia para no
// heredar los `h1`/`h2` de globals.css.
const levels = {
  1: "text-2xl leading-tight sm:text-3xl",
  2: "text-xl leading-7",
  3: "text-lg leading-7",
} as const;

export function Heading({
  level,
  id,
  tabIndex,
  className,
  children,
}: HeadingProps) {
  const Tag = `h${level}` as const;
  return (
    <Tag
      id={id}
      tabIndex={tabIndex}
      className={cx(
        "m-0 font-bold text-content",
        levels[level],
        tabIndex !== undefined && "outline-none",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
