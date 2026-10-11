import type { Metadata } from "next";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Gift,
  CoffeeCup,
  Scissor,
  User,
  Plus,
} from "iconoir-react";
import { BrandMark } from "../brand-mark";
import { LandingFooter } from "../negocios/closing-sections";
import { onboardingUrl, siteUrl } from "../site-config";
import "./marketing.css";

const title = "Marketing automático para comercios en Cuenca";
const description =
  "Dales motivos para visitar tu negocio y volver. Campañas de Bienvenida y Venta cruzada con beneficios que tú eliges. Prueba CheckPass gratis 3 meses.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/marketing-para-comercios" },
  openGraph: {
    title,
    description,
    type: "website",
    locale: "es_EC",
    siteName: "CheckPass Club",
    url: `${siteUrl}/marketing-para-comercios`,
  },
  twitter: { card: "summary", title, description },
};

const faqs = [
  {
    question: "¿A quién puedo invitar?",
    answer:
      "Bienvenida ofrece un beneficio a quienes se inscriben en tu programa de fidelización. Venta cruzada puede ofrecerlo a personas que compran en otros comercios participantes de la red, de rubros distintos, con un alcance de 2 km. La entrega depende de las condiciones de la campaña.",
  },
  {
    question: "¿Dónde ve el cliente su beneficio?",
    answer:
      "Puede consultarlo desde su teléfono. Para recibir avisos push debe activar las notificaciones en un dispositivo y navegador compatibles. Estas campañas no envían mensajes de WhatsApp ni correos electrónicos.",
  },
  {
    question: "¿Puedo elegir qué ofrecer?",
    answer:
      "Sí. Tú eliges el beneficio y sus condiciones: por ejemplo, un café para conocer tu cafetería. CheckPass entrega el beneficio según la campaña que actives; no elige el regalo por ti ni garantiza que cada invitación termine en una visita.",
  },
  {
    question: "¿Qué incluye cada plan?",
    answer:
      "Conecta e Impulso incluyen Bienvenida y Venta cruzada. Impulso añade campañas avanzadas para recuperar clientes que dejaron de venir y promover visitas en horarios tranquilos. Durante la prueba gratuita de tres meses puedes probar todas las herramientas.",
  },
  {
    question: "¿Necesito usar el punto de venta?",
    answer:
      "No. Puedes usar fidelización y campañas sin gestionar mesas ni pedidos. Para las campañas dirigidas a tus clientes, primero deben inscribirse en el programa de tu negocio.",
  },
  {
    question: "¿Hay límites de notificaciones?",
    answer:
      "Actualmente las notificaciones push no tienen límites. Esto puede cambiar según el tipo de cuenta. Las condiciones definitivas se mostrarán antes de contratar.",
  },
];

function SignupLink({ light = false }: { light?: boolean }) {
  return (
    <a
      className={`button ${light ? "button-light" : "button-dark"}`}
      href={onboardingUrl}
    >
      Pruébalo gratis 3 meses
      <ArrowUpRight aria-hidden="true" />
    </a>
  );
}

