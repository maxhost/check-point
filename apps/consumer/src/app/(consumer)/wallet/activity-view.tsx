import type { ConsumerCoupon } from "@mi-pasaporte/domain/server/consumer/coupons";
import type { NoticeDTO } from "@mi-pasaporte/domain/server/consumer/notices";
import type { ConsumerProgramSummary } from "@mi-pasaporte/domain/server/consumer/programs";

export function ActivityView({
  coupons,
  notices,
  programs,
  onBack,
  onShowBenefits,
  onShowPrograms,
}: {
  coupons: ConsumerCoupon[];
  notices: NoticeDTO[];
  programs: ConsumerProgramSummary[];
  onBack: () => void;
  onShowBenefits: () => void;
  onShowPrograms: () => void;
}) {
  const entries = [
    ...coupons
      .filter((coupon) => coupon.status === "valid")
      .map((coupon) => ({
        key: `coupon-${coupon.id}`,
        title: "Beneficio disponible",
        detail: `${coupon.label} · ${coupon.businessName}`,
        date: new Date(coupon.validFrom),
        action: onShowBenefits,
        icon: "✦",
      })),
    ...programs.map((program) => ({
      key: `program-${program.membershipId}`,
      title: "Nuevo programa",
      detail: program.businessName,
      date: new Date(program.enrolledAt),
      action: onShowPrograms,
      icon: "▦",
    })),
    ...notices.map((notice) => ({
      key: `notice-${notice.id}`,
      title: notice.title,
      detail: notice.body,
      date: new Date(notice.createdAt),
      action: onShowPrograms,
      icon: "✳",
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <section className="cp-screen cp-activity" aria-labelledby="activity-title">
      <button className="cp-back" type="button" onClick={onBack}>
        ← Volver
      </button>
      <div className="cp-screen-heading">
        <span className="cp-eyebrow">NOVEDADES</span>
        <h2 id="activity-title">Actividad</h2>
        <p>Beneficios, programas y movimientos en comercios de la cuenta.</p>
      </div>
      {entries.length ? (
        <div className="cp-activity-list">
          {entries.map((entry) => (
            <button
              type="button"
              key={entry.key}
              onClick={entry.action}
              className="cp-activity-row"
            >
              <span className="cp-activity-icon" aria-hidden="true">
                {entry.icon}
              </span>
              <span className="cp-activity-content">
                <strong>{entry.title}</strong>
                <span>{entry.detail}</span>
                <small>
                  {entry.date.toLocaleDateString("es", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </small>
              </span>
              <span aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="cp-empty">
          <span aria-hidden="true">◌</span>
          <h3>La actividad va a aparecer aquí</h3>
          <p>
            Las inscripciones a programas, los beneficios y los movimientos en
            comercios van a aparecer en este espacio.
          </p>
        </div>
      )}
    </section>
  );
}
