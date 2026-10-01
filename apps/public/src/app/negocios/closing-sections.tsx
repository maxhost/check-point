import { onboardingUrl } from "../site-config";

const faqs = [
  {
    question: "¿Qué es CheckPass Club?",
    answer:
      "Es una plataforma para que los comercios locales creen programas de fidelización, premien las visitas de sus clientes y mantengan la relación con ellos mediante campañas. Cada cliente puede ver sus programas y beneficios en una sola cuenta.",
  },
  {
    question: "¿Cómo se une un cliente a mi programa?",
    answer:
      "Cuando visita tu local, escanea el código QR de tu negocio y se une desde su teléfono. No puede unirse desde el explorador de comercios: el primer encuentro ocurre en tu local.",
  },
  {
    question: "¿Necesito instalar una app o comprar equipos?",
    answer:
      "Tu equipo puede usar CheckPass desde el navegador de un teléfono o computadora. El cliente puede consultar sus programas en la PWA o guardar su pase en Apple o Google Wallet. No necesita instalar una app distinta para cada negocio.",
  },
  {
    question: "¿Qué tipos de campañas puedo crear?",
    answer:
      "Puedes configurar un regalo de bienvenida, campañas para clientes habituales que dejaron de visitar tu negocio y promociones puntuales. Las opciones y canales disponibles dependen del plan que elijas.",
  },
  {
    question: "¿Dónde estará disponible CheckPass?",
    answer:
      "Comenzamos en Cuenca, Ecuador. Nuestra intención es llevar CheckPass a más ciudades de Latinoamérica.",
  },
];

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <span aria-hidden="true">{diagonal ? "↗" : "→"}</span>;
}

function SignupLink({
  label,
  light = false,
}: {
  label: string;
  light?: boolean;
}) {
  return (
    <a
      className={`button ${light ? "button-light" : "button-dark"}`}
      href={onboardingUrl}
    >
      {label} <Arrow diagonal />
    </a>
  );
}

export function ClosingSections() {
  return (
    <>
      <section
        className="section plans-section"
        id="planes"
        aria-labelledby="plans-title"
      >
        <div className="section-heading plans-heading">
          <span className="kicker">PLANES PARA EMPEZAR</span>
          <h2 id="plans-title">
            Crece a tu <em>propio ritmo.</em>
          </h2>
          <p>
            Comienza con lo esencial. Añade más herramientas cuando tu negocio
            las necesite.
          </p>
        </div>
        <div className="plan-grid">
          <article className="plan-card">
            <span className="plan-label">PARA EMPEZAR</span>
            <h3>Gratis</h3>
            <p>Crea tu programa y empieza a reconocer a quienes vuelven.</p>
            <div className="plan-price">
              $0 <span>/ mes</span>
            </div>
            <ul>
              <li>Programa de puntos o sellos</li>
              <li>QR para invitar clientes en tu local</li>
              <li>Herramienta de mostrador</li>
            </ul>
            <a className="plan-button" href={onboardingUrl}>
              Comenzar gratis <Arrow />
            </a>
          </article>
          <article className="plan-card plan-card-plus">
            <span className="plan-label">PARA SEGUIR CRECIENDO</span>
            <h3>Plus</h3>
            <p>
              Más formas de conectar con tus clientes y darles razones para
              volver.
            </p>
            <div className="plan-price">
              $20 <span>USD / mes*</span>
            </div>
            <ul>
              <li>Todo lo incluido en Gratis</li>
              <li>Campañas y beneficios</li>
              <li>Más herramientas para tus locales</li>
            </ul>
            <a className="plan-button" href={onboardingUrl}>
              Explorar Plus <Arrow />
            </a>
          </article>
        </div>
        <p className="pricing-note">
          * Precio referencial. Los precios y condiciones definitivos se
          mostrarán antes de contratar.
        </p>
      </section>

      <section
        className="section faq-section"
        id="preguntas"
        aria-labelledby="faq-title"
      >
        <div>
          <span className="kicker">PREGUNTAS FRECUENTES</span>
          <h2 id="faq-title">
            Conversemos
            <br />
            <em>sin vueltas.</em>
          </h2>
          <p>Lo esencial para empezar con claridad.</p>
        </div>
        <div className="faq-list">
          {faqs.map((faq) => (
            <details key={faq.question}>
              <summary>
                {faq.question}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="final-cta" aria-labelledby="final-title">
        <span className="kicker">EL SIGUIENTE PASO ES TUYO</span>
        <h2 id="final-title">
          Tu próximo cliente habitual puede empezar <em>hoy.</em>
        </h2>
        <p>
          Prepara tu programa, coloca tu QR y empieza a construir relaciones que
          duran más de una visita.
        </p>
        <SignupLink label="Crear mi negocio gratis" light />
      </section>
    </>
  );
}

export function LandingFooter() {
  return (
    <footer className="site-footer">
      <a
        className="brand"
        href="/"
        aria-label="CheckPass Club, inicio para negocios"
      >
        <span className="brand-symbol">
          c<span>.</span>
        </span>
        <span className="brand-name">
          checkpass<span>.</span>club
        </span>
      </a>
      <p>Más motivos para volver. Hecho para negocios locales.</p>
      <div>
        <a href="/explorar">Explorar la ciudad</a>
        <a href="#como-funciona">Cómo funciona</a>
        <a href="#planes">Planes</a>
        <a href="#preguntas">Preguntas</a>
        <a href="/es/privacy">Privacidad</a>
        <a href="/es/tos">Términos de uso</a>
      </div>
      <small>
        © {new Date().getFullYear()} CheckPass Club · Cuenca, Ecuador
      </small>
      <small className="merchant-photo-credit">
        Fotografías de ejemplo:{" "}
        <a href="https://www.pexels.com/photo/woman-ordering-coffee-in-cafe-13735959/">
          Mizuno K
        </a>{" "}
        y{" "}
        <a href="https://www.pexels.com/photo/church-dome-and-towers-over-street-20608997/">
          Juan Villarreal
        </a>{" "}
        / Pexels.
      </small>
    </footer>
  );
}
