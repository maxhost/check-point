import { cx } from "./cx";

export type SegmentedBarProps = {
  /** Describe la distribución completa; los segmentos son decorativos. */
  label: string;
  segments: readonly {
    id: string;
    value: number;
    tone:
      "primary" | "info" | "accent" | "expense-variable" | "lavender" | "sky";
  }[];
  className?: string;
};

const tones = {
  lavender: "bg-chart-lavender",
  sky: "bg-chart-sky",
  primary: "bg-primary",
  info: "bg-info",
  accent: "bg-accent",
  "expense-variable": "bg-expense-variable",
} as const;

/** Distribución estática de cantidades no negativas; cero o ajustes negativos no forman una barra. */
export function SegmentedBar({
  label,
  segments,
  className,
}: SegmentedBarProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (
    !Number.isFinite(total) ||
    total <= 0 ||
    segments.some(({ value }) => !Number.isFinite(value) || value < 0)
  )
    return null;
  return (
    <div
      role="img"
      aria-label={label}
      className={cx("flex h-8 gap-1 overflow-hidden rounded-md", className)}
    >
      {segments
        .filter(({ value }) => value > 0)
        .map(({ id, value, tone }) => (
          <div
            key={id}
            aria-hidden="true"
            className={cx("h-full rounded-sm", tones[tone])}
            style={{ width: `${(value / total) * 100}%` }}
          />
        ))}
    </div>
  );
}
