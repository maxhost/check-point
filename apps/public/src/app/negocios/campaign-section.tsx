import { onboardingUrl } from "../site-config";

const moments = [
  {
    number: "01",
    label: "BIENVENIDA",
    title: "Recibe bien a alguien nuevo",
    description:
      "Un detalle al unirse a tu programa puede hacer que quiera conocerte mejor.",
  },
  {
    number: "02",
    label: "REACTIVACIÓN",
    title: "Recuerda a quien solía venir",
    description:
      "Dale un motivo para regresar a ese cliente que hace tiempo no te visita.",
  },
  {
    number: "03",
    label: "PROMOCIÓN PUNTUAL",
    title: "Comparte algo especial",
    description:
      "Anuncia un beneficio cuando tengas una ocasión que quieras compartir.",
  },
];

export function CampaignSection() {
  return (
    <section
      className="moments-section"
      id="campanas"
      aria-labelledby="moments-title"
    >
      <div className="moments-inner">
        <div className="moments-heading">
          <div>
            <span className="kicker">MARKETING QUE TIENE SENTIDO</span>
            <h2 id="moments-title">
              Cada momento tiene su <em>mensaje.</em>
            </h2>
          </div>
          <p>
            Acompaña a tus clientes desde la primera visita. Crea campañas para
            darles la bienvenida, volver a conectar o compartir una promoción
            especial.
          </p>
        </div>
        <div className="moments-grid">
          {moments.map((moment) => (
            <article className="moment-card" key={moment.number}>
              <div className="moment-topline">
                <span>{moment.number}</span>
              </div>
              <span className="moment-label">{moment.label}</span>
              <h3>{moment.title}</h3>
              <p>{moment.description}</p>
            </article>
          ))}
        </div>
        <div className="moments-bottom">
          <p>
            Tú eliges el beneficio. CheckPass te ayuda a hacerlo llegar a tus
            clientes.
          </p>
          <a className="text-link" href={onboardingUrl}>
            Crear mi negocio <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