export default function MerchantMarketingPage() {
  return (
    <>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <div className="marketing-page">
        <header className="site-header">
          <a className="brand" href="/" aria-label="CheckPass Club, inicio">
            <BrandMark />
            <span className="brand-name">checkpass.club</span>
          </a>
          <nav className="desktop-nav" aria-label="Navegación de marketing">
            <a href="#campanas">Campañas</a>
            <a href="#como-funciona">Cómo empezar</a>
            <a href="/negocios#planes">Planes</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
          <a className="header-cta" href={onboardingUrl}>
            Pruébalo gratis
            <ArrowUpRight aria-hidden="true" />
          </a>
        </header>
        <main id="contenido">
          <section className="marketing-hero" aria-labelledby="marketing-title">
            <div className="hero-copy">
              <h1 id="marketing-title">
                Invita a nuevos clientes. <em>Dales motivos para volver.</em>
              </h1>
              <p className="hero-lede">
                Campañas automáticas para tu comercio: ofrece un beneficio a
                quienes se unen a tu programa y a personas de otros negocios
                cercanos. Tú eliges qué ofrecer; CheckPass se encarga de la
                entrega.
              </p>
              <div className="hero-actions">
                <SignupLink />
                <a className="text-link" href="#campanas">
                  Conoce las campañas
                  <ArrowRight aria-hidden="true" />
                </a>
              </div>
              <p className="hero-assurance">
                <Check aria-hidden="true" />
                Todo incluido durante la prueba · Empezamos en Cuenca
              </p>
            </div>
            <figure
              className="marketing-invitation"
              aria-label="Ejemplo ilustrativo de una campaña de Bienvenida"
            >
              <figcaption>Una bienvenida que invita a volver.</figcaption>
              <ol className="invitation-sequence">
                <li>
                  <User aria-hidden="true" />
                  <div>
                    <strong>Se une a tu programa</strong>
                    <p>Desde el QR de tu local.</p>
                  </div>
                </li>
                <li>
                  <Gift aria-hidden="true" />
                  <div>
                    <strong>Recibe tu beneficio</strong>
                    <p>Por ejemplo, un café de bienvenida.</p>
                  </div>
                </li>
                <li>
                  <CoffeeCup aria-hidden="true" />
                  <div>
                    <strong>Un motivo para visitarte</strong>
                    <p>Lo canjea según las condiciones que defines.</p>
                  </div>
                </li>
              </ol>
              <p className="demonstration-note">
                Así puede funcionar Bienvenida. Tú decides el beneficio y cuándo
                se puede canjear.
              </p>
            </figure>
          </section>

          <section
            className="section"
            id="campanas"
            aria-labelledby="campaigns-title"
          >
            <div className="section-heading">
              <h2 id="campaigns-title">
                Dos formas de invitar a <em>tu negocio.</em>
              </h2>
              <p>
                Empieza con quienes ya te conocen o presenta tu negocio a
                personas de la red cercana.
              </p>
            </div>
            <div className="marketing-campaigns">
              <article
                className="marketing-campaign"
                aria-labelledby="welcome-title"
              >
                <div>
                  <h3 id="welcome-title">Bienvenida</h3>
                  <p>
                    Haz que unirse a tu programa tenga un primer beneficio. Tú
                    eliges el regalo y las condiciones para canjearlo.
                  </p>
                  <p className="campaign-audience">
                    <strong>Para:</strong> personas que se inscriben en tu
                    programa.
                  </p>
                </div>
                <ol
                  className="marketing-campaign-flow"
                  aria-label="Bienvenida: al unirse, recibe tu beneficio"
                >
                  <li>
                    <User aria-hidden="true" />
                    <span>Se une a tu programa</span>
                  </li>
                  <li className="marketing-flow-arrow" aria-hidden="true">
                    <ArrowRight />
                  </li>
                  <li>
                    <Gift aria-hidden="true" />
                    <span>Recibe tu beneficio</span>
                  </li>
                </ol>
              </article>
              <article
                className="marketing-campaign"
                aria-labelledby="cross-title"
              >
                <div>
                  <h3 id="cross-title">Venta cruzada</h3>
                  <p>
                    Alguien compra en otro comercio cercano. Tu beneficio puede
                    darle un motivo para conocer el tuyo.
                  </p>
                  <p className="campaign-audience">
                    <strong>Para:</strong> personas de otros comercios
                    participantes.
                  </p>
                  <p className="marketing-campaign-condition">
                    Entre rubros distintos, con un alcance de 2 km. La entrega
                    depende de las condiciones de la campaña.
                  </p>
                </div>
                <div>
                  <ol
                    className="marketing-campaign-flow"
                    aria-label="Ejemplo de Venta cruzada: compra en peluquería y recibe un café de tu negocio"
                  >
                    <li>
                      <Scissor aria-hidden="true" />
                      <span>Compra en una peluquería</span>
                    </li>
                    <li className="marketing-flow-arrow" aria-hidden="true">
                      <ArrowRight />
                    </li>
                    <li>
                      <CoffeeCup aria-hidden="true" />
                      <span>Recibe un café de tu negocio</span>
                    </li>
                  </ol>
                  <p className="demonstration-note">
                    Un ejemplo si tu negocio es una cafetería. Tú eliges qué
                    ofrecer.
                  </p>
                </div>
              </article>
            </div>
            <p className="marketing-plan-note">
              <Check aria-hidden="true" />
              Bienvenida y Venta cruzada están incluidas en Conecta e Impulso.
            </p>
          </section>

          <section
            className="section marketing-start"
            id="como-funciona"
            aria-labelledby="start-title"
          >
            <div>
              <h2 id="start-title">
                Tú eliges el beneficio. <em>CheckPass hace la entrega.</em>
              </h2>
              <p>
                Activa la campaña una vez. No tienes que enviar cada beneficio
                de forma individual.
              </p>
            </div>
            <ol className="marketing-steps">
              <li>
                <span aria-hidden="true">1</span>
                <div>
                  <h3>Activa tu programa</h3>
                  <p>
                    Invita a tus clientes a inscribirse con el QR del local.
                  </p>
                </div>
              </li>
              <li>
                <span aria-hidden="true">2</span>
                <div>
                  <h3>Prepara la campaña</h3>
                  <p>
                    Elige el beneficio y define las condiciones. Revisa lo que
                    ofreces antes de activarla.
                  </p>
                </div>
              </li>
              <li>
                <span aria-hidden="true">3</span>
                <div>
                  <h3>Actívala y deja que trabaje</h3>
                  <p>
                    CheckPass entrega el beneficio automáticamente cuando se
                    cumplen las condiciones de la campaña.
                  </p>
                </div>
              </li>
            </ol>
          </section>

          <section
            className="section marketing-advanced"
            aria-labelledby="advanced-title"
          >
            <div>
              <h2 id="advanced-title">
                También hay motivos para <em>regresar.</em>
              </h2>
              <p>
                Impulso añade campañas para dos situaciones habituales de tu
                negocio. Tú sigues eligiendo el beneficio.
              </p>
              <a className="text-link" href="/negocios#planes">
                Compara los planes
                <ArrowRight aria-hidden="true" />
              </a>
            </div>
            <div className="advanced-situations">
              <article>
                <h3>Cuando dejan de venir</h3>
                <p>
                  Ofrece un motivo para retomar el contacto con clientes que
                  llevan tiempo sin visitar tu negocio.
                </p>
              </article>
              <article>
                <h3>Cuando el local está tranquilo</h3>
                <p>
                  Promueve visitas en horarios de menor actividad con un
                  beneficio que tenga sentido para tu comercio.
                </p>
              </article>
            </div>
          </section>

          <section
            className="section faq-section"
            id="preguntas"
            aria-labelledby="faq-title"
          >
            <div>
              <h2 id="faq-title">
                Antes de activar <em>tu primera campaña.</em>
              </h2>
            </div>
            <div className="faq-list">
              {faqs.map((faq) => (
                <details key={faq.question}>
                  <summary>
                    {faq.question}
                    <Plus aria-hidden="true" />
                  </summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
          <section className="final-cta" aria-labelledby="final-title">
            <div>
              <h2 id="final-title">
                Prueba qué funciona <em>para tu negocio.</em>
              </h2>
              <p>
                Tres meses para probar las campañas, tu programa de fidelización
                y el punto de venta. Todo incluido durante la prueba.
              </p>
            </div>
            <SignupLink light />
          </section>
        </main>
        <LandingFooter showPhotoCredit={false} compact />
      </div>
    </>
  );
}
