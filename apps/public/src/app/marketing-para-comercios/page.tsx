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
import "../negocios/negocios.css";
import "./marketing.css";

const title = "Marketing automático para comercios en Cuenca";
const description =
  "Activa campañas de Bienvenida y Venta cruzada con CheckPass Club. Invita a tus clientes a volver y a personas de comercios cercanos a conocer tu negocio.";

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
    question: "¿A quién llegan las campañas de mi negocio?",
    answer:
      "Las campañas para tus clientes se dirigen a quienes se han inscrito en tu programa de fidelización. Venta cruzada permite ofrecer un beneficio a personas que compran en otros comercios participantes de la red, de rubros distintos y a menos de 2 km de tu local.",
  },
  {
    question: "¿Cómo reciben los beneficios?",
    answer:
      "Los beneficios se consultan desde el teléfono. Los avisos push requieren que el cliente active las notificaciones en un dispositivo y navegador compatibles. Estas campañas no envían mensajes de WhatsApp ni correos electrónicos.",
  },
  {
    question: "¿Quién elige el regalo o beneficio?",
    answer:
      "Tú decides qué ofrecer y configuras las condiciones de la campaña. Por ejemplo, un café para que alguien conozca tu cafetería. CheckPass no elige los regalos por ti ni garantiza que cada invitación termine en una visita.",
  },
  {
    question: "¿Qué campañas incluye cada plan?",
    answer:
      "Conecta e Impulso incluyen Bienvenida y Venta cruzada. Impulso añade campañas avanzadas, como las que ayudan a recuperar clientes que dejaron de venir o a promover visitas en horarios tranquilos. Durante la prueba gratuita de tres meses puedes probar todas las herramientas.",
  },
  {
    question: "¿Necesito usar el punto de venta?",
    answer:
      "No. Puedes usar tu programa de fidelización y las campañas sin gestionar mesas ni pedidos. Necesitas que tus clientes se unan al programa para poder dirigirles las campañas para clientes inscritos.",
  },
  {
    question: "¿Hay límites de notificaciones?",
    answer:
      "Actualmente las notificaciones push no tienen límites. Los límites pueden cambiar según el tipo de cuenta; revisa las condiciones de tu plan antes de contratar.",
  },
];

function SignupLink({ light = false }: { light?: boolean }) {
  return (
    <a
      className={`button ${light ? "button-light" : "button-dark"}`}
      href={onboardingUrl}
    >
      Pruébalo gratis 3 meses
      <ArrowUpRight className="landing-icon" aria-hidden="true" />
    </a>
  );
}

