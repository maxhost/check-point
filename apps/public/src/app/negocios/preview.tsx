import Image from "next/image";

export function HeroPreview() {
  return (
    <figure className="merchant-hero-photo">
      <Image
        src="/images/negocios-hero.jpg"
        alt="Barista atendiendo a una clienta en una cafetería"
        width={1400}
        height={933}
        sizes="(max-width: 800px) 100vw, 46vw"
        priority
      />
      <figcaption>Las relaciones empiezan en tu local.</figcaption>
    </figure>
  );
}

export function DashboardPreview() {
  return (
    <div
      className="dashboard-preview"
      aria-label="Vista ilustrativa del panel de un negocio"
    >
      <div className="dashboard-preview-header">
        <span className="dashboard-preview-logo">c.</span>
        <span>checkpass.club</span>
        <span className="dashboard-preview-tag">EJEMPLO</span>
      </div>
      <div className="dashboard-preview-body">
        <div className="dashboard-preview-intro">
          <small>MI NEGOCIO / PROGRAMA</small>
          <strong>Haz que cada visita cuente.</strong>
          <p>Configura una recompensa simple y compártela en tu local.</p>
        </div>
        <div className="dashboard-program">
          <div>
            <span className="dashboard-program-label">PROGRAMA DE SELLOS</span>
            <strong>Un café para volver</strong>
            <p>Una recompensa después de 6 visitas.</p>
          </div>
          <span className="dashboard-program-status">Activo</span>
        </div>
        <div className="dashboard-preview-grid">
          <div>
            <span>01</span>
            <strong>Define tu premio</strong>
            <p>Elige lo que quieres ofrecer.</p>
          </div>
          <div>
            <span>02</span>
            <strong>Comparte tu QR</strong>
            <p>Invita desde el mostrador.</p>
          </div>
        </div>
      </div>
      <span className="dashboard-disclaimer">
        Interfaz ilustrativa · sin datos reales
      </span>
    </div>
  );
}
