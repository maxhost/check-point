import { type ComponentProps, useLayoutEffect, useRef } from "react";

export function formatDate(value: string | null, timezone: string) {
  return value
    ? new Intl.DateTimeFormat("es-EC", {
        timeZone: timezone,
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
}

/** A `datetime-local` value (YYYY-MM-DDTHH:mm) for `date` in the business timezone. */
export function localDateTimeInput(timezone: string, date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** A textarea that grows to fit its content, so pasted templates stay fully visible. */
export function AutoGrowTextarea({
  value,
  ...props
}: ComponentProps<"textarea">) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} value={value} {...props} />;
}

export function LoyaltySkeleton() {
  return (
    <main className="merchant-shell" aria-busy="true">
      <div className="brand-page loyalty-page loyalty-skeleton">
        <span className="skeleton-line skeleton-eyebrow" />
        <span className="skeleton-line skeleton-title" />
        <span className="skeleton-line skeleton-description" />
        <section className="panel loyalty-panel">
          <span className="skeleton-line skeleton-section-title" />
          <span className="skeleton-line skeleton-card" />
        </section>
      </div>
    </main>
  );
}
