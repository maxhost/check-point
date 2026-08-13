export function formatDate(value: string | null, timezone: string) {
  return value
    ? new Intl.DateTimeFormat("es-EC", {
        timeZone: timezone,
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
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
