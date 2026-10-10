import { onboardingUrl } from "../site-config";
import { BrandMark } from "../brand-mark";

const faqs = [
  {
    question: "¿Qué pasa al terminar los tres meses de prueba?",
    answer:
      "La prueba incluye todas las herramientas. Después puedes continuar con Conecta o Impulso, según lo que tu negocio necesite. Los precios y condiciones definitivos se mostrarán antes de contratar.",
  },
  {
    question: "¿Cómo puede la red traerme nuevos clientes?",
    answer:
      "Cuando alguien compra en otro comercio de la red, puede recibir un regalo sorpresa tuyo. La venta cruzada conecta negocios de rubros distintos a menos de 2 km. Tú defines el beneficio; el cliente recibe un motivo para descubrirte.",
  },
  {
    question: "¿Los puntos sirven en otros comercios?",
    answer:
      "No. Los puntos, sellos y premios pertenecen al programa de cada negocio y se canjean solo allí. La red conecta a los clientes con regalos sorpresa de otros comercios, sin transferir puntos entre programas.",
  },
  {
    question: "¿Mi cliente necesita descargar una app?",
    answer:
      "No. Escanea el QR en tu local y se une desde el celular. Puede llevar su pase en Apple Wallet, Google Wallet o el navegador, con sus lugares favoritos en una sola tarjeta.",
  },
  {
    question: "¿Qué necesito para atender e imprimir tickets?",
    answer:
      "Tu equipo puede trabajar desde el navegador con el mostrador o el POS. Para imprimir por Bluetooth necesitas una impresora y un dispositivo compatibles. El POS permite organizar órdenes por mesa, identificar al cliente con su pase y cobrar.",
  },
  {
    question: "¿Dónde empieza la red?",
    answer:
      "Empezamos en Cuenca, Ecuador. Puedes explorar los comercios y sus fichas públicas para conocer la red de tu ciudad. Los clientes se unen a tu programa con el QR de tu local.",
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
          <span className="kicker">
            HERRAMIENTAS DE CADENA, PARA TU NEGOCIO
          </span>
          <h2 id="plans-title">
            Tres meses para probar. Más motivos para <em>quedarte.</em>
          </h2>
          <p>
            Empieza con todo incluido durante tres meses gratis. Después, elige
            el plan que acompaña a tu negocio.
          </p>
        </div>
        <div className="trial-banner">
          <strong>3 meses gratis · todo incluido</strong>
          <span>Conoce la red, prueba las campañas y prepara tu equipo.</span>
        </div>
        <div className="plan-grid">
          <article className="plan-card">
            <span className="plan-label">CONECTA CON TU CIUDAD</span>
            <h3>Conecta</h3>
            <p>
              Fideliza a quienes ya te conocen y dale a nuevos clientes un
              motivo para entrar.
            </p>
            <div className="plan-price">
              $20 <span>USD / mes*</span>
            </div>
            <ul>
              <li>1 local</li>
              <li>Programa de puntos o sellos y pase digital</li>
              <li>Mostrador, catálogo y lista de clientes</li>
              <li>Ficha pública, afiche y QR de inscripción</li>
              <li>Campañas Bienvenida y Venta cruzada</li>
            </ul>
            <a className="plan-button" href={onboardingUrl}>
              Pruébalo gratis 3 meses <Arrow />
            </a>
          </article>
          <article className="plan-card plan-card-plus">
            <span className="plan-label">DA EL SIGUIENTE PASO</span>
            <h3>Impulso</h3>
            <p>
              Más momentos para conectar con tus clientes y más espacio para tus
              locales.
            </p>
            <div className="plan-price">
              $45 <span>USD / mes*</span>
            </div>
            <ul>
              <li>Hasta 3 locales</li>
              <li>Todo lo incluido en Conecta</li>
              <li>Te extrañamos, Cliente en riesgo y Recuperar</li>
              <li>Cerca del premio y Premio sin canjear</li>
              <li>Horas valle y campañas por cercanía</li>
            </ul>
            <a className="plan-button" href={onboardingUrl}>
              Pruébalo gratis 3 meses <Arrow />
            </a>
          </article>
        </div>
        <p className="pricing-note">Local adicional: $12 USD / mes*.</p>
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
          Dale a tu negocio más oportunidades de <em>crecer.</em>
        </h2>
        <p>
          Conecta con tu ciudad, da más razones para volver y atiende con las
          herramientas que tu negocio merece. Empieza en Cuenca.
        </p>
        <SignupLink label="Pruébalo gratis 3 meses" light />
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
        <BrandMark />
        <span className="brand-name">
          checkpass<span>.</span>club
        </span>
      </a>
      <p>Más clientes nuevos. Más razones para volver.</p>
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
        / Pexels.
      </small>
    </footer>
  );
}