export default function MerchantMarketingPage() {
  return (
    <>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <div className="site-shell marketing-page">
        <header className="site-header">
          <a className="brand" href="/" aria-label="CheckPass Club, inicio">
            <BrandMark />
            <span className="brand-name">
              checkpass<span>.</span>club
            </span>
          </a>
          <nav className="desktop-nav" aria-label="Navegación de marketing">
            <a href="#campanas">Campañas</a>
            <a href="#como-funciona">Cómo empezar</a>
            <a href="/negocios#planes">Planes</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
          <a className="header-cta" href={onboardingUrl}>
            Pruébalo gratis
            <ArrowUpRight className="landing-icon" aria-hidden="true" />
          </a>
        </header>

        <main id="contenido">
          <section className="hero" aria-labelledby="marketing-title">
            <div className="hero-copy">
              <span className="eyebrow">
                <span className="eyebrow-line" /> CAMPAÑAS AUTOMÁTICAS PARA TU
                NEGOCIO
              </span>
              <h1 id="marketing-title">
                Dales un motivo para <em>visitarte.</em>
              </h1>
              <p className="hero-lede">
                Elige un beneficio y activa la campaña. CheckPass lo entrega
                cuando se cumplen sus condiciones, tanto a tus clientes como a
                personas de otros comercios cercanos.
              </p>
              <div className="hero-actions">
                <SignupLink />
                <a className="text-link" href="#campanas">
                  Conoce las campañas
                  <ArrowRight className="landing-icon" aria-hidden="true" />
                </a>
              </div>
              <p className="hero-assurance">
                <Check className="landing-icon" aria-hidden="true" /> Todo
                incluido durante la prueba · Empezamos en Cuenca
              </p>
            </div>
            <figure
              className="marketing-invitation"
              aria-label="Ejemplo ilustrativo de una invitación de tu negocio"
            >
              <figcaption className="kicker">TU CAFETERÍA</figcaption>
              <Gift aria-hidden="true" />
              <strong>Un café para ti</strong>
              <p>Un motivo para visitarte.</p>
            </figure>
          </section>

          <section
            className="section"
            id="campanas"
            aria-labelledby="campaigns-title"
          >
            <div className="section-heading">
              <span className="kicker">DOS FORMAS DE INVITARLOS</span>
              <h2 id="campaigns-title">
                Da la bienvenida. Invita a <em>nuevos clientes.</em>
              </h2>
              <p>
                Cada campaña tiene un propósito. Tú eliges el beneficio y la
                activas; CheckPass lo entrega cuando se cumplen sus condiciones.
              </p>
            </div>
            <div className="marketing-campaigns">
              <article className="marketing-campaign">
                <span className="kicker">AL UNIRSE A TU PROGRAMA</span>
                <h3>Bienvenida</h3>
                <p>
                  Ofrece un beneficio cuando alguien se inscribe en tu programa
                  de fidelización. Un primer motivo para seguir eligiendo tu
                  negocio.
                </p>
                <ol
                  className="marketing-campaign-flow"
                  aria-label="Bienvenida: al unirse, recibe tu regalo"
                >
                  <li>
                    <User aria-hidden="true" />
                    <span>Se une</span>
                  </li>
                  <li className="marketing-flow-arrow" aria-hidden="true">
                    <ArrowRight />
                  </li>
                  <li>
                    <Gift aria-hidden="true" />
                    <span>Recibe tu regalo</span>
                  </li>
                </ol>
              </article>
              <article className="marketing-campaign">
                <span className="kicker">
                  PARA QUIENES TODAVÍA NO TE CONOCEN
                </span>
                <h3>Venta cruzada</h3>
                <p>
                  Ofrece un beneficio a personas que compran en otros comercios
                  participantes cerca de tu local.
                </p>
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
                <p className="marketing-campaign-condition">
                  Entre comercios de rubros distintos, a menos de 2 km.
                </p>
              </article>
            </div>
            <p className="marketing-plan-note">
              Bienvenida y Venta cruzada están incluidas en Conecta e Impulso.
            </p>
          </section>

          <section
            className="section intro-section"
            id="como-funciona"
            aria-labelledby="start-title"
          >
            <div className="section-heading">
              <span className="kicker">ACTÍVALA UNA VEZ</span>
              <h2 id="start-title">
                Tú preparas la campaña. CheckPass <em>entrega el beneficio.</em>
              </h2>
            </div>
            <div className="steps">
              <article>
                <span className="step-number">01</span>
                <h3>Activa tu programa</h3>
                <p>
                  Invita a tus clientes a inscribirse con el QR de tu local. Así
                  abres un canal para seguir en contacto desde su teléfono.
                </p>
              </article>
              <article>
                <span className="step-number">02</span>
                <h3>Elige qué ofrecer</h3>
                <p>
                  Selecciona la campaña y define el beneficio y sus condiciones.
                  Puedes revisar lo que ofreces antes de activarla.
                </p>
              </article>
              <article>
                <span className="step-number">03</span>
                <h3>Deja que trabaje</h3>
                <p>
                  La entrega del beneficio ocurre automáticamente cuando se
                  cumplen las condiciones de la campaña. No tienes que enviarlo
                  cliente por cliente.
                </p>
              </article>
            </div>
            <div className="start-actions">
              <SignupLink />
              <p>Todo incluido durante la prueba.</p>
            </div>
          </section>

          <section
            className="section marketing-advanced"
            aria-labelledby="advanced-title"
          >
            <div>
              <span className="kicker">CAMPAÑAS AVANZADAS · IMPULSO</span>
              <h2 id="advanced-title">
                Más motivos para <em>regresar.</em>
              </h2>
            </div>
            <div>
              <p>
                Recupera el contacto con clientes que dejaron de venir o
                promueve visitas en horarios tranquilos. Impulso añade campañas
                para estas situaciones; tú eliges el beneficio.
              </p>
              <a className="text-link" href="/negocios#planes">
                Compara los planes
                <ArrowRight className="landing-icon" aria-hidden="true" />
              </a>
            </div>
          </section>

          <section
            className="section faq-section"
            id="preguntas"
            aria-labelledby="faq-title"
          >
            <div>
              <span className="kicker">PREGUNTAS FRECUENTES</span>
              <h2 id="faq-title">
                Entiende cómo llegan tus <em>invitaciones.</em>
              </h2>
            </div>
            <div className="faq-list">
              {faqs.map((faq) => (
                <details key={faq.question}>
                  <summary>
                    {faq.question}
                    <Plus className="landing-icon" aria-hidden="true" />
                  </summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="final-cta" aria-labelledby="final-title">
            <span className="kicker">PRUÉBALO CON TU NEGOCIO</span>
            <h2 id="final-title">
              Tu próxima invitación puede empezar <em>hoy.</em>
            </h2>
            <p>
              Prueba las campañas de marketing, el programa de fidelización y el
              punto de venta gratis durante tres meses.
            </p>
            <SignupLink light />
          </section>
        </main>
        <LandingFooter showPhotoCredit={false} />
      </div>
    </>
  );
}
