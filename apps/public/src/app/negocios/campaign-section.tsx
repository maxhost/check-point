import { ArrowRight } from "iconoir-react";
import { onboardingUrl } from "../site-config";

const moments = [
  {
    number: "01",
    label: "BIENVENIDA",
    title: "Haz especial la primera visita",
    description:
      "Un detalle al unirse a tu programa ayuda a empezar la relación con buen pie.",
  },
  {
    number: "02",
    label: "VENTA CRUZADA",
    title: "Que te conozcan nuevos clientes",
    description:
      "Ofrece un regalo sorpresa a quien compra en otro comercio cercano de la red.",
  },
  {
    number: "03",
    label: "TE EXTRAÑAMOS · EN RIESGO · RECUPERAR",
    title: "Vuelve a conectar",
    description:
      "Dale un motivo para regresar a quien solía visitarte y hace tiempo no viene.",
  },
  {
    number: "04",
    label: "CERCA DEL PREMIO · PREMIO SIN CANJEAR",
    title: "Que el premio se vuelva una visita",
    description:
      "Recuerda a tus clientes que están cerca de su recompensa o que ya pueden disfrutarla.",
  },
  {
    number: "05",
    label: "HORAS VALLE",
    title: "Dale vida a tus horas flojas",
    description:
      "Activa un beneficio para invitar a tus clientes cuando tu local tiene más espacio.",
  },
  {
    number: "06",
    label: "CERCANÍA",
    title: "Hazte presente cuando están cerca",
    description:
      "Un beneficio oportuno puede convertir el paso por tu barrio en una visita.",
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
            <span className="kicker">MARKETING CON UN CLIC</span>
            <h2 id="moments-title">
              Enciende una campaña. Dale otro motivo para <em>volver.</em>
            </h2>
          </div>
          <p>
            Elige una plantilla, define el beneficio y actívala con un botón.
            Las campañas trabajan solas para acompañar a tus clientes en el
            momento adecuado.
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
            Bienvenida y Venta cruzada en Conecta. Todas las campañas en
            Impulso.
          </p>
          <a className="text-link" href={onboardingUrl}>
            Pruébalo gratis 3 meses{" "}
            <span aria-hidden="true">
              <ArrowRight className="landing-icon" />
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
