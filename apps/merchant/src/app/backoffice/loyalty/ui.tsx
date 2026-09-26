import { Skeleton, SkeletonScreen } from "../../components/ui";
/** Money in the business currency; rounds to whole units when the amount is integral. */
export function formatMoney(amount: number, currency: string) {
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;
  try {
    return new Intl.NumberFormat("es", {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(fractionDigits)}`;
  }
}

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

export function LoyaltySkeleton() {
  return (
    <main className="merchant-shell">
      <SkeletonScreen
        label="Cargando programa…"
        className="brand-page loyalty-page loyalty-fields"
      >
        <Skeleton height={12} width={160} />
        <Skeleton height={34} width="80%" />
        <Skeleton height={16} width="90%" />
        <section className="loyalty-section">
          <Skeleton height={20} width="60%" />
          <Skeleton height={48} width="100%" />
          <Skeleton height={48} width="100%" />
          <Skeleton height={44} width="100%" />
        </section>
      </SkeletonScreen>
    </main>
  );
}
