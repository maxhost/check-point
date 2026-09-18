import {
  CheckCircle,
  InfoCircle,
  WarningCircle,
  XmarkCircle,
} from "iconoir-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

export type AlertProps = {
  kind?: "info" | "success" | "warning" | "error";
  title: string;
  children?: ReactNode;
  className?: string;
};

const alertStyles = {
  info: "bg-info-soft text-content",
  success: "bg-success-soft text-content",
  warning: "bg-warning-soft text-content",
  error: "bg-danger-soft text-content",
} as const;

const alertIcons = {
  info: InfoCircle,
  success: CheckCircle,
  warning: WarningCircle,
  error: XmarkCircle,
} as const;

export function Alert({
  kind = "info",
  title,
  children,
  className,
}: AlertProps) {
  const Icon = alertIcons[kind];
  return (
    <section
      className={cx(
        "grid grid-cols-[auto_1fr] gap-3 rounded-md p-4",
        alertStyles[kind],
        className,
      )}
      role={kind === "error" ? "alert" : "status"}
    >
      <Icon className="mt-0.5 size-5" aria-hidden="true" />
      <div className="min-w-0">
        <h2 className="text-sm font-bold">{title}</h2>
        {children && <div className="mt-1 text-sm leading-5">{children}</div>}
      </div>
    </section>
  );
}
