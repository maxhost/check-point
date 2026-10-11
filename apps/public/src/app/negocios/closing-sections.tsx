import { ArrowRight, ArrowUpRight, Check, Plus } from "iconoir-react";
import { onboardingUrl } from "../site-config";
import { BrandMark } from "../brand-mark";

const faqs = [
  {
    question: "¿Qué incluye la prueba gratuita?",
    answer:
      "Durante tres meses puedes usar todas las herramientas: programa de fidelización, campañas de marketing y punto de venta. Así puedes probarlas con tu equipo y tus clientes.",
  },
  {
    question: "¿Qué pasa cuando termina la prueba?",
    answer:
      "Para continuar, elige Conecta o Impulso y contrata tu suscripción. Si no contratas, el acceso a las herramientas queda bloqueado, pero los datos de tu negocio y tus clientes se conservan.",
  },
  {
    question:
      "¿Necesito usar el punto de venta para tener mi programa de fidelización?",
    answer:
      "No. Puedes usar el mostrador para sumar puntos o sellos y canjear premios, sin gestionar pedidos ni mesas. Activa el punto de venta cuando lo necesites.",
  },
  {
    question: "¿Mis clientes necesitan descargar una app?",
    answer:
      "No. Escanean el QR de tu local y se unen desde su celular. Pueden guardar su pase en Apple Wallet, Google Wallet o usarlo desde el navegador.",
  },
  {
    question: "¿Quién decide los premios y beneficios?",
    answer:
      "Tú eliges las recompensas de tu programa y los beneficios que ofreces en tus campañas. Por ejemplo, un café al completar seis visitas o un regalo de bienvenida.",
  },
  {
    question: "¿Cómo puedo llegar a nuevos clientes?",
    answer:
      "Con Venta cruzada, alguien que compra en otro comercio cercano puede recibir un regalo de tu negocio. Por ejemplo, después de visitar una peluquería, recibe una invitación para probar un café en tu local. Participan comercios de rubros distintos a menos de 2 km; tú decides qué ofrecer.",
  },
  {
    question: "¿Los puntos y sellos pueden usarse en otro negocio?",
    answer:
      "No. Los puntos y sellos pertenecen al programa de cada negocio y se canjean solo allí. Venta cruzada ofrece beneficios de otros comercios, sin transferir puntos ni sellos entre programas.",
  },
  {
    question: "¿Necesito comprar equipos?",
    answer:
      "Puedes gestionar tu negocio y atender desde el navegador de tu teléfono, tablet o computadora con conexión a internet. Para imprimir tickets por Bluetooth, necesitas además una impresora y un dispositivo compatibles.",
  },
  {
    question: "¿Puedo usarlo en varios locales?",
    answer:
      "Sí. Conecta incluye un local e Impulso incluye hasta tres. También puedes añadir locales por un costo adicional.",
  },
];

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <span aria-hidden="true">
      {diagonal ? (
        <ArrowUpRight className="landing-icon" />
      ) : (
        <ArrowRight className="landing-icon" />
      )}
    </span>
  );
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
          <span className="kicker">MÁS POSIBILIDADES PARA TU NEGOCIO</span>
          <h2 id="plans-title">
            Prueba todo durante tres meses. Después, elige <em>tu plan.</em>
          </h2>
          <p>
            Empieza con todo incluido durante tres meses gratis. Después, elige
            el plan que acompaña a tu negocio.
          </p>
        </div>
        <div className="trial-banner">
          <strong>3 meses gratis · todo incluido</strong>
          <span>
            Prueba el programa de fidelización, el marketing y el punto de
            venta.
          </span>
        </div>
        <div className="plan-grid">
          <article className="plan-card">
            <span className="plan-label">CONECTA CON TU CIUDAD</span>
            <h3>Conecta</h3>
            <p>
              <strong>1 local · puntos y sellos</strong>
              <br />
              Campañas de Bienvenida y Venta cruzada.
            </p>
            <div className="plan-price">
              $20 <span>USD / mes**</span>
            </div>
            <ul>
              <li>
                <Check className="plan-check" aria-hidden="true" />1 local
              </li>
              <li>
                <Check className="plan-check" aria-hidden="true" />
                Punto de venta desde tu celular
              </li>
              <li>
                <Check className="plan-check" aria-hidden="true" />
                Catálogo gestionado con IA
              </li>
              <li>
                <Check className="plan-check" aria-hidden="true" />
                Gestión de mesas
              </li>
              <li>
                <Check className="plan-check" aria-hidden="true" />
                Gestión de órdenes y pedidos
              </li>
              <li>
                <Check className="plan-check" aria-hidden="true" />
                Programa de fidelización con puntos y sellos
              </li>
              <li>
                <Check className="plan-check" aria-hidden="true" />
                Campaña de Bienvenida
              </li>
              <li>
                <Check className="plan-check" aria-hidden="true" />
                Campaña de Venta cruzada
              </li>
              <li>
                <Check className="plan-check" aria-hidden="true" />
                Avisos al teléfono de tus clientes*
              </li>
              <li>
                <Check className="plan-check" aria-hidden="true" />
                Ficha pública en CheckPass.club
              </li>
            </ul>
            <a className="plan-button" href={onboardingUrl}>
              Pruébalo gratis 3 meses <Arrow />
            </a>
          </article>
          <article className="plan-card plan-card-plus">
            <span className="plan-label">DA EL SIGUIENTE PASO</span>
            <h3>Impulso</h3>
            <p>
              <strong>Hasta 3 locales · cashback próximamente</strong>
              <br />
              Todas las campañas de marketing, incluidas las avanzadas.
            </p>
            <div className="plan-price">
              $45 <span>USD / mes**</span>
            </div>
            <ul>
              <li>
                <Check className="plan-check" aria-hidden="true" />
                Hasta 3 locales
              </li>
              <li>
                <Check className="plan-check" aria-hidden="true" />
                Punto de venta desde tu celular
              </li>
              <li>
                <Check className="plan-check" aria-hidden="true" />
                Catálogo gestionado con IA
              </li>
              <li>
                <Check className="plan-check" aria-hidden="true" />
                Gestión de mesas
              </li>
              <li>
                <Check className="plan-check" aria-hidden="true" />
                Gestión de órdenes y pedidos
              </li>
              <li>
                <Check className="plan-check" aria-hidden="true" />
                Programa de fidelización con puntos y sellos; cashback
                próximamente
              </li>
              <li>
                <Check className="plan-check" aria-hidden="true" />
                Campaña de Bienvenida
              </li>
              <li>
                <Check className="plan-check" aria-hidden="true" />
                Campaña de Venta cruzada
              </li>
              <li>
                <Check className="plan-check" aria-hidden="true" />
                Avisos al teléfono de tus clientes*
              </li>
              <li>
                <Check className="plan-check" aria-hidden="true" />
                Ficha pública en CheckPass.club
              </li>
              <li>
                <Check className="plan-check" aria-hidden="true" />
                Campañas avanzadas para recuperar clientes y promover visitas en
                horarios tranquilos
              </li>
            </ul>
            <a className="plan-button" href={onboardingUrl}>
              Pruébalo gratis 3 meses <Arrow />
            </a>
          </article>
        </div>
        <p className="pricing-note">
          * Las notificaciones push no tienen límites actualmente. Los límites
          pueden cambiar según el tipo de cuenta.
        </p>
        <p className="pricing-note">Local adicional: $12 USD / mes**.</p>
        <p className="pricing-note">
          ** Precio referencial. Los precios y condiciones definitivos se
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
            Resuelve tus dudas antes de <em>empezar.</em>
          </h2>
        </div>
        <div className="faq-list">
          {faqs.map((faq) => (
            <details key={faq.question}>
              <summary>
                {faq.question}
                <span aria-hidden="true">
                  <Plus className="landing-icon" />
                </span>
              </summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="final-cta" aria-labelledby="final-title">
        <span className="kicker">PRUÉBALO EN TU NEGOCIO</span>
        <h2 id="final-title">
          Empieza hoy. Descubre lo que puedes lograr en <em>tres meses.</em>
        </h2>
        <p>
          Activa tu programa de fidelización, llega a tus clientes y gestiona
          tus ventas. Prueba todas las herramientas gratis durante tres meses.
        </p>
        <SignupLink label="Pruébalo gratis 3 meses" light />
      </section>
    </>
  );
}

export function LandingFooter({
  showPhotoCredit = true,
}: {
  showPhotoCredit?: boolean;
}) {
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
        <a href="/#como-funciona">Cómo empezar</a>
        <a href="/#planes">Planes</a>
        <a href="/#preguntas">Preguntas</a>
        <a href="/es/privacy">Privacidad</a>
        <a href="/es/tos">Términos de uso</a>
      </div>
      <small>
        © {new Date().getFullYear()} CheckPass Club · Cuenca, Ecuador
      </small>
      {showPhotoCredit && (
        <small className="merchant-photo-credit">
          Fotografías de ejemplo:{" "}
          <a href="https://www.pexels.com/photo/woman-ordering-coffee-in-cafe-13735959/">
            Mizuno K
          </a>{" "}
          / Pexels.
        </small>
      )}
    </footer>
  );
}
